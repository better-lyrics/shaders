import { Storage } from "@plasmohq/storage";
import {
  DEFAULT_GRADIENT_SETTINGS,
  GRADIENT_SETTINGS_STORAGE_KEY,
  ALBUM_SETTINGS_STORAGE_KEY,
  type GradientSettings,
} from "../../shared/constants/gradientSettings";
import { logger } from "../../shared/utils/logger";

export interface AlbumData {
  settings: Partial<GradientSettings>;
  colors: string[];
}

interface AlbumSettings {
  [albumArtUrl: string]: AlbumData;
}

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

const generateAlbumKey = (albumArtUrl: string): string => {
  return albumArtUrl.split("?")[0];
};

export const loadAlbumSettings = async (albumArtUrl: string): Promise<AlbumData | null> => {
  try {
    const allAlbumSettings = await storage.get<AlbumSettings>(ALBUM_SETTINGS_STORAGE_KEY);
    if (!allAlbumSettings) {
      logger.log("No album settings found in storage");
      return null;
    }

    const albumKey = generateAlbumKey(albumArtUrl);
    const albumData = allAlbumSettings[albumKey];

    if (albumData) {
      logger.log(`Loaded album data for: ${albumKey}`, {
        hasSettings: Object.keys(albumData.settings || {}).length > 0,
        colorCount: albumData.colors?.length || 0
      });
    } else {
      logger.log(`No saved data for album: ${albumKey}`);
    }

    return albumData || null;
  } catch (error) {
    logger.error("Error loading album-specific settings from storage:", error);
    return null;
  }
};

export const saveAlbumSettings = async (
  albumArtUrl: string,
  settings: GradientSettings,
  colors: string[]
): Promise<void> => {
  try {
    const allAlbumSettings = await storage.get<AlbumSettings>(ALBUM_SETTINGS_STORAGE_KEY) || {};
    const albumKey = generateAlbumKey(albumArtUrl);

    const { rememberAlbumSettings, showLogs, showOnHomepage, ...settingsToSave } = settings;

    allAlbumSettings[albumKey] = {
      settings: settingsToSave,
      colors: colors
    };

    await storage.set(ALBUM_SETTINGS_STORAGE_KEY, allAlbumSettings);

    logger.log(`Saved album data for: ${albumKey}`, {
      settingsCount: Object.keys(settingsToSave).length,
      colorCount: colors.length,
      colors: colors
    });
  } catch (error) {
    logger.error("Error saving album-specific settings to storage:", error);
  }
};

export const clearAllAlbumSettings = async (): Promise<void> => {
  try {
    await storage.remove(ALBUM_SETTINGS_STORAGE_KEY);
    logger.log("Cleared all album-specific settings");
  } catch (error) {
    logger.error("Error clearing album-specific settings:", error);
  }
};
