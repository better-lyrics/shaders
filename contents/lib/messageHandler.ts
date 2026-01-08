import browser from "webextension-polyfill";
import type { GradientSettings } from "../../shared/constants/gradientSettings";

interface MessageHandlers {
  onColorsUpdate: (colors: string[], pageType?: "player" | "homepage" | "search") => Promise<void>;
  onSettingsUpdate: (settings: GradientSettings) => Promise<void>;
  getCurrentData: () => {
    colors: string[];
    songTitle: string;
    songAuthor: string;
    gradientSettings: GradientSettings;
  };
}

interface Message {
  action: string;
  colors?: string[];
  settings?: GradientSettings;
}

export const setupMessageListener = (handlers: MessageHandlers): void => {
  browser.runtime.onMessage.addListener((msg: unknown) => {
    const message = msg as Message;

    if (message.action === "getCurrentData" || message.action === "getCurrentColors") {
      return Promise.resolve(handlers.getCurrentData());
    }

    if (message.action === "updateColors" && message.colors) {
      return handlers.onColorsUpdate(message.colors).then(() => ({ success: true }));
    }

    if (message.action === "updateGradientSettings" && message.settings) {
      return handlers.onSettingsUpdate(message.settings).then(() => ({ success: true }));
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
