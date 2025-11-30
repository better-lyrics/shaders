import { ShaderMount, meshGradientFragmentShader, getShaderColorFromString } from "@paper-design/shaders";
import type { DynamicMultipliers, GradientSettings } from "../../shared/constants/gradientSettings";
import { logger } from "../../shared/utils/logger";

interface ShaderState {
  container: HTMLDivElement | null;
  mount: ShaderMount | null;
  colors: string[];
  colorVectors: number[][];
  lastSettings: GradientSettings | null;
  lastMultipliers: DynamicMultipliers | null;
  observer: IntersectionObserver | null;
  isVisible: boolean;
  currentSpeed: number;
  targetSpeed: number;
  speedAnimationId: number | null;
  isPaused: boolean;
}

const createEmptyState = (): ShaderState => ({
  container: null,
  mount: null,
  colors: [],
  colorVectors: [],
  lastSettings: null,
  lastMultipliers: null,
  observer: null,
  isVisible: true,
  currentSpeed: 0.5,
  targetSpeed: 0.5,
  speedAnimationId: null,
  isPaused: false,
});

const shaders = new Map<string, ShaderState>();
let lastKnownColors: string[] = [];

const getShaderState = (location: string): ShaderState => {
  if (!shaders.has(location)) {
    shaders.set(location, createEmptyState());
  }
  return shaders.get(location)!;
};

const colorVectorCache = new Map<string, number[]>();
const MAX_COLOR_CACHE_SIZE = 100;

const SPEED_LERP_UP = 0.05;
const SPEED_LERP_DOWN = 0.03;
const SPEED_THRESHOLD = 0.001;

const animateSpeed = (state: ShaderState): void => {
  if (!state.mount) {
    state.speedAnimationId = null;
    return;
  }

  const diff = state.targetSpeed - state.currentSpeed;

  if (Math.abs(diff) < SPEED_THRESHOLD) {
    state.currentSpeed = state.targetSpeed;
    state.mount.setSpeed(state.currentSpeed);
    state.speedAnimationId = null;
    return;
  }

  const lerpFactor = diff > 0 ? SPEED_LERP_UP : SPEED_LERP_DOWN;
  state.currentSpeed += diff * lerpFactor;
  state.mount.setSpeed(state.currentSpeed);

  state.speedAnimationId = requestAnimationFrame(() => animateSpeed(state));
};

const getCachedColorVector = (color: string): number[] => {
  if (colorVectorCache.has(color)) {
    // LRU: Move to end (most recently used) by re-inserting
    const vector = colorVectorCache.get(color)!;
    colorVectorCache.delete(color);
    colorVectorCache.set(color, vector);
    return vector;
  }

  // Evict oldest (first) entry if at capacity
  if (colorVectorCache.size >= MAX_COLOR_CACHE_SIZE) {
    const firstKey = colorVectorCache.keys().next().value;
    if (firstKey) colorVectorCache.delete(firstKey);
  }

  const vector = getShaderColorFromString(color) as number[];
  colorVectorCache.set(color, vector);
  return vector;
};

const settingsEqual = (a: GradientSettings | null, b: GradientSettings): boolean => {
  if (!a) return false;
  return (
    a.distortion === b.distortion &&
    a.swirl === b.swirl &&
    a.scale === b.scale &&
    a.rotation === b.rotation &&
    a.speed === b.speed &&
    a.opacity === b.opacity &&
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY
  );
};

const multipliersEqual = (a: DynamicMultipliers | null, b: DynamicMultipliers): boolean => {
  if (!a) return false;
  return a.speedMultiplier === b.speedMultiplier && a.scaleMultiplier === b.scaleMultiplier;
};

const colorsEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const buildMeshGradientUniforms = (
  colorVectors: number[][],
  settings: GradientSettings,
  multipliers: DynamicMultipliers
) => {
  const dynamicScale = settings.scale * multipliers.scaleMultiplier;

  return {
    u_colors: colorVectors,
    u_colorsCount: colorVectors.length,
    u_distortion: settings.distortion,
    u_swirl: settings.swirl,
    u_grainMixer: 0,
    u_grainOverlay: 0,
    u_fit: 0,
    u_scale: dynamicScale,
    u_rotation: settings.rotation,
    u_originX: 0.5,
    u_originY: 0.5,
    u_offsetX: settings.offsetX,
    u_offsetY: settings.offsetY,
    u_worldWidth: 0,
    u_worldHeight: 0,
  };
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

export const createShader = async (
  colors: string[],
  settings: GradientSettings,
  multipliers: DynamicMultipliers,
  targetSelector: string = "player-page"
): Promise<boolean> => {
  if (colors.length === 0) return false;

  const location = getLocationFromSelector(targetSelector);
  const state = getShaderState(location);

  if (state.mount) {
    logger.log(`Shader already exists for ${location}, destroying first`);
    destroyShader(location);
  }

  const isReady = await waitForTargetReady(targetSelector);
  if (!isReady) return false;

  const targetElement = getTargetElement(targetSelector);

  logger.log("createShader - targetSelector:", targetSelector, "targetElement found:", !!targetElement);

  if (!targetElement) {
    logger.error("Target element not found for selector:", targetSelector);
    return false;
  }

  const existingGradient = targetElement.querySelector(`#better-lyrics-gradient-${location}`);
  if (existingGradient) {
    existingGradient.remove();
  }

  state.container = document.createElement("div");
  state.container.id = `better-lyrics-gradient-${location}`;
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
      z-index: -1;
      opacity: 0;
      will-change: opacity;
      transition: opacity 0.5s ease-out;
    `;

  targetElement.insertBefore(state.container, targetElement.firstChild);

  state.colors = colors;
  state.colorVectors = colors.map(getCachedColorVector);
  state.lastSettings = { ...settings };
  state.lastMultipliers = { ...multipliers };

  lastKnownColors = [...colors];
  logger.log("Saved lastKnownColors:", lastKnownColors);

  const uniforms = buildMeshGradientUniforms(state.colorVectors, settings, multipliers);
  const speed = settings.speed * multipliers.speedMultiplier;
  state.currentSpeed = speed;
  state.targetSpeed = speed;

  // Performance optimizations: reduce pixel count and anti-aliasing for better GPU performance
  const minPixelRatio = 0.25; // Reduced from default 2.0 for lower anti-aliasing overhead
  const maxPixelCount = 1920 * 1080; // ~2M pixels (1080p @ 1x) instead of default ~8.3M (4K)

  state.mount = new ShaderMount(
    state.container,
    meshGradientFragmentShader,
    uniforms as any,
    undefined, // webGlContextAttributes
    speed,
    undefined, // frame
    minPixelRatio,
    maxPixelCount
  );

  // Setup visibility detection for performance optimization
  state.observer = new IntersectionObserver(
    entries => {
      const entry = entries[0];
      const isVisible = entry.isIntersecting;

      if (state.isVisible !== isVisible) {
        state.isVisible = isVisible;
        if (state.mount) {
          if (isVisible && state.lastSettings && state.lastMultipliers) {
            const speed = state.lastSettings.speed * state.lastMultipliers.speedMultiplier;
            state.mount.setSpeed(speed);
          } else if (!isVisible) {
            state.mount.setSpeed(0);
          }
        }
      }
    },
    { threshold: 0.1 }
  );

  state.observer.observe(state.container);

  // Force reflow to ensure initial opacity: 0 is applied before transition
  void state.container.offsetHeight;

  requestAnimationFrame(() => {
    if (state.container) {
      state.container.style.opacity = settings.opacity.toString();
    }
  });

  return true;
};

export const destroyShader = (location?: string): void => {
  if (location) {
    const state = getShaderState(location);
    logger.log(`Destroying shader for location: ${location}`);

    if (state.speedAnimationId !== null) {
      cancelAnimationFrame(state.speedAnimationId);
      state.speedAnimationId = null;
    }
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    if (state.mount) {
      state.mount.dispose();
      state.mount = null;
    }
    if (state.container) {
      state.container.remove();
      state.container = null;
    }
    state.colors = [];
    state.colorVectors = [];
    state.lastSettings = null;
    state.lastMultipliers = null;
    state.isVisible = true;
    state.currentSpeed = 0.5;
    state.targetSpeed = 0.5;
    state.isPaused = false;

    shaders.delete(location);
  } else {
    logger.log("Destroying all shaders");
    for (const loc of shaders.keys()) {
      destroyShader(loc);
    }
  }
};

export const updateShaderColors = (
  colors: string[],
  settings: GradientSettings,
  multipliers: DynamicMultipliers,
  location: string = "player"
): void => {
  const state = getShaderState(location);

  if (!state.mount || !state.container) return;

  const colorsChanged = !colorsEqual(state.colors, colors);

  if (colorsChanged) {
    state.colors = colors;
    state.colorVectors = colors.map(getCachedColorVector);
    lastKnownColors = [...colors];
    logger.log(`Updated colors for ${location}, lastKnownColors:`, lastKnownColors);
  }

  const uniforms = buildMeshGradientUniforms(state.colorVectors, settings, multipliers);
  state.mount.setUniforms(uniforms as any);

  state.lastSettings = { ...settings };
  state.lastMultipliers = { ...multipliers };

  if (state.container && state.container.style.opacity !== settings.opacity.toString()) {
    state.container.style.opacity = settings.opacity.toString();
  }
};

export const updateShaderSettings = (
  settings: GradientSettings,
  multipliers: DynamicMultipliers,
  location?: string
): void => {
  const updateForLocation = (loc: string) => {
    const state = getShaderState(loc);

    if (!state.mount || !state.container || state.colorVectors.length === 0) {
      return;
    }

    if (settingsEqual(state.lastSettings, settings) && multipliersEqual(state.lastMultipliers, multipliers)) {
      return;
    }

    const uniforms = buildMeshGradientUniforms(state.colorVectors, settings, multipliers);
    const speed = settings.speed * multipliers.speedMultiplier;

    state.mount.setUniforms(uniforms as any);
    state.mount.setSpeed(speed);

    state.lastSettings = { ...settings };
    state.lastMultipliers = { ...multipliers };

    if (state.container && state.container.style.opacity !== settings.opacity.toString()) {
      state.container.style.opacity = settings.opacity.toString();
    }
  };

  if (location) {
    updateForLocation(location);
  } else {
    for (const loc of shaders.keys()) {
      updateForLocation(loc);
    }
  }
};

export const hasShader = (location?: string): boolean => {
  if (location) {
    const state = getShaderState(location);
    return state.mount !== null && state.container !== null;
  }
  return shaders.size > 0 && Array.from(shaders.values()).some(s => s.mount !== null);
};

export const getCurrentColors = (): string[] => {
  return [...lastKnownColors];
};

export const cleanupOrphanedGradients = (): void => {
  const existingGradients = document.querySelectorAll("[id^='better-lyrics-gradient']");
  existingGradients.forEach(gradient => gradient.remove());
  logger.log("Cleaned up orphaned gradients:", existingGradients.length);
};

export const clearColorVectorCache = (): void => {
  colorVectorCache.clear();
};

export const pauseShader = (location?: string): void => {
  const pauseForLocation = (loc: string) => {
    const state = getShaderState(loc);
    if (!state.mount || state.isPaused) return;

    state.isPaused = true;
    state.targetSpeed = 0;

    if (state.speedAnimationId === null) {
      state.speedAnimationId = requestAnimationFrame(() => animateSpeed(state));
    }
  };

  if (location) {
    pauseForLocation(location);
  } else {
    for (const loc of shaders.keys()) {
      pauseForLocation(loc);
    }
  }
};

export const resumeShader = (location?: string): void => {
  const resumeForLocation = (loc: string) => {
    const state = getShaderState(loc);
    if (!state.mount || !state.isVisible || !state.isPaused) return;

    state.isPaused = false;

    const baseSpeed = state.lastSettings?.speed ?? 0.5;
    const multiplier = state.lastMultipliers?.speedMultiplier ?? 1;
    state.targetSpeed = baseSpeed * multiplier;

    if (state.speedAnimationId === null) {
      state.speedAnimationId = requestAnimationFrame(() => animateSpeed(state));
    }
  };

  if (location) {
    resumeForLocation(location);
  } else {
    for (const loc of shaders.keys()) {
      resumeForLocation(loc);
    }
  }
};
