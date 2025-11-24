import {
  ShaderMount,
  meshGradientFragmentShader,
  getShaderColorFromString,
} from "@paper-design/shaders";
import type {
  DynamicMultipliers,
  GradientSettings,
} from "../../shared/constants/gradientSettings";

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

const state: ShaderState = {
  container: null,
  mount: null,
  colors: [],
  colorVectors: [],
  lastSettings: null,
  lastMultipliers: null,
  observer: null,
  isVisible: true,
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

const waitForPlayerPageReady = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const checkReady = () => {
      const playerPage = document.getElementById("player-page");
      const hasContent = playerPage && playerPage.children.length > 0;

      if (hasContent) {
        setTimeout(() => resolve(true), 1000);
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
  multipliers: DynamicMultipliers
): Promise<boolean> => {
  if (colors.length === 0) return false;

  destroyShader();

  const isReady = await waitForPlayerPageReady();
  if (!isReady) return false;

  const playerPage = document.getElementById("player-page");
  if (!playerPage) return false;

  const existingGradient = document.getElementById("better-lyrics-gradient");
  if (existingGradient) {
    existingGradient.remove();
  }

  state.container = document.createElement("div");
  state.container.id = "better-lyrics-gradient";
  state.container.style.cssText = `
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

  playerPage.insertBefore(state.container, playerPage.firstChild);

  state.colors = colors;
  state.colorVectors = colors.map(getCachedColorVector);
  state.lastSettings = { ...settings };
  state.lastMultipliers = { ...multipliers };

  const uniforms = buildMeshGradientUniforms(
    state.colorVectors,
    settings,
    multipliers
  );
  const speed = settings.speed * multipliers.speedMultiplier;

  // Performance optimizations: reduce pixel count and anti-aliasing for better GPU performance
  const minPixelRatio = 1; // Reduced from default 2.0 for lower anti-aliasing overhead
  const maxPixelCount = 1920 * 1080 * 2; // ~4M pixels (1080p @ 2x) instead of default ~8.3M (4K)

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
    (entries) => {
      const entry = entries[0];
      const isVisible = entry.isIntersecting;

      if (state.isVisible !== isVisible) {
        state.isVisible = isVisible;
        if (state.mount) {
          // Pause shader when not visible, resume when visible
          state.mount.setSpeed(
            isVisible ? settings.speed * multipliers.speedMultiplier : 0
          );
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

export const destroyShader = (): void => {
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
};

export const updateShaderColors = (
  colors: string[],
  settings: GradientSettings,
  multipliers: DynamicMultipliers
): void => {
  if (!state.mount || !state.container) return;

  const colorsChanged = JSON.stringify(colors) !== JSON.stringify(state.colors);

  if (colorsChanged) {
    state.colors = colors;
    state.colorVectors = colors.map(getCachedColorVector);
  }

  const uniforms = buildMeshGradientUniforms(
    state.colorVectors,
    settings,
    multipliers
  );
  state.mount.setUniforms(uniforms as any);

  state.lastSettings = { ...settings };
  state.lastMultipliers = { ...multipliers };

  if (
    state.container &&
    state.container.style.opacity !== settings.opacity.toString()
  ) {
    state.container.style.opacity = settings.opacity.toString();
  }
};

export const updateShaderSettings = (
  settings: GradientSettings,
  multipliers: DynamicMultipliers
): void => {
  if (!state.mount || !state.container || state.colorVectors.length === 0)
    return;

  const settingsChanged =
    JSON.stringify(settings) !== JSON.stringify(state.lastSettings);
  const multipliersChanged =
    JSON.stringify(multipliers) !== JSON.stringify(state.lastMultipliers);

  if (!settingsChanged && !multipliersChanged) return;

  const uniforms = buildMeshGradientUniforms(
    state.colorVectors,
    settings,
    multipliers
  );
  const speed = settings.speed * multipliers.speedMultiplier;

  state.mount.setUniforms(uniforms as any);
  // Only set speed if shader is visible, otherwise keep it paused
  state.mount.setSpeed(state.isVisible ? speed : 0);

  state.lastSettings = { ...settings };
  state.lastMultipliers = { ...multipliers };

  if (
    state.container &&
    state.container.style.opacity !== settings.opacity.toString()
  ) {
    state.container.style.opacity = settings.opacity.toString();
  }
};

export const hasShader = (): boolean => {
  return state.mount !== null && state.container !== null;
};

export const getCurrentColors = (): string[] => {
  return [...state.colors];
};

export const cleanupOrphanedGradients = (): void => {
  const existingGradients = document.querySelectorAll(
    "#better-lyrics-gradient"
  );
  existingGradients.forEach((gradient) => gradient.remove());
};

export const clearColorVectorCache = (): void => {
  colorVectorCache.clear();
};
