import Kawarp from "@kawarp/core";
import type { DynamicMultipliers, GradientSettings } from "../../shared/constants/gradientSettings";
import { logger } from "../../shared/utils/logger";

interface KawarpState {
  backdrop: HTMLDivElement | null;
  container: HTMLDivElement | null;
  canvas: HTMLCanvasElement | null;
  instance: Kawarp | null;
  currentImageUrl: string | null;
  lastSettings: GradientSettings | null;
  lastMultipliers: DynamicMultipliers | null;
  observer: IntersectionObserver | null;
  isVisible: boolean;
  isTransitioning: boolean;
  pendingImageUrl: string | null;
  transitionTimeoutId: number | null;
  currentScale: number;
  targetScale: number;
  scaleAnimationId: number | null;
  currentSpeed: number;
  targetSpeed: number;
  speedAnimationId: number | null;
  isPaused: boolean;
}

const createEmptyState = (): KawarpState => ({
  backdrop: null,
  container: null,
  canvas: null,
  instance: null,
  currentImageUrl: null,
  lastSettings: null,
  lastMultipliers: null,
  observer: null,
  isVisible: true,
  isTransitioning: false,
  pendingImageUrl: null,
  transitionTimeoutId: null,
  currentScale: 1,
  targetScale: 1,
  scaleAnimationId: null,
  currentSpeed: 1,
  targetSpeed: 1,
  speedAnimationId: null,
  isPaused: false,
});

const SCALE_LERP_UP = 0.5;
const SCALE_LERP_DOWN = 0.12;
const SCALE_THRESHOLD = 0.001;

const SPEED_LERP_UP = 0.05;
const SPEED_LERP_DOWN = 0.03;
const SPEED_THRESHOLD = 0.001;

const animateScale = (state: KawarpState): void => {
  if (!state.instance) {
    state.scaleAnimationId = null;
    return;
  }

  const diff = state.targetScale - state.currentScale;

  if (Math.abs(diff) < SCALE_THRESHOLD) {
    state.currentScale = state.targetScale;
    state.instance.setOptions({ scale: state.currentScale });
    state.scaleAnimationId = null;
    return;
  }

  const lerpFactor = diff > 0 ? SCALE_LERP_UP : SCALE_LERP_DOWN;
  state.currentScale += diff * lerpFactor;
  state.instance.setOptions({ scale: state.currentScale });

  state.scaleAnimationId = requestAnimationFrame(() => animateScale(state));
};

const animateSpeed = (state: KawarpState): void => {
  if (!state.instance) {
    state.speedAnimationId = null;
    return;
  }

  const diff = state.targetSpeed - state.currentSpeed;

  if (Math.abs(diff) < SPEED_THRESHOLD) {
    state.currentSpeed = state.targetSpeed;
    state.instance.animationSpeed = state.currentSpeed;
    state.speedAnimationId = null;
    if (state.currentSpeed === 0) {
      state.instance.stop();
    }
    return;
  }

  const lerpFactor = diff > 0 ? SPEED_LERP_UP : SPEED_LERP_DOWN;
  state.currentSpeed += diff * lerpFactor;
  state.instance.animationSpeed = state.currentSpeed;

  state.speedAnimationId = requestAnimationFrame(() => animateSpeed(state));
};

const kawarps = new Map<string, KawarpState>();
let lastKnownImageUrl: string | null = null;

const getKawarpState = (location: string): KawarpState => {
  if (!kawarps.has(location)) {
    kawarps.set(location, createEmptyState());
  }
  return kawarps.get(location)!;
};

const settingsEqual = (a: GradientSettings | null, b: GradientSettings): boolean => {
  if (!a) return false;
  return (
    a.kawarpWarpIntensity === b.kawarpWarpIntensity &&
    a.kawarpBlurPasses === b.kawarpBlurPasses &&
    a.kawarpAnimationSpeed === b.kawarpAnimationSpeed &&
    a.kawarpSaturation === b.kawarpSaturation &&
    a.kawarpDithering === b.kawarpDithering &&
    a.kawarpOpacity === b.kawarpOpacity
  );
};

const getLocationFromSelector = (targetSelector: string): string => {
  if (targetSelector === "player-page") return "player";
  if (targetSelector === "search-page") return "search";
  return "homepage";
};

const getTargetElement = (targetSelector: string): Element | null => {
  if (targetSelector === "player-page") {
    return document.getElementById("player-page");
  }
  if (targetSelector === "search-page") {
    return document.getElementById("search-page");
  }
  return document.querySelector(".background-gradient.style-scope.ytmusic-browse-response");
};

const waitForTargetReady = async (targetSelector: string, maxWaitMs: number = 5000): Promise<boolean> => {
  const target = getTargetElement(targetSelector);
  const hasContent = target && target.children.length > 0;

  if (hasContent) {
    const delay = targetSelector === "player-page" ? 1000 : 100;
    await new Promise(resolve => setTimeout(resolve, delay));
    return true;
  }

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, maxWaitMs);

    const observer = new MutationObserver(() => {
      const target = getTargetElement(targetSelector);
      if (target && target.children.length > 0) {
        clearTimeout(timeout);
        observer.disconnect();
        const delay = targetSelector === "player-page" ? 1000 : 100;
        setTimeout(() => resolve(true), delay);
      }
    });

    const appElement = document.querySelector("ytmusic-app");
    if (appElement) {
      observer.observe(appElement, { childList: true, subtree: true });
    } else {
      clearTimeout(timeout);
      resolve(false);
    }
  });
};

const getVideoIdFromUrl = (): string | null => {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
};

const getAlbumArtUrl = (): string | null => {
  const songImage = document.querySelector("#song-image img") as HTMLImageElement;
  if (songImage?.src && !songImage.src.startsWith("data:") && songImage.naturalHeight > 0) {
    return songImage.src;
  }

  const videoId = getVideoIdFromUrl();
  if (videoId) {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }

  const playerBarThumbnail = document.querySelector(
    "ytmusic-player-bar .thumbnail img, .middle-controls .thumbnail img"
  ) as HTMLImageElement;
  if (playerBarThumbnail?.src && !playerBarThumbnail.src.startsWith("data:") && playerBarThumbnail.naturalHeight > 0) {
    return playerBarThumbnail.src;
  }

  return null;
};

export const createKawarp = async (
  settings: GradientSettings,
  multipliers: DynamicMultipliers,
  targetSelector: string = "player-page"
): Promise<boolean> => {
  const location = getLocationFromSelector(targetSelector);
  const state = getKawarpState(location);

  if (state.instance) {
    logger.log(`Kawarp already exists for ${location}, destroying first`);
    destroyKawarp(location);
  }

  const isReady = await waitForTargetReady(targetSelector);
  if (!isReady) return false;

  const targetElement = getTargetElement(targetSelector);

  logger.log("createKawarp - targetSelector:", targetSelector, "targetElement found:", !!targetElement);

  if (!targetElement) {
    logger.error("Target element not found for selector:", targetSelector);
    return false;
  }

  const existingKawarp = targetElement.querySelector(`#better-lyrics-kawarp-${location}`);
  if (existingKawarp) {
    existingKawarp.remove();
  }

  state.container = document.createElement("div");
  state.container.id = `better-lyrics-kawarp-${location}`;
  const isBrowsePage = targetSelector !== "player-page";

  state.backdrop = document.createElement("div");
  state.backdrop.id = `better-lyrics-kawarp-backdrop-${location}`;
  state.backdrop.style.cssText = isBrowsePage
    ? `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 0;
      background-color: #000;
      opacity: 0;
      will-change: opacity;
      transition: opacity 0.5s ease-out;
    `
    : `
      --sidebar: 240px;
      position: absolute;
      top: -64px;
      left: calc(-1 * var(--sidebar));
      width: calc(100% + var(--sidebar));
      height: calc(100% + 128px);
      pointer-events: none;
      z-index: -2;
      background-color: #000;
      opacity: 0;
      will-change: opacity;
      transition: opacity 0.5s ease-out;
    `;

  state.container.style.cssText = isBrowsePage
    ? `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 0;
      opacity: 0;
      will-change: opacity, transform;
      transition: opacity 0.5s ease-out;
    `
    : `
      --sidebar: 240px;
      position: absolute;
      top: -64px;
      left: calc(-1 * var(--sidebar));
      width: calc(100% + var(--sidebar));
      height: calc(100% + 128px);
      pointer-events: none;
      z-index: -1;
      opacity: 0;
      will-change: opacity, transform;
      transition: opacity 0.5s ease-out;
    `;

  state.canvas = document.createElement("canvas");
  state.canvas.style.cssText = `
    width: 100%;
    height: 100%;
    display: block;
  `;
  state.container.appendChild(state.canvas);

  targetElement.insertBefore(state.backdrop, targetElement.firstChild);
  targetElement.insertBefore(state.container, state.backdrop.nextSibling);

  const dynamicSpeed = settings.kawarpAnimationSpeed * multipliers.speedMultiplier;

  state.instance = new Kawarp(state.canvas, {
    warpIntensity: settings.kawarpWarpIntensity,
    blurPasses: settings.kawarpBlurPasses,
    animationSpeed: dynamicSpeed,
    transitionDuration: settings.kawarpTransitionDuration,
    saturation: settings.kawarpSaturation,
    dithering: settings.kawarpDithering,
    scale: 1,
  });

  state.currentSpeed = dynamicSpeed;
  state.targetSpeed = dynamicSpeed;
  state.lastSettings = { ...settings };
  state.lastMultipliers = { ...multipliers };

  const albumArtUrl = getAlbumArtUrl();
  if (albumArtUrl) {
    try {
      await state.instance.loadImage(albumArtUrl);
      state.currentImageUrl = albumArtUrl;
      lastKnownImageUrl = albumArtUrl;
      logger.log("Kawarp loaded album art:", albumArtUrl);
    } catch (error) {
      logger.error("Failed to load album art for kawarp:", error);
    }
  }

  state.instance.start();

  state.observer = new IntersectionObserver(
    entries => {
      const entry = entries[0];
      const isVisible = entry.isIntersecting;

      if (state.isVisible !== isVisible) {
        state.isVisible = isVisible;
        if (state.instance) {
          if (isVisible) {
            state.instance.start();
          } else {
            state.instance.stop();
          }
        }
      }
    },
    { threshold: 0.1 }
  );

  state.observer.observe(state.container);

  void state.container.offsetHeight;

  // Delay fade-in to let kawarp render a few frames first
  setTimeout(() => {
    requestAnimationFrame(() => {
      if (state.container) {
        state.container.style.opacity = settings.kawarpOpacity.toString();
      }
      if (state.backdrop) {
        state.backdrop.style.opacity = "1";
      }
    });
  }, 300);

  return true;
};

export const destroyKawarp = (location?: string): void => {
  if (location) {
    const state = getKawarpState(location);
    logger.log(`Destroying kawarp for location: ${location}`);

    if (state.transitionTimeoutId !== null) {
      clearTimeout(state.transitionTimeoutId);
      state.transitionTimeoutId = null;
    }
    if (state.scaleAnimationId !== null) {
      cancelAnimationFrame(state.scaleAnimationId);
      state.scaleAnimationId = null;
    }
    if (state.speedAnimationId !== null) {
      cancelAnimationFrame(state.speedAnimationId);
      state.speedAnimationId = null;
    }
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    if (state.instance) {
      state.instance.stop();
      state.instance.dispose();
      state.instance = null;
    }
    if (state.container) {
      state.container.remove();
      state.container = null;
    }
    if (state.backdrop) {
      state.backdrop.remove();
      state.backdrop = null;
    }
    state.canvas = null;
    state.currentImageUrl = null;
    state.lastSettings = null;
    state.lastMultipliers = null;
    state.isVisible = true;
    state.isTransitioning = false;
    state.pendingImageUrl = null;
    state.currentScale = 1;
    state.targetScale = 1;
    state.currentSpeed = 1;
    state.targetSpeed = 1;
    state.isPaused = false;

    kawarps.delete(location);
  } else {
    logger.log("Destroying all kawarps");
    for (const loc of kawarps.keys()) {
      destroyKawarp(loc);
    }
  }
};

const processImageTransition = async (state: KawarpState, imageUrl: string, location: string): Promise<void> => {
  if (!state.instance || !state.container) return;

  const transitionDuration = state.lastSettings?.kawarpTransitionDuration ?? 1000;

  state.isTransitioning = true;

  if (state.transitionTimeoutId !== null) {
    clearTimeout(state.transitionTimeoutId);
  }

  try {
    await state.instance.loadImage(imageUrl);
    state.currentImageUrl = imageUrl;
    lastKnownImageUrl = imageUrl;
    logger.log(`Updated kawarp image for ${location}:`, imageUrl);
  } catch (error) {
    logger.error("Failed to update kawarp image:", error);
    state.isTransitioning = false;
    return;
  }

  state.transitionTimeoutId = window.setTimeout(() => {
    state.isTransitioning = false;
    state.transitionTimeoutId = null;

    if (state.pendingImageUrl && state.pendingImageUrl !== state.currentImageUrl) {
      const pendingUrl = state.pendingImageUrl;
      state.pendingImageUrl = null;
      logger.log(`Processing queued image for ${location}:`, pendingUrl);
      processImageTransition(state, pendingUrl, location);
    }
  }, transitionDuration);
};

export const updateKawarpImage = async (location: string = "player"): Promise<void> => {
  const state = getKawarpState(location);

  if (!state.instance || !state.container) return;

  const albumArtUrl = getAlbumArtUrl();
  if (!albumArtUrl || albumArtUrl === state.currentImageUrl) return;

  if (state.isTransitioning) {
    logger.log(`Transition in progress for ${location}, queueing image:`, albumArtUrl);
    state.pendingImageUrl = albumArtUrl;
    return;
  }

  await processImageTransition(state, albumArtUrl, location);
};

export const updateKawarpSpeed = (
  settings: GradientSettings,
  multipliers: DynamicMultipliers,
  location?: string
): void => {
  const updateForLocation = (loc: string) => {
    const state = getKawarpState(loc);

    if (!state.instance || !state.container) {
      return;
    }

    const speedChanged = state.lastMultipliers?.speedMultiplier !== multipliers.speedMultiplier;
    const scaleChanged = state.lastMultipliers?.scaleMultiplier !== multipliers.scaleMultiplier;

    if (!speedChanged && !scaleChanged) {
      return;
    }

    if (speedChanged) {
      const dynamicSpeed = settings.kawarpAnimationSpeed * multipliers.speedMultiplier;
      state.instance.animationSpeed = dynamicSpeed;
    }

    if (scaleChanged) {
      state.targetScale = multipliers.scaleMultiplier;
      if (state.scaleAnimationId === null) {
        state.scaleAnimationId = requestAnimationFrame(() => animateScale(state));
      }
    }

    state.lastMultipliers = { ...multipliers };
  };

  if (location) {
    updateForLocation(location);
  } else {
    for (const loc of kawarps.keys()) {
      updateForLocation(loc);
    }
  }
};

export const updateKawarpSettings = (
  settings: GradientSettings,
  multipliers: DynamicMultipliers,
  location?: string
): void => {
  const updateForLocation = (loc: string) => {
    const state = getKawarpState(loc);

    if (!state.instance || !state.container) {
      return;
    }

    if (settingsEqual(state.lastSettings, settings)) {
      return;
    }

    const dynamicSpeed = settings.kawarpAnimationSpeed * multipliers.speedMultiplier;

    state.instance.setOptions({
      warpIntensity: settings.kawarpWarpIntensity,
      blurPasses: settings.kawarpBlurPasses,
      animationSpeed: dynamicSpeed,
      saturation: settings.kawarpSaturation,
      dithering: settings.kawarpDithering,
    });

    state.lastSettings = { ...settings };
    state.lastMultipliers = { ...multipliers };

    const opacityStr = settings.kawarpOpacity.toString();
    if (state.container && state.container.style.opacity !== opacityStr) {
      state.container.style.opacity = opacityStr;
    }
  };

  if (location) {
    updateForLocation(location);
  } else {
    for (const loc of kawarps.keys()) {
      updateForLocation(loc);
    }
  }
};

export const hasKawarp = (location?: string): boolean => {
  if (location) {
    const state = getKawarpState(location);
    return state.instance !== null && state.container !== null;
  }
  return kawarps.size > 0 && Array.from(kawarps.values()).some(s => s.instance !== null);
};

export const getCurrentImageUrl = (): string | null => {
  return lastKnownImageUrl;
};

export const cleanupOrphanedKawarps = (): void => {
  const existingKawarps = document.querySelectorAll("[id^='better-lyrics-kawarp']");
  existingKawarps.forEach(kawarp => kawarp.remove());
  logger.log("Cleaned up orphaned kawarps:", existingKawarps.length);
};

export const pauseKawarp = (location?: string): void => {
  const pauseForLocation = (loc: string) => {
    const state = getKawarpState(loc);
    if (!state.instance || state.isPaused) return;

    state.isPaused = true;
    state.targetSpeed = 0;

    if (state.speedAnimationId === null) {
      state.speedAnimationId = requestAnimationFrame(() => animateSpeed(state));
    }
  };

  if (location) {
    pauseForLocation(location);
  } else {
    for (const loc of kawarps.keys()) {
      pauseForLocation(loc);
    }
  }
};

export const resumeKawarp = (location?: string): void => {
  const resumeForLocation = (loc: string) => {
    const state = getKawarpState(loc);
    if (!state.instance || !state.isVisible || !state.isPaused) return;

    state.isPaused = false;
    state.instance.start();

    const baseSpeed = state.lastSettings?.kawarpAnimationSpeed ?? 1;
    const multiplier = state.lastMultipliers?.speedMultiplier ?? 1;
    state.targetSpeed = baseSpeed * multiplier;

    if (state.speedAnimationId === null) {
      state.speedAnimationId = requestAnimationFrame(() => animateSpeed(state));
    }
  };

  if (location) {
    resumeForLocation(location);
  } else {
    for (const loc of kawarps.keys()) {
      resumeForLocation(loc);
    }
  }
};
