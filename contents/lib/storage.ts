import { Storage } from "@plasmohq/storage";
import {
  DEFAULT_GRADIENT_SETTINGS,
  GRADIENT_SETTINGS_STORAGE_KEY,
  type GradientSettings,
} from "../../shared/constants/gradientSettings";
import { logger } from "../../shared/utils/logger";

const storage = new Storage();

export const loadGradientSettings = async (): Promise<GradientSettings> => {
  try {
    const storedSettings = await storage.get<GradientSettings>(GRADIENT_SETTINGS_STORAGE_KEY);
    if (storedSettings) {
      return { ...DEFAULT_GRADIENT_SETTINGS, ...storedSettings };
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
