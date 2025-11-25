import type { PlasmoCSConfig } from "plasmo";
import {
  DEFAULT_DYNAMIC_MULTIPLIERS,
  type DynamicMultipliers,
  type GradientSettings,
} from "../shared/constants/gradientSettings";
import { logger } from "../shared/utils/logger";
import * as audioAnalysis from "./lib/audioAnalysis";
import * as colorExtraction from "./lib/colorExtraction";
import * as messageHandler from "./lib/messageHandler";
import * as shaderManager from "./lib/shaderManager";
import * as storage from "./lib/storage";

export const config: PlasmoCSConfig = {
  matches: ["https://music.youtube.com/*"],
  all_frames: true,
};

let gradientSettings: GradientSettings;
let dynamicMultipliers: DynamicMultipliers = { ...DEFAULT_DYNAMIC_MULTIPLIERS };
let lastImageSrc = "";
let currentAlbumArtUrl = "";
let albumSaveDebounceTimer: NodeJS.Timeout | null = null;

const debouncedSaveAlbumColors = (
  albumUrl: string,
  colors: string[],
  colorsManuallyModified: boolean = false
): void => {
  if (albumSaveDebounceTimer) {
    clearTimeout(albumSaveDebounceTimer);
  }

  albumSaveDebounceTimer = setTimeout(() => {
    logger.log("Debounced save - saving colors to album storage", {
      albumUrl,
      colorCount: colors.length,
      colorsManuallyModified,
    });
    storage.saveAlbumColors(albumUrl, colors, colorsManuallyModified);
    albumSaveDebounceTimer = null;
  }, 1000);
};

const handleBeatDetected = (multipliers: DynamicMultipliers): void => {
  dynamicMultipliers = multipliers;
  shaderManager.updateShaderSettings(gradientSettings, dynamicMultipliers);
};

const handleAudioResponsiveToggle = (): void => {
  if (gradientSettings.audioResponsive && audioAnalysis.isAudioInitialized()) {
    audioAnalysis.startAudioAnalysis(gradientSettings, handleBeatDetected);
  } else {
    dynamicMultipliers = { speedMultiplier: 1, scaleMultiplier: 1 };
    shaderManager.updateShaderSettings(gradientSettings, dynamicMultipliers);
  }
};

const getCurrentPageType = (): "player" | "homepage" | "search" | "other" => {
  const hasPlayerPage = !!document.getElementById("player-page");
  const hasSearchPage = !!document.getElementById("search-page");
  const hasHomepageGradient = !!document.querySelector(".background-gradient.style-scope.ytmusic-browse-response");

  logger.log("getCurrentPageType check:", {
    hasPlayerPage,
    hasSearchPage,
    hasHomepageGradient,
  });

  if (hasPlayerPage) return "player";
  if (hasSearchPage) return "search";
  if (hasHomepageGradient) return "homepage";
  return "other";
};

const getLocationFromPageType = (pageType: "player" | "homepage" | "search"): string => {
  if (pageType === "player") return "player";
  if (pageType === "search") return "search";
  return "homepage";
};

const getTargetSelectorFromPageType = (pageType: "player" | "homepage" | "search"): string => {
  if (pageType === "player") return "player-page";
  if (pageType === "search") return "search-page";
  return "homepage";
};

const updateGradientColors = async (
  colors: string[],
  pageType: "player" | "homepage" | "search" = "player"
): Promise<void> => {
  logger.log("updateGradientColors called with", colors.length, "colors for", pageType);

  if (colors.length === 0) {
    const location = getLocationFromPageType(pageType);
    shaderManager.destroyShader(location);
    return;
  }

  const targetSelector = getTargetSelectorFromPageType(pageType);
  const location = getLocationFromPageType(pageType);

  if (shaderManager.hasShader(location)) {
    logger.log(`Updating existing ${location} shader colors`);
    shaderManager.updateShaderColors(colors, gradientSettings, dynamicMultipliers, location);
  } else {
    logger.log(`Creating new ${location} shader`);
    const created = await shaderManager.createShader(colors, gradientSettings, dynamicMultipliers, targetSelector);
    logger.log("Shader created:", created);
  }

  if (gradientSettings.rememberAlbumSettings && currentAlbumArtUrl && pageType === "player") {
    logger.log("Colors manually updated - debouncing save to album storage");
    debouncedSaveAlbumColors(currentAlbumArtUrl, colors, true);
  }
};

const updateGradientSettings = (settings: GradientSettings): void => {
  const wasAudioResponsive = gradientSettings.audioResponsive;
  const wasShowOnBrowsePages = gradientSettings.showOnBrowsePages;
  const boostSettingsChanged =
    gradientSettings.boostDullColors !== settings.boostDullColors ||
    gradientSettings.vibrantSaturationThreshold !== settings.vibrantSaturationThreshold ||
    gradientSettings.vibrantRatioThreshold !== settings.vibrantRatioThreshold ||
    gradientSettings.boostIntensity !== settings.boostIntensity;

  gradientSettings = settings;

  logger.setEnabled(settings.showLogs);

  if (wasAudioResponsive !== settings.audioResponsive) {
    handleAudioResponsiveToggle();
  }

  if (wasShowOnBrowsePages !== settings.showOnBrowsePages) {
    checkAndUpdateGradient();
  }

  if (boostSettingsChanged) {
    logger.log("Boost settings changed - re-extracting colors");
    colorExtraction.clearColorCache();
    extractAndUpdateColors(true);
  }

  if (shaderManager.hasShader()) {
    shaderManager.updateShaderSettings(settings, dynamicMultipliers);
  }
};

const extractAndUpdateColors = async (forceExtraction: boolean = false): Promise<void> => {
  logger.log("Extracting colors from album art...", { forceExtraction });
  const result = await colorExtraction.extractColorsFromAlbumArt(gradientSettings.boostDullColors, gradientSettings);

  if (!result) {
    logger.log("No album art found");
    return;
  }

  const isSameImage = result.imageSrc === lastImageSrc;
  const isNewImage = !isSameImage;

  if (isNewImage) {
    logger.log("New album detected:", result.imageSrc);
    lastImageSrc = result.imageSrc;
  }
  currentAlbumArtUrl = result.imageSrc;

  let colorsToUse = result.colors;
  let shouldUpdate = isNewImage || forceExtraction;

  if (gradientSettings.rememberAlbumSettings && !forceExtraction) {
    const savedAlbumData = await storage.loadAlbumSettings(result.imageSrc);
    if (savedAlbumData) {
      logger.log("Found saved album data", {
        savedColors: savedAlbumData.colors,
        colorsManuallyModified: savedAlbumData.colorsManuallyModified,
      });

      const shouldUseSavedColors =
        savedAlbumData.colors &&
        savedAlbumData.colors.length > 0 &&
        (savedAlbumData.colorsManuallyModified || !gradientSettings.boostDullColors);

      if (shouldUseSavedColors) {
        colorsToUse = savedAlbumData.colors;
        logger.log("Using saved colors (manually modified or boost disabled)");
        const currentColors = shaderManager.getCurrentColors();
        if (JSON.stringify(currentColors) !== JSON.stringify(colorsToUse)) {
          shouldUpdate = true;
        }
      } else {
        logger.log("Using freshly extracted colors with boost applied");
      }
    } else if (isNewImage) {
      logger.log("No saved data for this album - will save current colors");
      debouncedSaveAlbumColors(result.imageSrc, colorsToUse, false);
    }
  }

  if (!shouldUpdate) {
    logger.log("Same image and colors unchanged, skipping update");
    return;
  }

  if (forceExtraction) {
    logger.log("Force extraction - using freshly extracted colors, NOT saving to album storage");
  }

  if (colorsToUse.length > 0) {
    await updateGradientColors(colorsToUse, "player");

    if (gradientSettings.showOnBrowsePages) {
      if (shaderManager.hasShader("homepage")) {
        logger.log("Updating homepage shader with new colors");
        await updateGradientColors(colorsToUse, "homepage");
      }
      if (shaderManager.hasShader("search")) {
        logger.log("Updating search shader with new colors");
        await updateGradientColors(colorsToUse, "search");
      }
    }
  }
};

const destroyBrowsePageShaders = (): void => {
  if (shaderManager.hasShader("homepage")) {
    logger.log("Removing homepage shader");
    shaderManager.destroyShader("homepage");
  }
  if (shaderManager.hasShader("search")) {
    logger.log("Removing search shader");
    shaderManager.destroyShader("search");
  }
};

const checkAndUpdateGradient = async (): Promise<void> => {
  const pageType = getCurrentPageType();
  const hasPlayerShader = shaderManager.hasShader("player");
  const hasHomepageShader = shaderManager.hasShader("homepage");
  const hasSearchShader = shaderManager.hasShader("search");

  logger.log("checkAndUpdateGradient", {
    pageType,
    hasPlayerShader,
    hasHomepageShader,
    hasSearchShader,
    showOnBrowsePages: gradientSettings.showOnBrowsePages,
  });

  if (pageType === "player") {
    logger.log("On player page - extracting colors");
    await extractAndUpdateColors();

    if (gradientSettings.showOnBrowsePages) {
      const currentColors = shaderManager.getCurrentColors();
      if (currentColors.length > 0 && !hasHomepageShader) {
        logger.log("Creating homepage shader from player colors");
        await updateGradientColors(currentColors, "homepage");
      }
      if (currentColors.length > 0 && !hasSearchShader) {
        logger.log("Creating search shader from player colors");
        await updateGradientColors(currentColors, "search");
      }
    } else {
      destroyBrowsePageShaders();
    }
  } else if (pageType === "homepage" || pageType === "search") {
    if (gradientSettings.showOnBrowsePages) {
      const currentColors = shaderManager.getCurrentColors();
      const hasTargetShader = pageType === "homepage" ? hasHomepageShader : hasSearchShader;

      logger.log(`On ${pageType} - showOnBrowsePages enabled`, {
        hasTargetShader,
        availableColors: currentColors,
        colorCount: currentColors.length,
      });

      if (!hasTargetShader && currentColors.length > 0) {
        logger.log(`Creating ${pageType} shader with colors:`, currentColors);
        await updateGradientColors(currentColors, pageType);
      } else if (!hasTargetShader) {
        logger.log(`No colors available yet for ${pageType} shader`);
      }
    } else {
      destroyBrowsePageShaders();
    }

    if (hasPlayerShader) {
      logger.log("Not on player page - removing player shader");
      shaderManager.destroyShader("player");
    }
  } else {
    logger.log("On other page - removing all shaders");
    shaderManager.destroyShader();
  }
};

const initializeApp = async (): Promise<void> => {
  gradientSettings = await storage.loadGradientSettings();
  logger.setEnabled(gradientSettings.showLogs);

  logger.log("Better Lyrics Shaders: Initializing...");
  logger.log("Loaded settings:", gradientSettings);
  shaderManager.cleanupOrphanedGradients();

  messageHandler.setupMessageListener({
    onColorsUpdate: updateGradientColors,
    onSettingsUpdate: updateGradientSettings,
    getCurrentData: () => {
      const songInfo = messageHandler.getSongInfo();
      return {
        colors: shaderManager.getCurrentColors(),
        songTitle: songInfo.title,
        songAuthor: songInfo.author,
        gradientSettings: gradientSettings,
      };
    },
  });

  setTimeout(async () => {
    await checkAndUpdateGradient();

    const retryExtraction = async (retries: number = 10): Promise<void> => {
      if (retries <= 0) {
        logger.log("Max retries reached, giving up on color extraction");
        return;
      }
      const colors = shaderManager.getCurrentColors();
      if (colors.length === 0) {
        logger.log(`No colors yet, retrying extraction... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 500));
        await checkAndUpdateGradient();
        await retryExtraction(retries - 1);
      } else {
        logger.log("Colors found, stopping retry");
      }
    };
    await retryExtraction();

    setTimeout(async () => {
      await audioAnalysis.initializeAudioAnalysis();
      if (gradientSettings.audioResponsive) {
        audioAnalysis.startAudioAnalysis(gradientSettings, handleBeatDetected);
      }
    }, 2000);

    let timeoutId: NodeJS.Timeout;
    let isProcessing = false;

    const debouncedUpdate = () => {
      if (isProcessing) return;

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        isProcessing = true;
        checkAndUpdateGradient().finally(() => {
          isProcessing = false;
        });
      }, 300);
    };

    const songImageObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "src") {
          debouncedUpdate();
          break;
        }
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          debouncedUpdate();
          break;
        }
      }
    });

    const waitForSongImage = () => {
      const songImage = document.getElementById("song-image");
      if (songImage) {
        songImageObserver.observe(songImage, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["src"],
        });
      } else {
        setTimeout(waitForSongImage, 1000);
      }
    };

    waitForSongImage();

    let lastVideoId = new URL(window.location.href).searchParams.get("v");
    const checkForVideoIdChange = () => {
      const currentVideoId = new URL(window.location.href).searchParams.get("v");
      if (currentVideoId && currentVideoId !== lastVideoId) {
        logger.log("Video ID changed:", lastVideoId, "->", currentVideoId);
        lastVideoId = currentVideoId;
        debouncedUpdate();
      }
    };
    setInterval(checkForVideoIdChange, 1000);

    const playerPageObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const addedPlayerPage = Array.from(mutation.addedNodes).some(
            node => node instanceof Element && node.id === "player-page"
          );
          const removedPlayerPage = Array.from(mutation.removedNodes).some(
            node => node instanceof Element && node.id === "player-page"
          );

          if (addedPlayerPage || removedPlayerPage) {
            debouncedUpdate();
            break;
          }
        }
      }
    });

    const ytdAppElement = document.querySelector("ytmusic-app");
    if (ytdAppElement) {
      playerPageObserver.observe(ytdAppElement, {
        childList: true,
        subtree: false,
      });
    }
  }, 0);
};

window.addEventListener("beforeunload", () => {
  audioAnalysis.stopAudioAnalysis();
  shaderManager.destroyShader();
  shaderManager.clearColorVectorCache();
  colorExtraction.clearColorCache();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
