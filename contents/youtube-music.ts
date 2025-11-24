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

const updateGradientColors = async (colors: string[]): Promise<void> => {
  logger.log("updateGradientColors called with", colors.length, "colors");

  if (colors.length === 0) {
    shaderManager.destroyShader();
    return;
  }

  if (shaderManager.hasShader()) {
    logger.log("Updating existing shader colors");
    shaderManager.updateShaderColors(colors, gradientSettings, dynamicMultipliers);
  } else {
    logger.log("Creating new shader");
    const created = await shaderManager.createShader(colors, gradientSettings, dynamicMultipliers);
    logger.log("Shader created:", created);
  }
};

const updateGradientSettings = (settings: GradientSettings): void => {
  const wasAudioResponsive = gradientSettings.audioResponsive;
  gradientSettings = settings;

  logger.setEnabled(settings.showLogs);

  if (wasAudioResponsive !== settings.audioResponsive) {
    handleAudioResponsiveToggle();
  }

  if (shaderManager.hasShader()) {
    shaderManager.updateShaderSettings(settings, dynamicMultipliers);
  }
};

const extractAndUpdateColors = async (): Promise<void> => {
  logger.log("Extracting colors from album art...");
  const result = await colorExtraction.extractColorsFromAlbumArt();

  if (!result) {
    logger.log("No album art found");
    return;
  }

  if (result.imageSrc === lastImageSrc) {
    logger.log("Same image, skipping");
    return;
  }

  logger.log("New image detected:", result.imageSrc);
  lastImageSrc = result.imageSrc;

  if (result.colors.length > 0) {
    await updateGradientColors(result.colors);
  }
};

const checkAndUpdateGradient = async (): Promise<void> => {
  const playerPage = document.getElementById("player-page");
  const exists = document.getElementById("better-lyrics-gradient");

  if (playerPage) {
    if (!exists) {
      await extractAndUpdateColors();
    } else {
      await extractAndUpdateColors();
    }
  } else if (exists) {
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
