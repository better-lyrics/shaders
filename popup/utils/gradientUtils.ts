// Utility functions for gradient controls
// This file can be extended with more gradient-specific utilities as needed

export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const getControlLabel = (key: string): string => {
  const labels: Record<string, string> = {
    audioSpeedMultiplier: "Beat Speed Multiplier",
    audioScaleBoost: "Beat Scale Boost",
    offsetX: "Offset X",
    offsetY: "Offset Y",
  };

  return labels[key] || capitalizeFirst(key);
};
