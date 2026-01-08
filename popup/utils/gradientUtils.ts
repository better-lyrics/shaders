export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const getControlLabel = (key: string): string => {
  const labels: Record<string, string> = {
    audioSpeedMultiplier: "Beat Speed Multiplier",
    audioBeatThreshold: "Beat Sensitivity",
    kawarpOpacity: "Opacity",
    kawarpWarpIntensity: "Warp Intensity",
    kawarpBlurPasses: "Blur Passes",
    kawarpAnimationSpeed: "Animation Speed",
    kawarpTransitionDuration: "Transition Duration",
    kawarpSaturation: "Saturation",
    kawarpDithering: "Dithering",
    kawarpAudioScaleBoost: "Beat Scale Boost",
  };

  return labels[key] || capitalizeFirst(key);
};
