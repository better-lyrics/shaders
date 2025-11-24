import ColorThief from "colorthief";
import { logger } from "../../shared/utils/logger";

const colorThief = new ColorThief();
const imageCache = new Map<string, string[]>();
const MAX_CACHE_SIZE = 10;

const rgbToHsl = (red: number, green: number, blue: number) => {
  red /= 255;
  green /= 255;
  blue /= 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let h = 0,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case red:
        h = (green - blue) / d + (green < blue ? 6 : 0);
        break;
      case green:
        h = (blue - red) / d + 2;
        break;
      case blue:
        h = (red - green) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    hue: Math.round(h * 360),
    saturation: Math.round(s * 100),
    lightness: Math.round(l * 100),
  };
};

const manageCacheSize = () => {
  if (imageCache.size > MAX_CACHE_SIZE) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey) imageCache.delete(firstKey);
  }
};

const boostDullColorSaturation = (hslColors: Array<{ hue: number; saturation: number; lightness: number }>): Array<{ hue: number; saturation: number; lightness: number }> => {
  const maxSaturation = Math.max(...hslColors.map(c => c.saturation));

  if (maxSaturation < 40) {
    return hslColors;
  }

  const nonGrayscaleColors = hslColors.filter(c => c.saturation > 5);
  const avgHue = nonGrayscaleColors.length > 0
    ? nonGrayscaleColors.reduce((sum, c) => sum + c.hue, 0) / nonGrayscaleColors.length
    : 0;

  return hslColors.map(color => {
    if (color.saturation < 40) {
      const targetHue = color.saturation < 5 ? avgHue : color.hue;
      const boostedSaturation = Math.min(color.saturation * 1.5 + 20, 70);
      return { hue: targetHue, saturation: boostedSaturation, lightness: color.lightness };
    }
    return color;
  });
};

export const extractColorsFromImage = async (
  img: HTMLImageElement,
  boostDullColors: boolean = true
): Promise<string[]> => {
  const cacheKey = `${img.src}_${boostDullColors}`;

  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  // Skip data URI placeholders (1x1 transparent GIFs, etc)
  if (img.src.startsWith("data:")) {
    logger.log("Skipping data URI placeholder image");
    return [];
  }

  try {
    const response = await fetch(img.src);
    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);
    const proxyImg = new Image();
    proxyImg.crossOrigin = "anonymous";

    return new Promise(resolve => {
      proxyImg.onload = () => {
        try {
          if (!proxyImg.complete || proxyImg.naturalHeight === 0) {
            logger.error("Image not fully loaded");
            URL.revokeObjectURL(imageUrl);
            resolve([]);
            return;
          }

          // Skip images that are too small for ColorThief (need at least 3x3)
          if (proxyImg.naturalWidth < 3 || proxyImg.naturalHeight < 3) {
            logger.log("Image too small for color extraction:", proxyImg.naturalWidth, "x", proxyImg.naturalHeight);
            URL.revokeObjectURL(imageUrl);
            resolve([]);
            return;
          }

          let colors, primaryColor;

          try {
            colors = colorThief.getPalette(proxyImg, 5);
            primaryColor = colorThief.getColor(proxyImg);
          } catch (err) {
            logger.error("ColorThief method call failed:", err);
            URL.revokeObjectURL(imageUrl);
            resolve([]);
            return;
          }

          logger.log("ColorThief results - colors:", colors, "primaryColor:", primaryColor);

          if (!colors || !primaryColor) {
            logger.error("ColorThief returned null - image may be too small or invalid");
            URL.revokeObjectURL(imageUrl);
            resolve([]);
            return;
          }

          // Validate that colors is an array and primaryColor is an array with 3 elements
          if (!Array.isArray(colors) || !Array.isArray(primaryColor) || primaryColor.length < 3) {
            logger.error("ColorThief returned invalid format - colors:", colors, "primaryColor:", primaryColor);
            URL.revokeObjectURL(imageUrl);
            resolve([]);
            return;
          }

          // Filter out any null/invalid colors from the palette array
          const validColors = colors.filter(c => c && Array.isArray(c) && c.length >= 3);

          if (validColors.length === 0) {
            logger.error("ColorThief returned no valid colors");
            URL.revokeObjectURL(imageUrl);
            resolve([]);
            return;
          }

          const colorsWithPrimary = [primaryColor, ...validColors];
          let colorsHslObjects = colorsWithPrimary
            .filter(color => color && Array.isArray(color) && color.length >= 3)
            .map(color => {
              const [r, g, b] = color;
              return rgbToHsl(r, g, b);
            });

          if (boostDullColors) {
            colorsHslObjects = boostDullColorSaturation(colorsHslObjects);
          }

          const colorsHsl = colorsHslObjects.map(
            ({ hue, saturation, lightness }) => `hsl(${hue}, ${saturation}%, ${lightness}%)`
          );

          manageCacheSize();
          imageCache.set(cacheKey, colorsHsl);

          URL.revokeObjectURL(imageUrl);
          resolve(colorsHsl);
        } catch (error) {
          logger.error("ColorThief error:", error);
          URL.revokeObjectURL(imageUrl);
          resolve([]);
        }
      };

      proxyImg.onerror = () => {
        logger.error("Error loading proxy image");
        URL.revokeObjectURL(imageUrl);
        resolve([]);
      };

      proxyImg.src = imageUrl;
    });
  } catch (error) {
    logger.error("Error extracting colors:", error);
    return [];
  }
};

export const extractColorsFromAlbumArt = async (
  boostDullColors: boolean = true
): Promise<{
  colors: string[];
  imageSrc: string;
} | null> => {
  const songImageDiv = document.getElementById("song-image");
  const coverImage = songImageDiv?.querySelector("img") as HTMLImageElement;

  if (!coverImage || !coverImage.complete || coverImage.naturalHeight === 0) {
    return null;
  }

  logger.log("Extracting colors from new image:", coverImage.src);

  try {
    const colors = await extractColorsFromImage(coverImage, boostDullColors);
    logger.log("Extracted colors:", colors);

    return {
      colors,
      imageSrc: coverImage.src,
    };
  } catch (error) {
    logger.error("Error in color extraction:", error);
    return null;
  }
};

export const clearColorCache = (): void => {
  imageCache.clear();
};
