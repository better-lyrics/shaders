export interface GradientSettings {
  enabled: boolean;
  // Kawarp settings
  kawarpOpacity: number;
  kawarpWarpIntensity: number;
  kawarpBlurPasses: number;
  kawarpAnimationSpeed: number;
  kawarpTransitionDuration: number;
  kawarpSaturation: number;
  kawarpDithering: number;
  kawarpAudioScaleBoost: number;
  // Audio responsive
  audioResponsive: boolean;
  audioSpeedMultiplier: number;
  audioBeatThreshold: number;
  pauseOnInactive: boolean;
  // Other settings
  showLogs: boolean;
  showOnBrowsePages: boolean;
}

export interface DynamicMultipliers {
  speedMultiplier: number;
  scaleMultiplier: number;
}

export const DEFAULT_GRADIENT_SETTINGS: GradientSettings = {
  enabled: true,
  // Kawarp defaults (matching @kawarp/core defaults)
  kawarpOpacity: 0.75,
  kawarpWarpIntensity: 1.0,
  kawarpBlurPasses: 8,
  kawarpAnimationSpeed: 1.0,
  kawarpTransitionDuration: 1000,
  kawarpSaturation: 1.5,
  kawarpDithering: 0.008,
  kawarpAudioScaleBoost: 2,
  // Audio responsive
  audioResponsive: true,
  audioSpeedMultiplier: 4,
  audioBeatThreshold: 0.75,
  pauseOnInactive: true,
  // Other settings
  showLogs: false,
  showOnBrowsePages: false,
};

export const DEFAULT_DYNAMIC_MULTIPLIERS: DynamicMultipliers = {
  speedMultiplier: 1,
  scaleMultiplier: 1,
};

export const GRADIENT_SETTINGS_STORAGE_KEY = "gradientSettings";
