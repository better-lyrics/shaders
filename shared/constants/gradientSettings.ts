export interface GradientSettings {
  enabled: boolean;
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
  audioBeatThreshold: number;
  showLogs: boolean;
  boostDullColors: boolean;
  showOnBrowsePages: boolean;
  rememberAlbumSettings: boolean;
  vibrantSaturationThreshold: number;
  vibrantRatioThreshold: number;
  boostIntensity: number;
}

export interface DynamicMultipliers {
  speedMultiplier: number;
  scaleMultiplier: number;
}

export const DEFAULT_GRADIENT_SETTINGS: GradientSettings = {
  enabled: true,
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
  audioBeatThreshold: 0.105,
  showLogs: false,
  boostDullColors: true,
  showOnBrowsePages: false,
  rememberAlbumSettings: false,
  vibrantSaturationThreshold: 30,
  vibrantRatioThreshold: 50,
  boostIntensity: 50,
};

export const DEFAULT_DYNAMIC_MULTIPLIERS: DynamicMultipliers = {
  speedMultiplier: 1,
  scaleMultiplier: 1,
};

export const GRADIENT_SETTINGS_STORAGE_KEY = "gradientSettings";
export const ALBUM_SETTINGS_STORAGE_KEY = "albumSpecificSettings";
