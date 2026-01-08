import { Storage } from "@plasmohq/storage";
import {
  DEFAULT_GRADIENT_SETTINGS,
  GRADIENT_SETTINGS_STORAGE_KEY,
  type GradientSettings,
} from "../../shared/constants/gradientSettings";
import { logger } from "../../shared/utils/logger";

const storage = new Storage();

interface LegacySettings {
  showOnHomepage?: boolean;
  shaderType?: string;
  distortion?: number;
  swirl?: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  rotation?: number;
  speed?: number;
  opacity?: number;
  boostDullColors?: boolean;
  vibrantSaturationThreshold?: number;
  vibrantRatioThreshold?: number;
  boostIntensity?: number;
  rememberAlbumSettings?: boolean;
  audioScaleBoost?: number;
}

export const loadGradientSettings = async (): Promise<GradientSettings> => {
  try {
    const storedSettings = await storage.get<GradientSettings & LegacySettings>(GRADIENT_SETTINGS_STORAGE_KEY);
    if (storedSettings) {
      const {
        showOnHomepage,
        shaderType,
        distortion,
        swirl,
        offsetX,
        offsetY,
        scale,
        rotation,
        speed,
        opacity,
        boostDullColors,
        vibrantSaturationThreshold,
        vibrantRatioThreshold,
        boostIntensity,
        rememberAlbumSettings,
        audioScaleBoost,
        ...validSettings
      } = storedSettings;

      const migrated = {
        ...DEFAULT_GRADIENT_SETTINGS,
        ...validSettings,
        showOnBrowsePages:
          validSettings.showOnBrowsePages ?? showOnHomepage ?? DEFAULT_GRADIENT_SETTINGS.showOnBrowsePages,
      };
      return migrated;
    }
    return { ...DEFAULT_GRADIENT_SETTINGS };
  } catch (error) {
    logger.error("Error loading gradient settings from storage:", error);
    return { ...DEFAULT_GRADIENT_SETTINGS };
  }
};

export const saveGradientSettings = async (settings: GradientSettings): Promise<void> => {
  try {
    await storage.set(GRADIENT_SETTINGS_STORAGE_KEY, settings);
  } catch (error) {
    logger.error("Error saving gradient settings to storage:", error);
  }
};
