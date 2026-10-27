import { PLAYER_MEDIA_SELECTOR } from "@/shared/constants/mediaElements";
import { logger } from "@/shared/utils/logger";
import {
  AUDIO_BUS_VERSION,
  type AnalysisSettings,
  type SharedAudioBus,
  audioCommandFrom,
  postAudioMessage,
  publishSharedAudioBus,
  readSharedAudioBus,
} from "./audioBridge";
import { createBassOnsetDetector } from "./bassOnset";

const ANALYSIS_INTERVAL = 100;
const MIN_VOLUME_FOR_ANALYSIS = 0.005;
const INIT_RETRY_MS = 1000;
const ANALYSER_FFT_SIZE = 2048;
const ANALYSER_SMOOTHING = 0.3;
const BASS_LOW_HZ = 40;
const BASS_HIGH_HZ = 150;
const MIN_BASS_DB = -70;

interface GraphState {
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaElementAudioSourceNode | null;
  element: HTMLMediaElement | null;
  dataArray: Uint8Array<ArrayBuffer> | null;
  spectrum: Float32Array<ArrayBuffer> | null;
  isLoud: boolean;
  lastBeat: { isBeat: boolean; speedMultiplier: number; scaleMultiplier: number } | null;
  rafId: number | null;
  initTimeoutId: number | null;
  resumeContextHandler: (() => Promise<void>) | null;
  settings: AnalysisSettings | null;
  isInitialized: boolean;
  lastAnalysisTime: number;
}

const state: GraphState = {
  context: null,
  analyser: null,
  source: null,
  element: null,
  dataArray: null,
  spectrum: null,
  isLoud: false,
  lastBeat: null,
  rafId: null,
  initTimeoutId: null,
  resumeContextHandler: null,
  settings: null,
  isInitialized: false,
  lastAnalysisTime: 0,
};

interface ElementCapture {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
}

const elementCaptures = new WeakMap<HTMLMediaElement, ElementCapture | null>();

const bassOnset = createBassOnsetDetector();

const currentElement = (): HTMLMediaElement | null => document.querySelector(PLAYER_MEDIA_SELECTOR);

const detachResumeOnGesture = (): void => {
  if (!state.resumeContextHandler) return;
  document.removeEventListener("click", state.resumeContextHandler);
  document.removeEventListener("keydown", state.resumeContextHandler);
  state.resumeContextHandler = null;
};

const attachResumeOnGesture = (context: AudioContext): void => {
  if (context.state !== "suspended") return;

  detachResumeOnGesture();

  state.resumeContextHandler = async () => {
    if (context.state === "suspended") {
      await context.resume();
    }
    detachResumeOnGesture();
  };

  document.addEventListener("click", state.resumeContextHandler);
  document.addEventListener("keydown", state.resumeContextHandler);
};

const buildAnalyser = (context: AudioContext, source: MediaElementAudioSourceNode): void => {
  const analyser = context.createAnalyser();
  analyser.fftSize = ANALYSER_FFT_SIZE;
  analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
  source.connect(analyser);

  if (state.source && state.analyser) {
    try {
      state.source.disconnect(state.analyser);
    } catch (error) {
      logger.log("Previous analyser edge was already removed:", error);
    }
  }

  state.analyser = analyser;
  state.dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
  state.spectrum = new Float32Array(new ArrayBuffer(analyser.frequencyBinCount * Float32Array.BYTES_PER_ELEMENT));
  bassOnset.reset();
};

const ownContext = (): AudioContext => {
  if (!state.context) {
    state.context = new AudioContext();
  }
  return state.context;
};

const captureFor = (preferredContext: AudioContext, element: HTMLMediaElement): ElementCapture | null => {
  const cached = elementCaptures.get(element);
  if (cached !== undefined) return cached;

  try {
    const source = preferredContext.createMediaElementSource(element);
    source.connect(preferredContext.destination);
    const capture: ElementCapture = { context: preferredContext, source };
    elementCaptures.set(element, capture);
    return capture;
  } catch (error) {
    elementCaptures.set(element, null);
    logger.error("Could not capture the audio element, effects will not react to sound:", error);
    return null;
  }
};

const acquireBus = (element: HTMLMediaElement): SharedAudioBus | null => {
  const shared = readSharedAudioBus();
  if (shared && shared.element === element) {
    elementCaptures.set(element, { context: shared.context, source: shared.source });
    attachResumeOnGesture(shared.context);
    logger.log("Audio analysis attached to an existing shared bus");
    return shared;
  }

  // Only the branch above may borrow a published context, because there it also
  // takes that context's source. Routing a different element into someone else's
  // context would let their teardown strand this element for the page's lifetime.
  const capture = captureFor(ownContext(), element);
  if (!capture) return null;

  attachResumeOnGesture(capture.context);

  const bus: SharedAudioBus = {
    version: AUDIO_BUS_VERSION,
    context: capture.context,
    source: capture.source,
    element,
  };
  publishSharedAudioBus(bus);
  return bus;
};

const bindTo = (element: HTMLMediaElement): boolean => {
  const bus = acquireBus(element);
  if (!bus) return false;

  buildAnalyser(bus.context, bus.source);
  state.context = bus.context;
  state.source = bus.source;
  state.element = element;
  return true;
};

const scheduleInitRetry = (): void => {
  state.initTimeoutId = window.setTimeout(initialize, INIT_RETRY_MS);
};

const initialize = (): void => {
  if (state.isInitialized) return;

  if (state.initTimeoutId !== null) {
    clearTimeout(state.initTimeoutId);
    state.initTimeoutId = null;
  }

  try {
    const element = currentElement();
    if (!element) {
      scheduleInitRetry();
      return;
    }

    if (!bindTo(element)) {
      scheduleInitRetry();
      return;
    }

    state.isInitialized = true;
    postAudioMessage({ type: "bls-audio-initialized" });
    logger.log("Audio analysis initialized (passthrough mode)");
  } catch (error) {
    logger.error("Error initializing audio analysis:", error);
    scheduleInitRetry();
  }
};

const measureBassEnergy = (analyser: AnalyserNode, spectrum: Float32Array<ArrayBuffer>): number => {
  analyser.getFloatFrequencyData(spectrum);
  const binHz = analyser.context.sampleRate / analyser.fftSize;
  const firstBin = Math.max(1, Math.floor(BASS_LOW_HZ / binHz));
  const lastBin = Math.min(spectrum.length - 1, Math.ceil(BASS_HIGH_HZ / binHz));
  let energy = 0;
  for (let bin = firstBin; bin <= lastBin; bin++) {
    if (spectrum[bin] > MIN_BASS_DB) energy += 10 ** (spectrum[bin] / 10);
  }
  return energy;
};

const analyzeAudioFrame = (timestamp: number): void => {
  const settings = state.settings;
  if (!state.analyser || !state.dataArray || !state.spectrum || !state.element || !settings) {
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

    state.isLoud = peak > threshold;
    state.lastAnalysisTime = timestamp;
  }

  const pulse = bassOnset.update(
    measureBassEnergy(state.analyser, state.spectrum),
    timestamp,
    settings.audioBeatThreshold
  );
  const isBeat = settings.audioResponsive && state.isLoud;
  const beat = {
    isBeat,
    speedMultiplier: isBeat ? settings.audioSpeedMultiplier : 1,
    scaleMultiplier: settings.audioResponsive ? 1 + (settings.kawarpAudioScaleBoost / 100) * pulse : 1,
  };
  const last = state.lastBeat;
  if (
    !last ||
    last.isBeat !== beat.isBeat ||
    last.speedMultiplier !== beat.speedMultiplier ||
    last.scaleMultiplier !== beat.scaleMultiplier
  ) {
    postAudioMessage({ type: "bls-audio-beat", ...beat });
    state.lastBeat = beat;
  }

  state.rafId = requestAnimationFrame(analyzeAudioFrame);
};

const startAnalysis = (settings: AnalysisSettings): void => {
  state.settings = settings;
  if (!state.isInitialized) initialize();
  if (state.rafId !== null) cancelAnimationFrame(state.rafId);
  state.lastAnalysisTime = 0;
  state.isLoud = false;
  state.lastBeat = null;
  bassOnset.reset();
  state.rafId = requestAnimationFrame(analyzeAudioFrame);
};

const stopAnalysis = (): void => {
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  state.lastAnalysisTime = 0;
};

const reconnect = (): void => {
  if (!state.isInitialized) return;

  const element = currentElement();
  if (!element) return;

  if (element === state.element) return;

  logger.log("Audio element changed, reconnecting...");
  if (!bindTo(element)) {
    logger.error("Could not rebind audio analysis to the current media element");
  }
};

window.addEventListener("message", event => {
  const message = audioCommandFrom(event);
  if (!message) return;

  try {
    switch (message.type) {
      case "bls-audio-set-logging":
        logger.setEnabled(message.showLogs);
        break;
      case "bls-audio-initialize":
        initialize();
        break;
      case "bls-audio-start":
        startAnalysis(message.settings);
        break;
      case "bls-audio-stop":
        stopAnalysis();
        break;
      case "bls-audio-reconnect":
        reconnect();
        break;
    }
  } catch (error) {
    logger.error(`Audio command ${message.type} failed:`, error);
  }
});

postAudioMessage({ type: "bls-audio-ready" });
