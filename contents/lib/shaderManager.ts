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

const getCachedColorVector = (color: string): number[] => {
  if (!colorVectorCache.has(color)) {
    colorVectorCache.set(color, getShaderColorFromString(color) as number[]);
  }
  return colorVectorCache.get(color)!;
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
      position: absolute;
      top: -64px;
      left: -72px;
      width: calc(100% + 72px);
      height: calc(100% + 128px);
      pointer-events: none;
      z-index: 0;
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
          // Pause shader when not visible, resume when visible
          state.mount.setSpeed(isVisible ? settings.speed * multipliers.speedMultiplier : 0);
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

  const colorsChanged = JSON.stringify(colors) !== JSON.stringify(state.colors);

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

    if (!state.mount || !state.container || state.colorVectors.length === 0) return;

    const settingsChanged = JSON.stringify(settings) !== JSON.stringify(state.lastSettings);
    const multipliersChanged = JSON.stringify(multipliers) !== JSON.stringify(state.lastMultipliers);

    if (!settingsChanged && !multipliersChanged) return;

    const uniforms = buildMeshGradientUniforms(state.colorVectors, settings, multipliers);
    const speed = settings.speed * multipliers.speedMultiplier;

    state.mount.setUniforms(uniforms as any);
    state.mount.setSpeed(state.isVisible ? speed : 0);

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
  logger.log("getCurrentColors called - lastKnownColors:", lastKnownColors);
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
