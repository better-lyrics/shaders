import { logger } from "@/shared/utils/logger";
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
let visibilityPollInterval: NodeJS.Timeout | null = null;
let lastVisibilityState: DocumentVisibilityState = "visible";
let hiddenTimestamp = 0;

export const initialize = (updateCallback: UpdateCallback, navigationChangeCallback?: NavigationCallback): void => {
  let timeoutId: NodeJS.Timeout;
  let isProcessing = false;
  let processingStartedAt = 0;
  const PROCESSING_WATCHDOG_MS = 30000;

  debouncedUpdate = () => {
    if (isProcessing) {
      if (Date.now() - processingStartedAt > PROCESSING_WATCHDOG_MS) {
        logger.error("debouncedUpdate stuck for >30s, force-resetting");
        isProcessing = false;
      } else {
        return;
      }
    }

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      isProcessing = true;
      processingStartedAt = Date.now();
      Promise.resolve(updateCallback()).finally(() => {
        isProcessing = false;
      });
    }, 300);
  };

  onNavigationChange = navigationChangeCallback ?? null;

  setupSongImageObserver();
  setupNavigationListener();
  setupVideoPlayListener();
  setupPlayerPageObserver();
  setupVisibilityHandler();
};

const setupSongImageObserver = (): void => {
  if (!debouncedUpdate) return;

  songImageObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type !== "attributes" || mutation.attributeName !== "src") continue;
      const target = mutation.target;
      if (!(target instanceof Element)) continue;
      if (!target.closest("#song-image, ytmusic-player-bar .thumbnail")) continue;
      debouncedUpdate?.();
      return;
    }
  });

  const attachObserver = () => {
    const app = document.querySelector("ytmusic-app");
    if (app && songImageObserver) {
      songImageObserver.observe(app, {
        subtree: true,
        attributes: true,
        attributeFilter: ["src"],
      });
      waitForSongImageTimeoutId = null;
    } else {
      waitForSongImageTimeoutId = window.setTimeout(attachObserver, 1000);
    }
  };

  attachObserver();
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

const setupVisibilityHandler = (): void => {
  // YouTube Music blocks visibilitychange events, so we poll instead
  const POLL_INTERVAL = 5000; // 5 seconds
  const MIN_HIDDEN_DURATION = 60000; // 1 minute

  visibilityPollInterval = setInterval(() => {
    const currentState = document.visibilityState;
    if (currentState !== lastVisibilityState) {
      if (currentState === "hidden") {
        hiddenTimestamp = Date.now();
        logger.log("Tab hidden");
      } else if (currentState === "visible" && lastVisibilityState === "hidden") {
        const hiddenDuration = Date.now() - hiddenTimestamp;
        if (hiddenDuration >= MIN_HIDDEN_DURATION) {
          logger.log(`Tab visible after ${Math.round(hiddenDuration / 1000)}s, refreshing gradient`);
          onNavigationChange?.();
          debouncedUpdate?.();
        } else {
          logger.log(`Tab visible after ${Math.round(hiddenDuration / 1000)}s, skipping refresh`);
        }
      }
      lastVisibilityState = currentState;
    }
  }, POLL_INTERVAL);

  logger.log("Visibility polling started");
};

export const cleanup = (): void => {
  if (visibilityPollInterval) {
    clearInterval(visibilityPollInterval);
    visibilityPollInterval = null;
    lastVisibilityState = "visible";
    hiddenTimestamp = 0;
  }

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
