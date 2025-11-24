import type { DynamicMultipliers, GradientSettings } from "../../shared/constants/gradientSettings";
import { logger } from "../../shared/utils/logger";

interface AudioAnalysisState {
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  element: HTMLAudioElement | null;
  rafId: number | null;
  isInitialized: boolean;
  dataArray: Uint8Array | null;
  lastAnalysisTime: number;
}

const state: AudioAnalysisState = {
  context: null,
  analyser: null,
  element: null,
  rafId: null,
  isInitialized: false,
  dataArray: null,
  lastAnalysisTime: 0,
};

const ANALYSIS_INTERVAL = 100;

export const initializeAudioAnalysis = async (): Promise<void> => {
  try {
    state.element = document.querySelector("audio, video") as HTMLAudioElement;
    if (!state.element) {
      setTimeout(initializeAudioAnalysis, 1000);
      return;
    }

    state.context = new (window.AudioContext || (window as any).webkitAudioContext)();

    if (state.context.state === "suspended") {
      const resumeContext = async () => {
        if (state.context && state.context.state === "suspended") {
          await state.context.resume();
        }
        document.removeEventListener("click", resumeContext);
        document.removeEventListener("keydown", resumeContext);
      };

      document.addEventListener("click", resumeContext);
      document.addEventListener("keydown", resumeContext);
    }

    state.analyser = state.context.createAnalyser();
    state.analyser.fftSize = 1024;
    state.analyser.smoothingTimeConstant = 0.8;

    const bufferLength = state.analyser.frequencyBinCount;
    state.dataArray = new Uint8Array(new ArrayBuffer(bufferLength));

    const source = state.context.createMediaElementSource(state.element);
    source.connect(state.analyser);
    state.analyser.connect(state.context.destination);

    state.isInitialized = true;
    logger.log("Audio analysis initialized successfully");
  } catch (error) {
    logger.error("Error initializing audio analysis:", error);
  }
};

const analyzeAudioFrame = (
  settings: GradientSettings,
  onBeatDetected: (multipliers: DynamicMultipliers) => void,
  timestamp: number
): void => {
  if (!state.analyser || !state.dataArray) {
    state.rafId = null;
    return;
  }

  if (timestamp - state.lastAnalysisTime >= ANALYSIS_INTERVAL) {
    // @ts-ignore - Type compatibility issue with Web Audio API
    state.analyser.getByteTimeDomainData(state.dataArray);

    let peak = 0;
    const length = state.dataArray.length;

    for (let i = 0; i < length; i++) {
      const amplitude = Math.abs(state.dataArray[i] - 128) / 128;
      if (amplitude > peak) {
        peak = amplitude;
        if (peak > 0.75) break;
      }
    }

    const isBeat = peak > 0.75;

    if (isBeat || state.lastAnalysisTime === 0) {
      const speedMultiplier = settings.audioResponsive && isBeat ? settings.audioSpeedMultiplier : 1;
      const scaleMultiplier = settings.audioResponsive && isBeat ? 1 + settings.audioScaleBoost / 100 : 1;

      onBeatDetected({
        speedMultiplier,
        scaleMultiplier,
      });
    }

    state.lastAnalysisTime = timestamp;
  }

  state.rafId = requestAnimationFrame(ts => analyzeAudioFrame(settings, onBeatDetected, ts));
};

export const startAudioAnalysis = (
  settings: GradientSettings,
  onBeatDetected: (multipliers: DynamicMultipliers) => void
): void => {
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
  }

  state.lastAnalysisTime = 0;
  state.rafId = requestAnimationFrame(timestamp => analyzeAudioFrame(settings, onBeatDetected, timestamp));
};

export const stopAudioAnalysis = (): void => {
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }

  if (state.context) {
    state.context.close();
    state.context = null;
  }

  state.analyser = null;
  state.element = null;
  state.dataArray = null;
  state.isInitialized = false;
  state.lastAnalysisTime = 0;
};

export const isAudioInitialized = (): boolean => state.isInitialized;
