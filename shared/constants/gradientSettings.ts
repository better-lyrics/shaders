export interface GradientSettings {
  distortion: number;
  swirl: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  speed: number;
  opacity: number;
  audioResponsive: boolean;
  audioSpeedMultiplier: number;
  audioScaleBoost: number;
  showLogs: boolean;
}

export interface DynamicMultipliers {
  speedMultiplier: number;
  scaleMultiplier: number;
}

export const DEFAULT_GRADIENT_SETTINGS: GradientSettings = {
  distortion: 0.95,
  swirl: 0.95,
  offsetX: 0,
  offsetY: 0,
  scale: 1.25,
  rotation: 0,
  speed: 0.5,
  opacity: 0.33,
  audioResponsive: true,
  audioSpeedMultiplier: 4,
  audioScaleBoost: 1,
  showLogs: false,
};

export const DEFAULT_DYNAMIC_MULTIPLIERS: DynamicMultipliers = {
  speedMultiplier: 1,
  scaleMultiplier: 1,
};

export const GRADIENT_SETTINGS_STORAGE_KEY = "gradientSettings";
