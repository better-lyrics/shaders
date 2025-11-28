import Kawarp from "@kawarp/core";
import type { DynamicMultipliers, GradientSettings } from "../../shared/constants/gradientSettings";
import { logger } from "../../shared/utils/logger";

interface KawarpState {
  container: HTMLDivElement | null;
  canvas: HTMLCanvasElement | null;
  instance: Kawarp | null;
  currentImageUrl: string | null;
  lastSettings: GradientSettings | null;
  lastMultipliers: DynamicMultipliers | null;
  observer: IntersectionObserver | null;
  isVisible: boolean;
}

const createEmptyState = (): KawarpState => ({
  container: null,
  canvas: null,
  instance: null,
  currentImageUrl: null,
  lastSettings: null,
  lastMultipliers: null,
  observer: null,
  isVisible: true,
});

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
    a.opacity === b.opacity
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

const waitForTargetReady = async (targetSelector: string): Promise<boolean> => {
  return new Promise(resolve => {
    const checkReady = () => {
      const target = getTargetElement(targetSelector);
      const hasContent = target && target.children.length > 0;

      if (hasContent) {
        const delay = targetSelector === "player-page" ? 1000 : 100;
        setTimeout(() => resolve(true), delay);
      } else {
        setTimeout(checkReady, 500);
      }
    };
    checkReady();
  });
};

const getAlbumArtUrl = (): string | null => {
  const songImage = document.querySelector("#song-image img") as HTMLImageElement;
  if (songImage?.src && !songImage.src.startsWith("data:")) {
    return songImage.src;
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
      transition: opacity 0.5s ease-out, transform 0.15s ease-out;
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
      transition: opacity 0.5s ease-out, transform 0.15s ease-out;
    `;

  state.canvas = document.createElement("canvas");
  state.canvas.style.cssText = `
    width: 100%;
    height: 100%;
    display: block;
  `;
  state.container.appendChild(state.canvas);

  targetElement.insertBefore(state.container, targetElement.firstChild);

  const dynamicSpeed = settings.kawarpAnimationSpeed * multipliers.speedMultiplier;

  state.instance = new Kawarp(state.canvas, {
    warpIntensity: settings.kawarpWarpIntensity,
    blurPasses: settings.kawarpBlurPasses,
    animationSpeed: dynamicSpeed,
    transitionDuration: settings.kawarpTransitionDuration,
    saturation: settings.kawarpSaturation,
    dithering: settings.kawarpDithering,
  });

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

  requestAnimationFrame(() => {
    if (state.container) {
      state.container.style.opacity = settings.opacity.toString();
    }
  });

  return true;
};

export const destroyKawarp = (location?: string): void => {
  if (location) {
    const state = getKawarpState(location);
    logger.log(`Destroying kawarp for location: ${location}`);

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
    state.canvas = null;
    state.currentImageUrl = null;
    state.lastSettings = null;
    state.lastMultipliers = null;
    state.isVisible = true;

    kawarps.delete(location);
  } else {
    logger.log("Destroying all kawarps");
    for (const loc of kawarps.keys()) {
      destroyKawarp(loc);
    }
  }
};

export const updateKawarpImage = async (location: string = "player"): Promise<void> => {
  const state = getKawarpState(location);

  if (!state.instance || !state.container) return;

  const albumArtUrl = getAlbumArtUrl();
  if (albumArtUrl && albumArtUrl !== state.currentImageUrl) {
    try {
      await state.instance.loadImage(albumArtUrl);
      state.currentImageUrl = albumArtUrl;
      lastKnownImageUrl = albumArtUrl;
      logger.log(`Updated kawarp image for ${location}:`, albumArtUrl);
    } catch (error) {
      logger.error("Failed to update kawarp image:", error);
    }
  }
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
      state.container.style.transform = `scale(${multipliers.scaleMultiplier})`;
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

    if (state.container && state.container.style.opacity !== settings.opacity.toString()) {
      state.container.style.opacity = settings.opacity.toString();
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
