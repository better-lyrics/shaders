export interface ControlConfig {
  min: number;
  max: number;
  step: number;
}

export const getControlConfig = (key: string): ControlConfig => {
  let min = 0,
    max = 2,
    step = 0.01;

  if (key === "opacity") {
    min = 0;
    max = 1;
    step = 0.01;
  } else if (key === "distortion" || key === "swirl") {
    min = 0;
    max = 2;
    step = 0.01;
  } else if (key === "offsetX" || key === "offsetY") {
    min = -1;
    max = 1;
    step = 0.01;
  } else if (key === "scale") {
    min = 0.1;
    max = 3;
    step = 0.01;
  } else if (key === "rotation") {
    min = 0;
    max = 360;
    step = 1;
  } else if (key === "speed") {
    min = 0;
    max = 2;
    step = 0.01;
  } else if (key === "audioSpeedMultiplier") {
    min = 2;
    max = 8;
    step = 0.1;
  } else if (key === "audioScaleBoost") {
    min = 0;
    max = 5;
    step = 0.1;
  } else if (key === "vibrantSaturationThreshold") {
    min = 0;
    max = 100;
    step = 1;
  } else if (key === "vibrantRatioThreshold") {
    min = 0;
    max = 100;
    step = 1;
  } else if (key === "boostIntensity") {
    min = 0;
    max = 100;
    step = 1;
  }

  return { min, max, step };
};
