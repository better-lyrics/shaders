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

const debouncedSaveAlbumSettings = (albumUrl: string, settings: GradientSettings, colors: string[]): void => {
  if (albumSaveDebounceTimer) {
    clearTimeout(albumSaveDebounceTimer);
  }

  albumSaveDebounceTimer = setTimeout(() => {
    logger.log("Debounced save - saving to album storage", {
      albumUrl,
      colorCount: colors.length
    });
    storage.saveAlbumSettings(albumUrl, settings, colors);
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

const getCurrentPageType = (): "player" | "homepage" | "other" => {
  const hasPlayerPage = !!document.getElementById("player-page");
  const hasHomepageGradient = !!document.querySelector(".background-gradient.style-scope.ytmusic-browse-response");

  logger.log("getCurrentPageType check:", {
    hasPlayerPage,
    hasHomepageGradient
  });

  if (hasPlayerPage) return "player";
  if (hasHomepageGradient) return "homepage";
  return "other";
};

const updateGradientColors = async (colors: string[], pageType: "player" | "homepage" = "player"): Promise<void> => {
  logger.log("updateGradientColors called with", colors.length, "colors for", pageType);

  if (colors.length === 0) {
    const location = pageType === "player" ? "player" : "homepage";
    shaderManager.destroyShader(location);
    return;
  }

  const targetSelector = pageType === "player" ? "player-page" : "homepage";
  const location = pageType === "player" ? "player" : "homepage";

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
    debouncedSaveAlbumSettings(currentAlbumArtUrl, gradientSettings, colors);
  }
};

const updateGradientSettings = (settings: GradientSettings): void => {
  const wasAudioResponsive = gradientSettings.audioResponsive;
  const wasShowOnHomepage = gradientSettings.showOnHomepage;

  gradientSettings = settings;

  logger.setEnabled(settings.showLogs);

  if (wasAudioResponsive !== settings.audioResponsive) {
    handleAudioResponsiveToggle();
  }

  if (wasShowOnHomepage !== settings.showOnHomepage) {
    checkAndUpdateGradient();
  }

  if (shaderManager.hasShader()) {
    shaderManager.updateShaderSettings(settings, dynamicMultipliers);
  }

  if (settings.rememberAlbumSettings && currentAlbumArtUrl) {
    const currentColors = shaderManager.getCurrentColors();
    logger.log("Settings changed - debouncing save to album storage");
    debouncedSaveAlbumSettings(currentAlbumArtUrl, settings, currentColors);
  }
};

const extractAndUpdateColors = async (forceExtraction: boolean = false): Promise<void> => {
  logger.log("Extracting colors from album art...", { forceExtraction });
  const result = await colorExtraction.extractColorsFromAlbumArt(
    gradientSettings.boostDullColors,
    gradientSettings
  );

  if (!result) {
    logger.log("No album art found");
    return;
  }

  if (result.imageSrc === lastImageSrc && !forceExtraction) {
    logger.log("Same image, skipping");
    return;
  }

  logger.log("New album detected:", result.imageSrc);
  lastImageSrc = result.imageSrc;
  currentAlbumArtUrl = result.imageSrc;

  let colorsToUse = result.colors;
  let settingsToApply = gradientSettings;

  if (gradientSettings.rememberAlbumSettings && !forceExtraction) {
    const savedAlbumData = await storage.loadAlbumSettings(result.imageSrc);
    if (savedAlbumData) {
      logger.log("Found saved album data - restoring settings and colors", {
        savedColors: savedAlbumData.colors,
        savedSettingsKeys: Object.keys(savedAlbumData.settings)
      });

      if (savedAlbumData.colors && savedAlbumData.colors.length > 0) {
        colorsToUse = savedAlbumData.colors;
        logger.log("Using saved colors instead of freshly extracted ones");
      }

      if (savedAlbumData.settings && Object.keys(savedAlbumData.settings).length > 0) {
        settingsToApply = { ...gradientSettings, ...savedAlbumData.settings };
        gradientSettings = settingsToApply;
        logger.log("Applied saved settings for this album");
      }
    } else {
      logger.log("No saved data for this album - will save current state");
      debouncedSaveAlbumSettings(result.imageSrc, gradientSettings, colorsToUse);
    }
  }

  if (forceExtraction) {
    logger.log("Force extraction - using freshly extracted colors, NOT saving to album storage");
  }

  if (colorsToUse.length > 0) {
    await updateGradientColors(colorsToUse, "player");

    if (gradientSettings.showOnHomepage && shaderManager.hasShader("homepage")) {
      logger.log("Updating homepage shader with new colors");
      await updateGradientColors(colorsToUse, "homepage");
    }

    if (shaderManager.hasShader("player") && settingsToApply !== gradientSettings) {
      shaderManager.updateShaderSettings(settingsToApply, dynamicMultipliers);
    }
  }
};

const checkAndUpdateGradient = async (): Promise<void> => {
  const pageType = getCurrentPageType();
  const hasPlayerShader = shaderManager.hasShader("player");
  const hasHomepageShader = shaderManager.hasShader("homepage");

  logger.log("checkAndUpdateGradient", {
    pageType,
    hasPlayerShader,
    hasHomepageShader,
    showOnHomepage: gradientSettings.showOnHomepage
  });

  // Player page - always show player shader
  if (pageType === "player") {
    logger.log("On player page - extracting colors");
    await extractAndUpdateColors();

    if (gradientSettings.showOnHomepage) {
      const currentColors = shaderManager.getCurrentColors();
      if (currentColors.length > 0 && !hasHomepageShader) {
        logger.log("Creating homepage shader from player colors");
        await updateGradientColors(currentColors, "homepage");
      }
    } else if (hasHomepageShader) {
      logger.log("showOnHomepage disabled - removing homepage shader");
      shaderManager.destroyShader("homepage");
    }
  }
  // Homepage - only show homepage shader if setting is enabled
  else if (pageType === "homepage") {
    if (gradientSettings.showOnHomepage) {
      const currentColors = shaderManager.getCurrentColors();
      logger.log("On homepage - showOnHomepage enabled", {
        hasHomepageShader,
        availableColors: currentColors,
        colorCount: currentColors.length
      });

      if (!hasHomepageShader && currentColors.length > 0) {
        logger.log("Creating homepage shader with colors:", currentColors);
        await updateGradientColors(currentColors, "homepage");
      } else if (!hasHomepageShader) {
        logger.log("No colors available yet for homepage shader");
      }
    } else if (hasHomepageShader) {
      logger.log("showOnHomepage disabled - removing homepage shader");
      shaderManager.destroyShader("homepage");
    }

    if (hasPlayerShader) {
      logger.log("Not on player page - removing player shader");
      shaderManager.destroyShader("player");
    }
  }
  // Other pages - remove all shaders
  else {
    logger.log("Not on player or homepage - removing all shaders");
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
