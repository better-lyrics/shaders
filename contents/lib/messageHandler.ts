import type { GradientSettings } from "../../shared/constants/gradientSettings";

interface MessageHandlers {
  onColorsUpdate: (colors: string[]) => void;
  onSettingsUpdate: (settings: GradientSettings) => void;
  getCurrentData: () => {
    colors: string[];
    songTitle: string;
    songAuthor: string;
    gradientSettings: GradientSettings;
  };
}

export const setupMessageListener = (handlers: MessageHandlers): void => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "getCurrentData" || message.action === "getCurrentColors") {
      const data = handlers.getCurrentData();
      sendResponse(data);
      return true;
    }

    if (message.action === "updateColors") {
      handlers.onColorsUpdate(message.colors);
      sendResponse({ success: true });
      return true;
    }

    if (message.action === "updateGradientSettings") {
      handlers.onSettingsUpdate(message.settings);
      sendResponse({ success: true });
      return true;
    }
  });
};

export const getSongInfo = (): { title: string; author: string } => {
  const songTitleElement = document.querySelector(".title.style-scope.ytmusic-player-bar");
  const songTitle = songTitleElement ? songTitleElement.textContent : "";

  const songAuthorElement = document.querySelector(".subtitle.style-scope.ytmusic-player-bar");
  const songAuthor = songAuthorElement ? songAuthorElement.textContent.split("•")[0] : "";

  return {
    title: songTitle,
    author: songAuthor,
  };
};
