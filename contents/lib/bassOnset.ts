const AVERAGE_WINDOW_MS = 1000;
const PULSE_DECAY_MS = 180;
const REFRACTORY_MS = 150;
const MIN_PULSE = 0.01;
const MIN_ONSET_STRENGTH = 0.35;
const FULL_STRENGTH_RATIO_SPAN = 2.5;

const onsetStrength = (energyRatio: number, onsetRatio: number): number => {
  const headroom = Math.log(energyRatio / onsetRatio) / Math.log(FULL_STRENGTH_RATIO_SPAN);
  return MIN_ONSET_STRENGTH + (1 - MIN_ONSET_STRENGTH) * Math.min(1, Math.max(0, headroom));
};

interface BassOnsetDetector {
  update: (bassEnergy: number, timestamp: number, threshold: number) => number;
  reset: () => void;
}

const createBassOnsetDetector = (): BassOnsetDetector => {
  let averageEnergy = 0;
  let previousEnergy = 0;
  let pulse = 0;
  let lastTimestamp: number | null = null;
  let lastOnsetAt = Number.NEGATIVE_INFINITY;

  const update = (bassEnergy: number, timestamp: number, threshold: number): number => {
    const elapsed = lastTimestamp === null ? 0 : Math.max(0, timestamp - lastTimestamp);
    lastTimestamp = timestamp;

    pulse *= Math.exp(-elapsed / PULSE_DECAY_MS);
    if (pulse < MIN_PULSE) pulse = 0;

    const onsetRatio = 1 + threshold;
    const energyRatio = averageEnergy > 0 ? bassEnergy / averageEnergy : 0;
    const isRising = bassEnergy > previousEnergy;
    if (energyRatio > onsetRatio && isRising && timestamp - lastOnsetAt >= REFRACTORY_MS) {
      pulse = Math.max(pulse, onsetStrength(energyRatio, onsetRatio));
      lastOnsetAt = timestamp;
    }

    averageEnergy =
      averageEnergy === 0
        ? bassEnergy
        : averageEnergy + (bassEnergy - averageEnergy) * (1 - Math.exp(-elapsed / AVERAGE_WINDOW_MS));
    previousEnergy = bassEnergy;
    return pulse;
  };

  const reset = (): void => {
    averageEnergy = 0;
    previousEnergy = 0;
    pulse = 0;
    lastTimestamp = null;
    lastOnsetAt = Number.NEGATIVE_INFINITY;
  };

  return { update, reset };
};

export { createBassOnsetDetector };
