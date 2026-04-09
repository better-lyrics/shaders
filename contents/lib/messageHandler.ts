import browser from "webextension-polyfill";
import type { GradientSettings } from "@/shared/constants/gradientSettings";
import type { CacheInfo } from "./animatedArtManager";

interface MessageHandlers {
  onSettingsUpdate: (settings: GradientSettings) => Promise<void>;
  getCurrentData: () => {
    songTitle: string;
    songAuthor: string;
    gradientSettings: GradientSettings;
  };
  getCacheInfo: () => Promise<CacheInfo>;
  getCacheEntries: () => Promise<Record<string, unknown>>;
  importAnimatedArtCache: (entries: Record<string, unknown>) => Promise<{ imported: number }>;
  clearAnimatedArtCache: () => Promise<{ cleared: number }>;
}

interface Message {
  action: string;
  settings?: GradientSettings;
  entries?: Record<string, unknown>;
}

export const setupMessageListener = (handlers: MessageHandlers): void => {
  browser.runtime.onMessage.addListener((msg: unknown) => {
    const message = msg as Message;

    if (message.action === "getCurrentData") {
      return Promise.resolve(handlers.getCurrentData());
    }

    if (message.action === "updateGradientSettings" && message.settings) {
      return handlers.onSettingsUpdate(message.settings).then(() => ({ success: true }));
    }

    if (message.action === "getCacheInfo") {
      return handlers.getCacheInfo();
    }

    if (message.action === "getCacheEntries") {
      return handlers.getCacheEntries();
    }

    if (message.action === "importAnimatedArtCache" && message.entries) {
      return handlers.importAnimatedArtCache(message.entries);
    }

    if (message.action === "clearAnimatedArtCache") {
      return handlers.clearAnimatedArtCache();
    }

    return Promise.resolve(undefined);
  });
};

export const getSongInfo = (): { title: string; author: string } => {
  const songTitleElement = document.querySelector(".title.style-scope.ytmusic-player-bar");
  const songTitle = songTitleElement?.textContent ?? "";

  const songAuthorElement = document.querySelector(".subtitle.style-scope.ytmusic-player-bar");
  const songAuthor = songAuthorElement?.textContent?.split("•")[0] ?? "";

  return {
    title: songTitle,
    author: songAuthor,
  };
};
