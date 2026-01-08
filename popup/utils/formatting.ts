export const formatValue = (key: string, value: number): string => {
  if (value === undefined || value === null) return "0";
  if (key === "audioSpeedMultiplier") return value.toFixed(1) + "x";
  if (key === "kawarpAudioScaleBoost") return value.toFixed(1) + "%";
  if (key === "audioBeatThreshold") return value.toFixed(3);
  if (key === "kawarpBlurPasses") return value.toFixed(0);
  if (key === "kawarpTransitionDuration") return value.toFixed(0) + "ms";
  if (key === "kawarpDithering") return value.toFixed(3);
  return value.toFixed(2);
};
