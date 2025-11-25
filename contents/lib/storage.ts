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
  lastAccessed?: number;
}

interface AlbumSettings {
  [albumArtUrl: string]: AlbumData;
}

const MAX_STORED_ALBUMS = 50;

const storage = new Storage();
const albumStorage = new Storage({ area: "local" });

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
    const allAlbumSettings = await albumStorage.get<AlbumSettings>(ALBUM_SETTINGS_STORAGE_KEY);
    if (!allAlbumSettings) {
      return null;
    }

    const albumKey = generateAlbumKey(albumArtUrl);
    const albumData = allAlbumSettings[albumKey];

    if (albumData) {
      albumData.lastAccessed = Date.now();
      allAlbumSettings[albumKey] = albumData;
      albumStorage.set(ALBUM_SETTINGS_STORAGE_KEY, allAlbumSettings);
    }

    return albumData || null;
  } catch (error) {
    logger.error("Error loading album-specific settings from storage:", error);
    return null;
  }
};

const evictOldestAlbums = (albumSettings: AlbumSettings): AlbumSettings => {
  const entries = Object.entries(albumSettings);
  if (entries.length <= MAX_STORED_ALBUMS) {
    return albumSettings;
  }

  entries.sort((a, b) => (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0));

  const toKeep = entries.slice(entries.length - MAX_STORED_ALBUMS);
  return Object.fromEntries(toKeep);
};

export const saveAlbumColors = async (
  albumArtUrl: string,
  colors: string[],
  colorsManuallyModified: boolean = false
): Promise<void> => {
  try {
    let allAlbumSettings = (await albumStorage.get<AlbumSettings>(ALBUM_SETTINGS_STORAGE_KEY)) || {};
    const albumKey = generateAlbumKey(albumArtUrl);

    const existingData = allAlbumSettings[albumKey];
    const wasManuallyModified = colorsManuallyModified || existingData?.colorsManuallyModified || false;

    allAlbumSettings[albumKey] = {
      colors: colors,
      colorsManuallyModified: wasManuallyModified,
      lastAccessed: Date.now(),
    };

    allAlbumSettings = evictOldestAlbums(allAlbumSettings);

    await albumStorage.set(ALBUM_SETTINGS_STORAGE_KEY, allAlbumSettings);
  } catch (error) {
    logger.error("Error saving album colors to storage:", error);
  }
};

export const clearAllAlbumSettings = async (): Promise<void> => {
  try {
    await albumStorage.remove(ALBUM_SETTINGS_STORAGE_KEY);
  } catch (error) {
    logger.error("Error clearing album-specific settings:", error);
  }
};
