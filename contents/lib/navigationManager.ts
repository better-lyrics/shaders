import { logger } from "../../shared/utils/logger";
import { checkAndReconnectElement } from "./audioAnalysis";

type UpdateCallback = () => void;
type NavigationCallback = () => void;

let navigationHandler: (() => void) | null = null;
let videoPlayHandler: (() => void) | null = null;
let songImageObserver: MutationObserver | null = null;
let playerPageObserver: MutationObserver | null = null;
let videoObserver: MutationObserver | null = null;
let waitForSongImageTimeoutId: number | null = null;
let navigationRetryTimeoutId: NodeJS.Timeout | null = null;

let debouncedUpdate: UpdateCallback | null = null;
let onNavigationChange: NavigationCallback | null = null;

export const initialize = (updateCallback: UpdateCallback, navigationChangeCallback: NavigationCallback): void => {
  let timeoutId: NodeJS.Timeout;
  let isProcessing = false;

  debouncedUpdate = () => {
    if (isProcessing) return;

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      isProcessing = true;
      Promise.resolve(updateCallback()).finally(() => {
        isProcessing = false;
      });
    }, 300);
  };

  onNavigationChange = navigationChangeCallback;

  setupSongImageObserver();
  setupNavigationListener();
  setupVideoPlayListener();
  setupPlayerPageObserver();
};

const setupSongImageObserver = (): void => {
  if (!debouncedUpdate) return;

  songImageObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (
        (mutation.type === "attributes" && mutation.attributeName === "src") ||
        (mutation.type === "childList" && mutation.addedNodes.length > 0)
      ) {
        debouncedUpdate?.();
        break;
      }
    }
  });

  const setupImageObservers = () => {
    const songImage = document.getElementById("song-image");
    if (songImage && songImageObserver) {
      songImageObserver.observe(songImage, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src"],
      });
    }

    const playerBarThumbnail = document.querySelector("ytmusic-player-bar .thumbnail");
    if (playerBarThumbnail && songImageObserver) {
      songImageObserver.observe(playerBarThumbnail, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src"],
      });
    }
  };

  const waitForSongImage = () => {
    const songImage = document.getElementById("song-image");
    const playerBar = document.querySelector("ytmusic-player-bar");
    if ((songImage || playerBar) && songImageObserver) {
      setupImageObservers();
      waitForSongImageTimeoutId = null;
    } else {
      waitForSongImageTimeoutId = window.setTimeout(waitForSongImage, 1000);
    }
  };

  waitForSongImage();
};

const setupNavigationListener = (): void => {
  let lastVideoId = new URL(window.location.href).searchParams.get("v");

  navigationHandler = () => {
    const currentVideoId = new URL(window.location.href).searchParams.get("v");
    if (currentVideoId && currentVideoId !== lastVideoId) {
      logger.log("Video ID changed:", lastVideoId, "->", currentVideoId);
      lastVideoId = currentVideoId;

      checkAndReconnectElement();
      onNavigationChange?.();
      debouncedUpdate?.();

      if (navigationRetryTimeoutId) {
        clearTimeout(navigationRetryTimeoutId);
      }
      navigationRetryTimeoutId = setTimeout(() => {
        logger.log("Navigation retry - checking for updated album art");
        debouncedUpdate?.();
        navigationRetryTimeoutId = null;
      }, 1500);
    }
  };

  document.addEventListener("yt-navigate-finish", navigationHandler);
  window.addEventListener("popstate", navigationHandler);
};

const setupVideoPlayListener = (): void => {
  let lastVideoSrc = "";

  videoPlayHandler = () => {
    const video = document.querySelector("video") as HTMLVideoElement;
    if (video && video.src && video.src !== lastVideoSrc) {
      lastVideoSrc = video.src;
      logger.log("Video source changed - re-extracting colors");

      checkAndReconnectElement();
      onNavigationChange?.();

      setTimeout(() => {
        debouncedUpdate?.();
      }, 500);
    }
  };

  const attachVideoListeners = (video: HTMLVideoElement) => {
    if (!videoPlayHandler) return;
    video.removeEventListener("play", videoPlayHandler);
    video.removeEventListener("loadeddata", videoPlayHandler);
    video.addEventListener("play", videoPlayHandler);
    video.addEventListener("loadeddata", videoPlayHandler);
  };

  const video = document.querySelector("video") as HTMLVideoElement;
  if (video) {
    attachVideoListeners(video);
  }

  videoObserver = new MutationObserver(() => {
    const video = document.querySelector("video") as HTMLVideoElement;
    if (video) {
      attachVideoListeners(video);
    }
  });

  const appElement = document.querySelector("ytmusic-app");
  if (appElement) {
    videoObserver.observe(appElement, { childList: true, subtree: true });
  }
};

const setupPlayerPageObserver = (): void => {
  playerPageObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        const addedPlayerPage = Array.from(mutation.addedNodes).some(
          node => node instanceof Element && node.id === "player-page"
        );
        const removedPlayerPage = Array.from(mutation.removedNodes).some(
          node => node instanceof Element && node.id === "player-page"
        );

        if (addedPlayerPage || removedPlayerPage) {
          debouncedUpdate?.();
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
};

export const cleanup = (): void => {
  if (navigationHandler) {
    document.removeEventListener("yt-navigate-finish", navigationHandler);
    window.removeEventListener("popstate", navigationHandler);
    navigationHandler = null;
  }

  if (videoPlayHandler) {
    const video = document.querySelector("video");
    if (video) {
      video.removeEventListener("play", videoPlayHandler);
      video.removeEventListener("loadeddata", videoPlayHandler);
    }
    videoPlayHandler = null;
  }

  if (navigationRetryTimeoutId !== null) {
    clearTimeout(navigationRetryTimeoutId);
    navigationRetryTimeoutId = null;
  }

  if (waitForSongImageTimeoutId !== null) {
    clearTimeout(waitForSongImageTimeoutId);
    waitForSongImageTimeoutId = null;
  }

  if (songImageObserver) {
    songImageObserver.disconnect();
    songImageObserver = null;
  }

  if (playerPageObserver) {
    playerPageObserver.disconnect();
    playerPageObserver = null;
  }

  if (videoObserver) {
    videoObserver.disconnect();
    videoObserver = null;
  }

  debouncedUpdate = null;
  onNavigationChange = null;
};
