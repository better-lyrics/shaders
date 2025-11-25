import { Storage } from "@plasmohq/storage";
import {
  DEFAULT_GRADIENT_SETTINGS,
  GRADIENT_SETTINGS_STORAGE_KEY,
  ALBUM_SETTINGS_STORAGE_KEY,
  type GradientSettings,
} from "../../shared/constants/gradientSettings";
import { logger } from "../../shared/utils/logger";

export interface AlbumData {
  colors: string[];
  colorsManuallyModified?: boolean;
}

interface AlbumSettings {
  [albumArtUrl: string]: AlbumData;
}

const storage = new Storage();

export const loadGradientSettings = async (): Promise<GradientSettings> => {
  try {
    const storedSettings = await storage.get<GradientSettings & { showOnHomepage?: boolean }>(
      GRADIENT_SETTINGS_STORAGE_KEY
    );
    if (storedSettings) {
      const { showOnHomepage, ...rest } = storedSettings;
      const migrated = {
        ...DEFAULT_GRADIENT_SETTINGS,
        ...rest,
        showOnBrowsePages: rest.showOnBrowsePages ?? showOnHomepage ?? DEFAULT_GRADIENT_SETTINGS.showOnBrowsePages,
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
        colorCount: albumData.colors?.length || 0,
        colorsManuallyModified: albumData.colorsManuallyModified || false,
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

export const saveAlbumColors = async (
  albumArtUrl: string,
  colors: string[],
  colorsManuallyModified: boolean = false
): Promise<void> => {
  try {
    const allAlbumSettings = (await storage.get<AlbumSettings>(ALBUM_SETTINGS_STORAGE_KEY)) || {};
    const albumKey = generateAlbumKey(albumArtUrl);

    const existingData = allAlbumSettings[albumKey];
    const wasManuallyModified = colorsManuallyModified || existingData?.colorsManuallyModified || false;

    allAlbumSettings[albumKey] = {
      colors: colors,
      colorsManuallyModified: wasManuallyModified,
    };

    await storage.set(ALBUM_SETTINGS_STORAGE_KEY, allAlbumSettings);

    logger.log(`Saved album colors for: ${albumKey}`, {
      colorCount: colors.length,
      colors: colors,
      colorsManuallyModified: wasManuallyModified,
    });
  } catch (error) {
    logger.error("Error saving album colors to storage:", error);
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
