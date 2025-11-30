import type { DynamicMultipliers, GradientSettings } from "../../shared/constants/gradientSettings";
import { logger } from "../../shared/utils/logger";

interface AudioAnalysisState {
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  gainNode: GainNode | null;
  element: HTMLAudioElement | null;
  rafId: number | null;
  isInitialized: boolean;
  dataArray: Uint8Array<ArrayBuffer> | null;
  lastAnalysisTime: number;
  initTimeoutId: number | null;
  resumeContextHandler: (() => Promise<void>) | null;
  volumeChangeHandler: (() => void) | null;
  playHandler: (() => void) | null;
  pauseHandler: (() => void) | null;
  onPlaybackStateChange: ((isPlaying: boolean) => void) | null;
}

const state: AudioAnalysisState = {
  context: null,
  analyser: null,
  gainNode: null,
  element: null,
  rafId: null,
  isInitialized: false,
  dataArray: null,
  lastAnalysisTime: 0,
  initTimeoutId: null,
  resumeContextHandler: null,
  volumeChangeHandler: null,
  playHandler: null,
  pauseHandler: null,
  onPlaybackStateChange: null,
};

const ANALYSIS_INTERVAL = 100;

const reusableMultipliers: DynamicMultipliers = { speedMultiplier: 1, scaleMultiplier: 1 };

const nativeVolumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume");

const getNativeVolume = (element: HTMLMediaElement): number => {
  return nativeVolumeDescriptor?.get?.call(element) ?? 1;
};

const setNativeVolume = (element: HTMLMediaElement, value: number): void => {
  nativeVolumeDescriptor?.set?.call(element, value);
};

export const initializeAudioAnalysis = async (): Promise<void> => {
  if (state.isInitialized) {
    return;
  }

  try {
    state.element = document.querySelector("audio, video") as HTMLAudioElement;
    if (!state.element) {
      state.initTimeoutId = window.setTimeout(initializeAudioAnalysis, 1000);
      return;
    }
    state.initTimeoutId = null;

    state.context = new (window.AudioContext || (window as any).webkitAudioContext)();

    if (state.context.state === "suspended") {
      if (state.resumeContextHandler) {
        document.removeEventListener("click", state.resumeContextHandler);
        document.removeEventListener("keydown", state.resumeContextHandler);
      }

      state.resumeContextHandler = async () => {
        if (state.context && state.context.state === "suspended") {
          await state.context.resume();
        }
        if (state.resumeContextHandler) {
          document.removeEventListener("click", state.resumeContextHandler);
          document.removeEventListener("keydown", state.resumeContextHandler);
          state.resumeContextHandler = null;
        }
      };

      document.addEventListener("click", state.resumeContextHandler);
      document.addEventListener("keydown", state.resumeContextHandler);
    }

    state.analyser = state.context.createAnalyser();
    state.analyser.fftSize = 1024;
    state.analyser.smoothingTimeConstant = 0.8;

    const bufferLength = state.analyser.frequencyBinCount;
    state.dataArray = new Uint8Array(new ArrayBuffer(bufferLength));

    state.gainNode = state.context.createGain();
    const initialVolume = getNativeVolume(state.element);
    state.gainNode.gain.value = initialVolume;

    const source = state.context.createMediaElementSource(state.element);
    source.connect(state.analyser);
    source.connect(state.gainNode);
    state.gainNode.connect(state.context.destination);

    setNativeVolume(state.element, 1);

    const element = state.element;
    const gainNode = state.gainNode;
    let isAdjusting = false;
    state.volumeChangeHandler = () => {
      if (isAdjusting) return;
      const nativeVolume = getNativeVolume(element);
      if (nativeVolume !== 1) {
        isAdjusting = true;
        gainNode.gain.value = nativeVolume;
        setNativeVolume(element, 1);
        isAdjusting = false;
      }
    };
    state.element.addEventListener("volumechange", state.volumeChangeHandler);

    state.playHandler = () => {
      if (state.onPlaybackStateChange) {
        state.onPlaybackStateChange(true);
      }
    };
    state.pauseHandler = () => {
      if (state.onPlaybackStateChange) {
        state.onPlaybackStateChange(false);
      }
    };
    state.element.addEventListener("play", state.playHandler);
    state.element.addEventListener("pause", state.pauseHandler);

    state.isInitialized = true;
    logger.log("Audio analysis initialized (volume-independent)");
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
    state.analyser.getByteTimeDomainData(state.dataArray);

    let peak = 0;
    const length = state.dataArray.length;

    const threshold = settings.audioBeatThreshold;

    for (let i = 0; i < length; i++) {
      const amplitude = Math.abs(state.dataArray[i] - 128) / 128;
      if (amplitude > peak) {
        peak = amplitude;
        if (peak > threshold) break;
      }
    }

    const isBeat = peak > threshold;

    const scaleBoost = settings.audioScaleBoost;

    reusableMultipliers.speedMultiplier = settings.audioResponsive && isBeat ? settings.audioSpeedMultiplier : 1;
    reusableMultipliers.scaleMultiplier = settings.audioResponsive && isBeat ? 1 + scaleBoost / 100 : 1;

    onBeatDetected(reusableMultipliers);

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

  if (state.initTimeoutId !== null) {
    clearTimeout(state.initTimeoutId);
    state.initTimeoutId = null;
  }

  // NOTE: We intentionally do NOT close the AudioContext, disconnect nodes,
  // or remove the volumechange listener because createMediaElementSource()
  // permanently routes audio through Web Audio API. The volume interception
  // must remain active to keep playback volume working correctly.

  state.lastAnalysisTime = 0;
};

export const isAudioInitialized = (): boolean => state.isInitialized;

export const setPlaybackStateCallback = (callback: ((isPlaying: boolean) => void) | null): void => {
  state.onPlaybackStateChange = callback;
};

export const isPlaying = (): boolean => {
  return state.element ? !state.element.paused : false;
};
