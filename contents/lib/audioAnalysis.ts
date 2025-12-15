import type { DynamicMultipliers, GradientSettings } from "../../shared/constants/gradientSettings";
import { logger } from "../../shared/utils/logger";

interface AudioAnalysisState {
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaElementAudioSourceNode | null;
  element: HTMLMediaElement | null;
  rafId: number | null;
  isInitialized: boolean;
  dataArray: Uint8Array<ArrayBuffer> | null;
  lastAnalysisTime: number;
  initTimeoutId: number | null;
  resumeContextHandler: (() => Promise<void>) | null;
  playHandler: (() => void) | null;
  pauseHandler: (() => void) | null;
  onPlaybackStateChange: ((isPlaying: boolean) => void) | null;
}

const connectedElements = new WeakSet<HTMLMediaElement>();

const state: AudioAnalysisState = {
  context: null,
  analyser: null,
  source: null,
  element: null,
  rafId: null,
  isInitialized: false,
  dataArray: null,
  lastAnalysisTime: 0,
  initTimeoutId: null,
  resumeContextHandler: null,
  playHandler: null,
  pauseHandler: null,
  onPlaybackStateChange: null,
};

const ANALYSIS_INTERVAL = 100;
const MIN_VOLUME_FOR_ANALYSIS = 0.01;

const reusableMultipliers: DynamicMultipliers = { speedMultiplier: 1, scaleMultiplier: 1 };

const removeElementListeners = (element: HTMLMediaElement): void => {
  if (state.playHandler) {
    element.removeEventListener("play", state.playHandler);
  }
  if (state.pauseHandler) {
    element.removeEventListener("pause", state.pauseHandler);
  }
};

const addElementListeners = (element: HTMLMediaElement): void => {
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
  element.addEventListener("play", state.playHandler);
  element.addEventListener("pause", state.pauseHandler);
};

export const initializeAudioAnalysis = async (): Promise<void> => {
  if (state.isInitialized) {
    return;
  }

  try {
    state.element = document.querySelector("audio, video") as HTMLMediaElement;
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

    state.source = state.context.createMediaElementSource(state.element);
    state.source.connect(state.analyser);
    state.source.connect(state.context.destination);

    connectedElements.add(state.element);

    addElementListeners(state.element);

    state.isInitialized = true;
    logger.log("Audio analysis initialized (passthrough mode)");
  } catch (error) {
    logger.error("Error initializing audio analysis:", error);
  }
};

const analyzeAudioFrame = (
  settings: GradientSettings,
  onBeatDetected: (multipliers: DynamicMultipliers) => void,
  timestamp: number
): void => {
  if (!state.analyser || !state.dataArray || !state.element) {
    state.rafId = null;
    return;
  }

  if (timestamp - state.lastAnalysisTime >= ANALYSIS_INTERVAL) {
    state.analyser.getByteTimeDomainData(state.dataArray);

    const currentVolume = state.element.volume;
    const volumeMultiplier = currentVolume > MIN_VOLUME_FOR_ANALYSIS ? 1 / currentVolume : 1;

    let peak = 0;
    const length = state.dataArray.length;
    const threshold = settings.audioBeatThreshold;

    for (let i = 0; i < length; i++) {
      const rawAmplitude = Math.abs(state.dataArray[i] - 128) / 128;
      const amplitude = rawAmplitude * volumeMultiplier;
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

  state.lastAnalysisTime = 0;
};

const reconnectToNewElement = (newElement: HTMLMediaElement): void => {
  if (!state.context) return;

  if (state.element) {
    removeElementListeners(state.element);
  }

  if (connectedElements.has(newElement)) {
    logger.log("Element already has MediaElementSource, re-adding listeners");
    state.element = newElement;
    addElementListeners(newElement);
    return;
  }

  state.analyser = state.context.createAnalyser();
  state.analyser.fftSize = 1024;
  state.analyser.smoothingTimeConstant = 0.8;

  const bufferLength = state.analyser.frequencyBinCount;
  state.dataArray = new Uint8Array(new ArrayBuffer(bufferLength));

  state.source = state.context.createMediaElementSource(newElement);
  state.source.connect(state.analyser);
  state.source.connect(state.context.destination);

  connectedElements.add(newElement);

  state.element = newElement;

  addElementListeners(newElement);

  logger.log("Audio analysis reconnected to new element");
};

export const checkAndReconnectElement = (): void => {
  if (!state.isInitialized) return;

  const currentElement = document.querySelector("audio, video") as HTMLMediaElement;

  if (currentElement && currentElement !== state.element) {
    logger.log("Audio element changed, reconnecting...");
    reconnectToNewElement(currentElement);
  } else if (state.element && !document.contains(state.element)) {
    if (currentElement) {
      logger.log("Old audio element detached, reconnecting to new one...");
      reconnectToNewElement(currentElement);
    }
  }
};

export const isAudioInitialized = (): boolean => state.isInitialized;

export const setPlaybackStateCallback = (callback: ((isPlaying: boolean) => void) | null): void => {
  state.onPlaybackStateChange = callback;
};

export const isPlaying = (): boolean => {
  return state.element ? !state.element.paused : false;
};
