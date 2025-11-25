import ColorThief from "colorthief";
import type { GradientSettings } from "../../shared/constants/gradientSettings";
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

const boostDullColorSaturation = (
  hslColors: Array<{ hue: number; saturation: number; lightness: number }>,
  settings: GradientSettings
): Array<{ hue: number; saturation: number; lightness: number }> => {
  const vibrantThreshold = settings.vibrantSaturationThreshold;
  const ratioThreshold = settings.vibrantRatioThreshold / 100;
  const intensity = settings.boostIntensity / 100;

  const vibrantColors = hslColors.filter(c => c.saturation >= vibrantThreshold).length;
  const vibrantRatio = vibrantColors / hslColors.length;

  logger.log("Color boost analysis:", {
    vibrantColors,
    totalColors: hslColors.length,
    vibrantRatio: (vibrantRatio * 100).toFixed(1) + "%",
    threshold: ratioThreshold * 100 + "%",
    willBoost: vibrantRatio <= ratioThreshold,
  });

  if (vibrantRatio > ratioThreshold) {
    logger.log("Not boosting - palette already vibrant enough");
    return hslColors;
  }

  const nonGrayscaleColors = hslColors.filter(c => c.saturation > 5);
  const avgHue =
    nonGrayscaleColors.length > 0
      ? nonGrayscaleColors.reduce((sum, c) => sum + c.hue, 0) / nonGrayscaleColors.length
      : 0;

  const dullThreshold = 40;
  const multiplier = 1 + intensity * 0.5;
  const addition = intensity * 0.4;
  const cap = 70;

  return hslColors.map(color => {
    if (color.saturation < dullThreshold) {
      const targetHue = color.saturation < 5 ? avgHue : color.hue;
      const boostedSaturation = Math.min(color.saturation * multiplier + addition, cap);
      logger.log(`Boosting color: sat ${color.saturation}% -> ${boostedSaturation.toFixed(1)}%`);
      return { hue: targetHue, saturation: Math.round(boostedSaturation), lightness: color.lightness };
    }
    return color;
  });
};

export const extractColorsFromImage = async (
  img: HTMLImageElement,
  boostDullColors: boolean = true,
  settings?: GradientSettings
): Promise<string[]> => {
  const cacheKey = `${img.src}_${boostDullColors}_${settings?.vibrantSaturationThreshold}_${settings?.vibrantRatioThreshold}_${settings?.boostIntensity}`;

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
            colors = colorThief.getPalette(proxyImg, 4, 1);
            primaryColor = colorThief.getColor(proxyImg, 1);
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

          if (boostDullColors && settings) {
            colorsHslObjects = boostDullColorSaturation(colorsHslObjects, settings);
          }

          const colorsHsl = colorsHslObjects.map(
            ({ hue, saturation, lightness }) =>
              `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`
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

const getVideoIdFromUrl = (): string | null => {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
};

const createImageFromUrl = (url: string): Promise<HTMLImageElement | null> => {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

const waitForAlbumArt = async (maxWaitMs: number = 2000): Promise<HTMLImageElement | null> => {
  const startTime = Date.now();
  const checkInterval = 100;

  while (Date.now() - startTime < maxWaitMs) {
    const songImageDiv = document.getElementById("song-image");
    const albumArt = songImageDiv?.querySelector("img") as HTMLImageElement;

    if (albumArt?.complete && albumArt.naturalHeight > 0 && !albumArt.src.startsWith("data:")) {
      return albumArt;
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  return null;
};

const findValidImage = async (): Promise<HTMLImageElement | null> => {
  const songImageDiv = document.getElementById("song-image");
  const albumArt = songImageDiv?.querySelector("img") as HTMLImageElement;

  if (albumArt?.complete && albumArt.naturalHeight > 0 && !albumArt.src.startsWith("data:")) {
    logger.log("Found album art image");
    return albumArt;
  }

  const videoId = getVideoIdFromUrl();
  if (videoId) {
    logger.log("Album art not ready, waiting briefly...");
    const waitedAlbumArt = await waitForAlbumArt(1500);
    if (waitedAlbumArt) {
      logger.log("Found album art image after waiting");
      return waitedAlbumArt;
    }

    logger.log("Trying YouTube thumbnail for video ID:", videoId);
    const thumbnailUrls = [
      `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    ];

    for (const url of thumbnailUrls) {
      const img = await createImageFromUrl(url);
      if (img && img.naturalHeight > 90) {
        logger.log("Found YouTube thumbnail:", url);
        return img;
      }
    }
  }

  const playerBarThumbnail = document.querySelector(
    "ytmusic-player-bar .thumbnail img, " + ".middle-controls .thumbnail img"
  ) as HTMLImageElement;

  if (
    playerBarThumbnail?.complete &&
    playerBarThumbnail.naturalHeight > 0 &&
    !playerBarThumbnail.src.startsWith("data:")
  ) {
    logger.log("Found player bar thumbnail");
    return playerBarThumbnail;
  }

  logger.log("No valid image found");
  return null;
};

export const extractColorsFromAlbumArt = async (
  boostDullColors: boolean = true,
  settings?: GradientSettings
): Promise<{
  colors: string[];
  imageSrc: string;
} | null> => {
  const coverImage = await findValidImage();

  if (!coverImage) {
    return null;
  }

  logger.log("Extracting colors from image:", coverImage.src);

  try {
    const colors = await extractColorsFromImage(coverImage, boostDullColors, settings);
    logger.log("Extracted colors:", colors);

    if (colors.length === 0) {
      logger.log("No colors extracted - skipping");
      return null;
    }

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
