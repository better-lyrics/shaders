export const formatValue = (key: string, value: number): string => {
  if (value === undefined || value === null) return "0";
  if (key === "rotation") return value.toFixed(0);
  if (key === "audioSpeedMultiplier") return value.toFixed(1) + "x";
  if (key === "audioScaleBoost") return value.toFixed(1) + "%";
  return value.toFixed(2);
};
