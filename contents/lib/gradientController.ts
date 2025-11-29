import {
  DEFAULT_DYNAMIC_MULTIPLIERS,
  type DynamicMultipliers,
  type GradientSettings,
} from "../../shared/constants/gradientSettings";
import { logger } from "../../shared/utils/logger";
import * as audioAnalysis from "./audioAnalysis";
import * as colorExtraction from "./colorExtraction";
import * as kawarpManager from "./kawarpManager";
import * as shaderManager from "./shaderManager";
import * as storage from "./storage";

let gradientSettings: GradientSettings;
let dynamicMultipliers: DynamicMultipliers = { ...DEFAULT_DYNAMIC_MULTIPLIERS };
let lastImageSrc = "";
let currentAlbumArtUrl = "";
let albumSaveDebounceTimer: NodeJS.Timeout | null = null;

const colorsEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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
  if (gradientSettings.shaderType === "kawarp") {
    kawarpManager.updateKawarpSpeed(gradientSettings, dynamicMultipliers);
  } else {
    shaderManager.updateShaderSettings(gradientSettings, dynamicMultipliers);
  }
};

const handleAudioResponsiveToggle = (): void => {
  if (gradientSettings.audioResponsive && audioAnalysis.isAudioInitialized()) {
    audioAnalysis.startAudioAnalysis(gradientSettings, handleBeatDetected);
  } else {
    dynamicMultipliers = { speedMultiplier: 1, scaleMultiplier: 1 };
    if (gradientSettings.shaderType === "kawarp") {
      kawarpManager.updateKawarpSpeed(gradientSettings, dynamicMultipliers);
    } else {
      shaderManager.updateShaderSettings(gradientSettings, dynamicMultipliers);
    }
  }
};

const destroyBrowsePageShaders = (): void => {
  if (shaderManager.hasShader("homepage")) {
    logger.log("Removing homepage mesh shader");
    shaderManager.destroyShader("homepage");
  }
  if (shaderManager.hasShader("search")) {
    logger.log("Removing search mesh shader");
    shaderManager.destroyShader("search");
  }
  if (kawarpManager.hasKawarp("homepage")) {
    logger.log("Removing homepage kawarp");
    kawarpManager.destroyKawarp("homepage");
  }
  if (kawarpManager.hasKawarp("search")) {
    logger.log("Removing search kawarp");
    kawarpManager.destroyKawarp("search");
  }
};

export const updateGradientColors = async (
  colors: string[],
  pageType: "player" | "homepage" | "search" = "player"
): Promise<void> => {
  logger.log("updateGradientColors called with", colors.length, "colors for", pageType);

  const location = getLocationFromPageType(pageType);

  if (colors.length === 0) {
    shaderManager.destroyShader(location);
    return;
  }

  if (gradientSettings.shaderType === "kawarp") {
    return;
  }

  const targetSelector = getTargetSelectorFromPageType(pageType);

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

export const extractAndUpdateColors = async (
  forceUpdate: boolean = false,
  skipSavedColors: boolean = false
): Promise<void> => {
  logger.log("Extracting colors from album art...", {
    forceUpdate,
    skipSavedColors,
  });
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
  let shouldUpdate = isNewImage || forceUpdate;

  if (gradientSettings.rememberAlbumSettings && !skipSavedColors) {
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
        if (!colorsEqual(currentColors, colorsToUse)) {
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

  if (skipSavedColors) {
    logger.log("Skip saved colors - using freshly extracted colors, NOT saving to album storage");
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

export const checkAndUpdateGradient = async (): Promise<void> => {
  if (!gradientSettings.enabled) {
    logger.log("Shaders disabled - skipping gradient update");
    return;
  }

  const pageType = getCurrentPageType();
  const isKawarp = gradientSettings.shaderType === "kawarp";
  const hasPlayerEffect = isKawarp ? kawarpManager.hasKawarp("player") : shaderManager.hasShader("player");
  const hasHomepageEffect = isKawarp ? kawarpManager.hasKawarp("homepage") : shaderManager.hasShader("homepage");
  const hasSearchEffect = isKawarp ? kawarpManager.hasKawarp("search") : shaderManager.hasShader("search");

  logger.log("checkAndUpdateGradient", {
    pageType,
    shaderType: gradientSettings.shaderType,
    hasPlayerEffect,
    hasHomepageEffect,
    hasSearchEffect,
    showOnBrowsePages: gradientSettings.showOnBrowsePages,
  });

  if (pageType === "player") {
    if (isKawarp) {
      logger.log("On player page - creating/updating kawarp");
      if (!hasPlayerEffect) {
        await kawarpManager.createKawarp(gradientSettings, dynamicMultipliers, "player-page");
      } else {
        await kawarpManager.updateKawarpImage("player");
      }

      if (gradientSettings.showOnBrowsePages) {
        if (hasHomepageEffect) {
          await kawarpManager.updateKawarpImage("homepage");
        }
        if (hasSearchEffect) {
          await kawarpManager.updateKawarpImage("search");
        }
      }
    } else {
      logger.log("On player page - extracting colors for mesh gradient");
      await extractAndUpdateColors();
    }

    if (gradientSettings.showOnBrowsePages) {
      if (isKawarp) {
        if (!hasHomepageEffect) {
          logger.log("Creating homepage kawarp");
          await kawarpManager.createKawarp(gradientSettings, dynamicMultipliers, "homepage");
        }
        if (!hasSearchEffect) {
          logger.log("Creating search kawarp");
          await kawarpManager.createKawarp(gradientSettings, dynamicMultipliers, "search-page");
        }
      } else {
        const currentColors = shaderManager.getCurrentColors();
        if (currentColors.length > 0 && !hasHomepageEffect) {
          logger.log("Creating homepage shader from player colors");
          await updateGradientColors(currentColors, "homepage");
        }
        if (currentColors.length > 0 && !hasSearchEffect) {
          logger.log("Creating search shader from player colors");
          await updateGradientColors(currentColors, "search");
        }
      }
    } else {
      destroyBrowsePageShaders();
    }
  } else if (pageType === "homepage" || pageType === "search") {
    if (gradientSettings.showOnBrowsePages) {
      const targetSelector = pageType === "homepage" ? "homepage" : "search-page";
      const hasTargetEffect = pageType === "homepage" ? hasHomepageEffect : hasSearchEffect;

      logger.log(`On ${pageType} - showOnBrowsePages enabled`, {
        hasTargetEffect,
      });

      if (!hasTargetEffect) {
        if (isKawarp) {
          logger.log(`Creating ${pageType} kawarp`);
          await kawarpManager.createKawarp(gradientSettings, dynamicMultipliers, targetSelector);
        } else {
          const currentColors = shaderManager.getCurrentColors();
          if (currentColors.length > 0) {
            logger.log(`Creating ${pageType} shader with colors:`, currentColors);
            await updateGradientColors(currentColors, pageType);
          } else {
            logger.log(`No colors available yet for ${pageType} shader`);
          }
        }
      }
    } else {
      destroyBrowsePageShaders();
    }

    if (hasPlayerEffect) {
      logger.log("Not on player page - removing player effect");
      if (isKawarp) {
        kawarpManager.destroyKawarp("player");
      } else {
        shaderManager.destroyShader("player");
      }
    }
  } else {
    logger.log("On other page - removing all effects");
    shaderManager.destroyShader();
    kawarpManager.destroyKawarp();
  }
};

export const updateGradientSettings = async (settings: GradientSettings): Promise<void> => {
  const wasEnabled = gradientSettings.enabled;
  const wasShaderType = gradientSettings.shaderType;
  const wasAudioResponsive = gradientSettings.audioResponsive;
  const wasShowOnBrowsePages = gradientSettings.showOnBrowsePages;
  const audioSettingsChanged =
    gradientSettings.audioSpeedMultiplier !== settings.audioSpeedMultiplier ||
    gradientSettings.audioScaleBoost !== settings.audioScaleBoost ||
    gradientSettings.audioBeatThreshold !== settings.audioBeatThreshold;
  const boostSettingsChanged =
    gradientSettings.boostDullColors !== settings.boostDullColors ||
    gradientSettings.vibrantSaturationThreshold !== settings.vibrantSaturationThreshold ||
    gradientSettings.vibrantRatioThreshold !== settings.vibrantRatioThreshold ||
    gradientSettings.boostIntensity !== settings.boostIntensity;
  const shaderTypeChanged = wasShaderType !== settings.shaderType;

  gradientSettings = settings;

  logger.setEnabled(settings.showLogs);

  if (wasEnabled !== settings.enabled) {
    if (!settings.enabled) {
      logger.log("Shaders disabled - destroying all shaders");
      shaderManager.destroyShader();
      kawarpManager.destroyKawarp();
      audioAnalysis.stopAudioAnalysis();
    } else {
      logger.log("Shaders enabled - reinitializing");
      await checkAndUpdateGradient();
      if (settings.audioResponsive) {
        audioAnalysis.startAudioAnalysis(settings, handleBeatDetected);
      }
    }
    return;
  }

  if (!settings.enabled) {
    return;
  }

  if (shaderTypeChanged) {
    logger.log(`Shader type changed from ${wasShaderType} to ${settings.shaderType}`);
    if (wasShaderType === "mesh") {
      shaderManager.destroyShader();
    } else {
      kawarpManager.destroyKawarp();
    }
    await checkAndUpdateGradient();
    return;
  }

  if (wasAudioResponsive !== settings.audioResponsive || audioSettingsChanged) {
    handleAudioResponsiveToggle();
  }

  if (wasShowOnBrowsePages !== settings.showOnBrowsePages) {
    await checkAndUpdateGradient();
  }

  if (boostSettingsChanged && settings.shaderType === "mesh") {
    logger.log("Boost settings changed - re-extracting colors");
    colorExtraction.clearColorCache();
    await extractAndUpdateColors(true, true);
  }

  if (settings.shaderType === "kawarp" && kawarpManager.hasKawarp()) {
    kawarpManager.updateKawarpSettings(settings, dynamicMultipliers);
  } else if (settings.shaderType === "mesh" && shaderManager.hasShader()) {
    shaderManager.updateShaderSettings(settings, dynamicMultipliers);
  }
};

export const initializeSettings = async (): Promise<GradientSettings> => {
  gradientSettings = await storage.loadGradientSettings();
  logger.setEnabled(gradientSettings.showLogs);
  return gradientSettings;
};

export const getSettings = (): GradientSettings => gradientSettings;

export const getDynamicMultipliers = (): DynamicMultipliers => dynamicMultipliers;

export const resetImageTracking = (): void => {
  lastImageSrc = "";
  currentAlbumArtUrl = "";
};

export const startAudioIfEnabled = (): void => {
  if (gradientSettings.enabled && gradientSettings.audioResponsive) {
    audioAnalysis.startAudioAnalysis(gradientSettings, handleBeatDetected);
  }
};

export const hasActiveEffect = (): boolean => {
  return gradientSettings.shaderType === "kawarp"
    ? kawarpManager.hasKawarp("player")
    : shaderManager.getCurrentColors().length > 0;
};

export const cleanup = (): void => {
  if (albumSaveDebounceTimer) {
    clearTimeout(albumSaveDebounceTimer);
    albumSaveDebounceTimer = null;
  }

  audioAnalysis.stopAudioAnalysis();
  shaderManager.destroyShader();
  shaderManager.clearColorVectorCache();
  kawarpManager.destroyKawarp();
  colorExtraction.clearColorCache();
};
