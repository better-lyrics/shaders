import {
  DEFAULT_DYNAMIC_MULTIPLIERS,
  DEFAULT_GRADIENT_SETTINGS,
  type DynamicMultipliers,
  type GradientSettings,
} from "@/shared/constants/gradientSettings";
import {
  ANIMATED_ART_VIDEO_SELECTOR,
  PLAYER_BAR_THUMBNAIL_CONTAINER_SELECTOR,
  PLAYER_VIDEO_SELECTOR,
  SONG_IMAGE_CONTAINER_SELECTOR,
} from "@/shared/constants/mediaElements";
import { logger } from "@/shared/utils/logger";
import { pageFetch } from "@/shared/utils/pageFetch";
import { videoMotion } from "@/shared/utils/videoSettings";
import Kawarp, { type KawarpVideoOptions } from "@kawarp/core";
import { isAdPlaying } from "./adState";
import { brightnessForHighlight, measureArtworkHighlight, measureHighlightLuminance } from "./artworkBrightness";

interface KawarpState {
  backdrop: HTMLDivElement | null;
  container: HTMLDivElement | null;
  target: HTMLElement | null;
  canvas: HTMLCanvasElement | null;
  instance: Kawarp | null;
  currentImageUrl: string | null;
  lastSettings: GradientSettings | null;
  lastMultipliers: DynamicMultipliers | null;
  observer: IntersectionObserver | null;
  isVisible: boolean;
  isTransitioning: boolean;
  pendingImageUrl: string | null;
  transitionTimeoutId: number | null;
  currentScale: number;
  targetScale: number;
  scaleAnimationId: number | null;
  currentSpeed: number;
  targetSpeed: number;
  speedAnimationId: number | null;
  isPaused: boolean;
  highlightLuminance: number | null;
  videoMode: boolean;
  videoSource: HTMLVideoElement | null;
  videoUnavailableSince: number | null;
  failedVideoSrc: string | null;
  brightnessSampledAt: number;
  brightnessSampledTime: number;
  stopWatchingOutput: (() => void) | null;
}

const createEmptyState = (): KawarpState => ({
  backdrop: null,
  container: null,
  target: null,
  canvas: null,
  instance: null,
  currentImageUrl: null,
  lastSettings: null,
  lastMultipliers: null,
  observer: null,
  isVisible: true,
  isTransitioning: false,
  pendingImageUrl: null,
  transitionTimeoutId: null,
  currentScale: 1,
  targetScale: 1,
  scaleAnimationId: null,
  currentSpeed: 1,
  targetSpeed: 1,
  speedAnimationId: null,
  isPaused: false,
  highlightLuminance: null,
  videoMode: false,
  videoSource: null,
  videoUnavailableSince: null,
  failedVideoSrc: null,
  brightnessSampledAt: 0,
  brightnessSampledTime: -1,
  stopWatchingOutput: null,
});

const SCALE_LERP_UP = 0.5;
const SCALE_LERP_DOWN = 0.12;
const SCALE_THRESHOLD = 0.001;

const SPEED_LERP_UP = 0.05;
const SPEED_LERP_DOWN = 0.03;
const SPEED_THRESHOLD = 0.001;

export const PIP_LOCATION = "pip";

// Matches the cosine blend @kawarp/core uses for image crossfades.
const KAWARP_CROSSFADE_EASING = "cubic-bezier(0.37, 0, 0.63, 1)";
const SETTING_CHANGE_FILTER_TRANSITION_MS = 150;
const VIDEO_WATCH_INTERVAL_MS = 100;
// Buffering and source swaps briefly report no video; keep the last frame instead of flashing artwork.
const VIDEO_UNAVAILABLE_GRACE_MS = 1500;
const ZOOM_LERP_MIN = 0.01;
const ZOOM_LERP_MAX = 1;

const isVideoMode = (state: KawarpState): boolean => state.videoMode && !!state.lastSettings?.videoEnabled;
const hasHdrDisplay = (canvas: HTMLCanvasElement): boolean =>
  canvas.ownerDocument.defaultView?.matchMedia("(dynamic-range: high)").matches ?? false;

const outputDithering = (state: KawarpState, requested: number): number => {
  const reduction = isVideoMode(state) ? state.lastSettings?.videoHdrDitheringScale ?? 1 : 1;
  return state.instance?.highPrecisionOutput && state.canvas && hasHdrDisplay(state.canvas)
    ? requested * reduction
    : requested;
};

const watchOutputDisplay = (state: KawarpState): void => {
  const query = state.canvas?.ownerDocument.defaultView?.matchMedia("(dynamic-range: high)");
  const update = () => {
    if (state.instance && state.lastSettings) {
      const settings = state.lastSettings;
      state.instance.dithering = outputDithering(
        state,
        isVideoMode(state) ? settings.videoDithering : settings.kawarpDithering
      );
      logger.log("Canvas output precision", {
        canvas: state.container?.id,
        hdrDisplay: query?.matches ?? false,
        float16DrawingBuffer: state.instance.highPrecisionOutput,
      });
    }
  };
  update();
  query?.addEventListener("change", update);
  state.stopWatchingOutput = () => query?.removeEventListener("change", update);
};

const modeMotion = (state: KawarpState, settings: GradientSettings, multipliers: DynamicMultipliers) =>
  isVideoMode(state)
    ? videoMotion(settings, multipliers)
    : {
        speed: settings.kawarpAnimationSpeed * multipliers.speedMultiplier,
        scale: multipliers.scaleMultiplier,
      };

const applyModeSettings = (state: KawarpState, updateOpacity = true): void => {
  const settings = state.lastSettings;
  if (!state.instance || !settings) return;
  const video = isVideoMode(state);
  const motion = modeMotion(state, settings, state.lastMultipliers ?? DEFAULT_DYNAMIC_MULTIPLIERS);
  state.instance.setOptions({
    warpIntensity: video ? settings.videoWarpIntensity : settings.kawarpWarpIntensity,
    blurPasses: video ? settings.videoBlurPasses : settings.kawarpBlurPasses,
    animationSpeed: state.isPaused ? 0 : motion.speed,
    transitionDuration: settings.kawarpTransitionDuration,
    saturation: video ? settings.videoSaturation : settings.kawarpSaturation,
    dithering: outputDithering(state, video ? settings.videoDithering : settings.kawarpDithering),
  });
  if (state.isPaused) state.instance.renderFrame();
  state.currentSpeed = state.isPaused ? 0 : motion.speed;
  state.targetSpeed = state.currentSpeed;
  state.targetScale = motion.scale;
  if (state.scaleAnimationId === null) state.scaleAnimationId = requestAnimationFrame(() => animateScale(state));
  if (updateOpacity && state.container)
    state.container.style.opacity = String(video ? settings.videoOpacity : settings.kawarpOpacity);
};

const loadImageSafely = async (instance: Kawarp, url: string): Promise<void> => {
  try {
    await instance.loadImage(url);
  } catch {
    const response = await pageFetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    try {
      await instance.loadImage(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }
};

const applyArtworkBrightness = (state: KawarpState, transitionMs?: number): void => {
  if (!state.container || !state.lastSettings) return;
  const settings = state.lastSettings;
  const video = isVideoMode(state);
  const autoDimStrength = video ? settings.videoDimStrength : settings.autoDimStrength;
  const filterTransitionMs = video
    ? settings.videoBrightnessTransition
    : transitionMs ?? settings.kawarpTransitionDuration;
  const brightness =
    settings.autoDimBrightArtwork && state.highlightLuminance !== null
      ? brightnessForHighlight(state.highlightLuminance, autoDimStrength)
      : 1;
  const isHidden = state.container.style.opacity === "0";
  state.container.style.transition = `opacity 0.5s ease-out, filter ${isHidden ? 0 : filterTransitionMs}ms ${KAWARP_CROSSFADE_EASING}`;
  state.container.style.filter = brightness < 1 ? `brightness(${brightness})` : "";
};

const loadArtwork = async (state: KawarpState, instance: Kawarp, url: string): Promise<void> => {
  instance.transitionDuration = state.lastSettings?.kawarpTransitionDuration ?? 1000;
  const [, highlightLuminance] = await Promise.all([loadImageSafely(instance, url), measureArtworkHighlight(url)]);
  if (state.instance !== instance || state.videoMode) return;
  state.highlightLuminance = highlightLuminance;
  applyArtworkBrightness(state);
};

const animateScale = (state: KawarpState): void => {
  if (!state.instance) {
    state.scaleAnimationId = null;
    return;
  }

  const diff = state.targetScale - state.currentScale;

  if (Math.abs(diff) < SCALE_THRESHOLD) {
    state.currentScale = state.targetScale;
    state.instance.setOptions({ scale: state.currentScale });
    state.scaleAnimationId = null;
    return;
  }

  const settings = state.lastSettings;
  const lerpFactor =
    settings && isVideoMode(state)
      ? Math.min(
          ZOOM_LERP_MAX,
          Math.max(ZOOM_LERP_MIN, diff > 0 ? settings.videoZoomAttack : settings.videoZoomRelease) || ZOOM_LERP_MIN
        )
      : diff > 0
        ? SCALE_LERP_UP
        : SCALE_LERP_DOWN;
  state.currentScale += diff * lerpFactor;
  state.instance.setOptions({ scale: state.currentScale });

  state.scaleAnimationId = requestAnimationFrame(() => animateScale(state));
};

const animateSpeed = (state: KawarpState): void => {
  if (!state.instance) {
    state.speedAnimationId = null;
    return;
  }

  const diff = state.targetSpeed - state.currentSpeed;

  if (Math.abs(diff) < SPEED_THRESHOLD) {
    state.currentSpeed = state.targetSpeed;
    state.instance.animationSpeed = state.currentSpeed;
    state.speedAnimationId = null;
    if (state.currentSpeed === 0) {
      state.instance.stop();
    }
    return;
  }

  const lerpFactor = diff > 0 ? SPEED_LERP_UP : SPEED_LERP_DOWN;
  state.currentSpeed += diff * lerpFactor;
  state.instance.animationSpeed = state.currentSpeed;

  state.speedAnimationId = requestAnimationFrame(() => animateSpeed(state));
};

const kawarps = new Map<string, KawarpState>();
const creationInProgress = new Set<string>();
let lastKnownImageUrl: string | null = null;
let videoWatcherId: number | null = null;

const canSampleForState = (state: KawarpState): boolean =>
  !!state.instance &&
  !!state.container?.isConnected &&
  state.isVisible &&
  state.container.ownerDocument.visibilityState === "visible";

// Kawarp replaces every option on each loadVideo call, so the error handler must ride along each time.
const videoSourceOptions = (
  state: KawarpState,
  video: HTMLVideoElement,
  settings: GradientSettings
): KawarpVideoOptions => ({
  sampleWidth: settings.videoSampleWidth,
  sampleHeight: settings.videoSampleHeight,
  downsampleFactor: settings.videoDownsampleFactor,
  frameRate: settings.videoFrameRate,
  smoothing: settings.videoColorResponse,
  onError: error => {
    logger.error("Video ambient colors unavailable for this source:", error);
    state.failedVideoSrc = video.currentSrc;
    if (state.videoSource === video) state.videoSource = null;
  },
});

const isPlayable = (video: HTMLVideoElement | null): video is HTMLVideoElement =>
  !!video && !video.error && video.videoWidth > 0;

const findPlayableVideo = (): HTMLVideoElement | null => {
  if (isAdPlaying()) return null;
  const playerVideo = document.querySelector<HTMLVideoElement>(PLAYER_VIDEO_SELECTOR);
  if (isPlayable(playerVideo)) return playerVideo;
  const animatedArt = document.querySelector<HTMLVideoElement>(ANIMATED_ART_VIDEO_SELECTOR);
  return isPlayable(animatedArt) ? animatedArt : null;
};

const followVideo = (state: KawarpState, video: HTMLVideoElement, settings: GradientSettings): void => {
  const instance = state.instance;
  if (!instance) return;
  state.videoSource = video;
  try {
    instance.loadVideo(video, videoSourceOptions(state, video, settings));
  } catch (error) {
    logger.error("Video ambient colors unsupported:", error);
    stopFollowingVideo(state);
    state.failedVideoSrc = video.currentSrc;
  }
  // The first frame imports synchronously, so a failure has already cleared videoSource.
  if (state.videoSource !== video) return;
  state.videoUnavailableSince = null;
  if (state.videoMode) return;
  state.videoMode = true;
  state.highlightLuminance = null;
  state.brightnessSampledAt = 0;
  applyModeSettings(state);
  applyArtworkBrightness(state);
  logger.log("Following video", {
    canvas: state.container?.id,
    source: video.id || "player",
    float32History: instance.highPrecisionInput,
    float16DrawingBuffer: instance.highPrecisionOutput,
  });
};

const stopFollowingVideo = (state: KawarpState): void => {
  state.instance?.unloadVideo();
  state.videoSource = null;
};

const leaveVideoMode = (state: KawarpState, location: string): void => {
  stopFollowingVideo(state);
  state.videoMode = false;
  state.videoUnavailableSince = null;
  applyModeSettings(state);
  const artwork = getAlbumArtUrl() ?? state.currentImageUrl;
  if (artwork) void resolveImageUrl(artwork).then(url => processImageTransition(state, url, location));
};

const sampleVideoBrightness = (state: KawarpState, now: number): void => {
  const instance = state.instance;
  const settings = state.lastSettings;
  const video = state.videoSource;
  if (!instance || !settings?.autoDimBrightArtwork || !video) return;
  if (now - state.brightnessSampledAt < settings.videoBrightnessInterval) return;
  // A paused frame only changes after a seek, so re-measure once it has settled.
  if (video.seeking) return;
  if (video.paused && state.highlightLuminance !== null && video.currentTime === state.brightnessSampledTime) return;
  state.brightnessSampledAt = now;
  state.brightnessSampledTime = video.currentTime;
  void instance.sampleSource(settings.videoBrightnessSampleSize).then(pixels => {
    if (!pixels || state.instance !== instance || !state.videoMode) return;
    state.highlightLuminance = measureHighlightLuminance(
      new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength)
    );
    applyArtworkBrightness(state);
  });
};

const syncVideoSource = (
  state: KawarpState,
  location: string,
  playableVideo: HTMLVideoElement | null,
  now: number
): void => {
  const settings = state.lastSettings;
  if (!state.instance || !settings) return;

  if (!settings.videoEnabled) {
    if (state.videoMode) leaveVideoMode(state, location);
    return;
  }
  // Off-screen instances keep their last frame without importing new ones.
  if (!canSampleForState(state)) {
    if (state.videoSource) stopFollowingVideo(state);
    return;
  }

  const followableVideo = playableVideo?.currentSrc === state.failedVideoSrc ? null : playableVideo;
  if (followableVideo) {
    // An artwork load in flight would unload the video when it lands; follow once it settles.
    if (state.videoSource !== followableVideo) {
      if (state.isTransitioning) return;
      followVideo(state, followableVideo, settings);
    }
    if (state.videoSource) {
      sampleVideoBrightness(state, now);
      return;
    }
  }

  if (state.videoSource) stopFollowingVideo(state);
  if (!state.videoMode) return;
  state.videoUnavailableSince ??= now;
  if (now - state.videoUnavailableSince >= VIDEO_UNAVAILABLE_GRACE_MS) leaveVideoMode(state, location);
};

const syncVideoSources = (): void => {
  let videoWanted = false;
  let anyVisible = false;
  for (const state of kawarps.values()) {
    if (state.lastSettings?.videoEnabled || state.videoMode) videoWanted = true;
    if (canSampleForState(state)) anyVisible = true;
  }
  if (!videoWanted) return;
  const playableVideo = anyVisible ? findPlayableVideo() : null;
  const now = performance.now();
  for (const [location, state] of kawarps) syncVideoSource(state, location, playableVideo, now);
};

const startVideoWatcher = (): void => {
  if (videoWatcherId !== null) return;
  videoWatcherId = window.setInterval(syncVideoSources, VIDEO_WATCH_INTERVAL_MS);
  syncVideoSources();
};

const stopVideoWatcher = (): void => {
  if (videoWatcherId === null) return;
  window.clearInterval(videoWatcherId);
  videoWatcherId = null;
};

const getKawarpState = (location: string): KawarpState => {
  if (!kawarps.has(location)) {
    kawarps.set(location, createEmptyState());
  }
  return kawarps.get(location)!;
};

const settingsEqual = (a: GradientSettings | null, b: GradientSettings): boolean => {
  if (!a) return false;
  return (Object.keys(b) as (keyof GradientSettings)[]).every(key => a[key] === b[key]);
};

const getLocationFromSelector = (targetSelector: string): string => {
  if (targetSelector === "player-page") return "player";
  if (targetSelector === "search-page") return "search";
  return "homepage";
};

const getTargetElement = (targetSelector: string): Element | null => {
  if (targetSelector === "player-page") {
    return document.getElementById("player-page");
  }
  if (targetSelector === "search-page") {
    return document.getElementById("search-page");
  }
  return document.querySelector(".background-gradient.style-scope.ytmusic-browse-response");
};

const waitForTargetReady = async (targetSelector: string, maxWaitMs: number = 5000): Promise<boolean> => {
  const target = getTargetElement(targetSelector);
  const hasContent = target && target.children.length > 0;

  if (hasContent) {
    const delay = targetSelector === "player-page" ? 1000 : 100;
    await new Promise(resolve => setTimeout(resolve, delay));
    return true;
  }

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, maxWaitMs);

    const observer = new MutationObserver(() => {
      const target = getTargetElement(targetSelector);
      if (target && target.children.length > 0) {
        clearTimeout(timeout);
        observer.disconnect();
        const delay = targetSelector === "player-page" ? 1000 : 100;
        setTimeout(() => resolve(true), delay);
      }
    });

    const appElement = document.querySelector("ytmusic-app");
    if (appElement) {
      observer.observe(appElement, { childList: true, subtree: true });
    } else {
      clearTimeout(timeout);
      resolve(false);
    }
  });
};

const getVideoIdFromUrl = (): string | null => {
  const url = new URL(window.location.href);
  return url.searchParams.get("v");
};

const getHqFallbackUrl = (src: string): string | null => {
  const match = src.match(/i\.ytimg\.com\/vi\/([^/]+)\//);
  if (!match) return null;
  return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
};

const placeholderCache = new Map<string, string>();

const resolveImageUrl = (url: string): Promise<string> => {
  if (!url.includes("i.ytimg.com/vi/")) return Promise.resolve(url);

  const cached = placeholderCache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth === 120 && img.naturalHeight === 90) {
        const fallback = getHqFallbackUrl(url);
        if (fallback) {
          logger.log("Detected default YouTube thumbnail placeholder, using hqdefault fallback");
          placeholderCache.set(url, fallback);
          resolve(fallback);
          return;
        }
      }
      placeholderCache.set(url, url);
      resolve(url);
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
};

const getAlbumArtUrl = (): string | null => {
  const songImage = document.querySelector(`${SONG_IMAGE_CONTAINER_SELECTOR} img`) as HTMLImageElement;
  if (songImage?.src && !songImage.src.startsWith("data:") && songImage.naturalHeight > 0) {
    return songImage.src;
  }

  const videoId = getVideoIdFromUrl();
  if (videoId) {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }

  const playerBarThumbnail = document.querySelector(
    `${PLAYER_BAR_THUMBNAIL_CONTAINER_SELECTOR} img`
  ) as HTMLImageElement;
  if (playerBarThumbnail?.src && !playerBarThumbnail.src.startsWith("data:") && playerBarThumbnail.naturalHeight > 0) {
    return playerBarThumbnail.src;
  }

  return null;
};

export const createKawarp = async (
  settings: GradientSettings,
  multipliers: DynamicMultipliers,
  targetSelector: string = "player-page"
): Promise<boolean> => {
  const location = getLocationFromSelector(targetSelector);

  // Prevent concurrent creation attempts
  if (creationInProgress.has(location)) {
    logger.log(`Kawarp creation already in progress for ${location}, skipping`);
    return false;
  }

  let state = getKawarpState(location);

  if (state.instance) {
    logger.log(`Kawarp already exists for ${location}, destroying first`);
    destroyKawarp(location);
    state = getKawarpState(location);
  }

  creationInProgress.add(location);

  const isReady = await waitForTargetReady(targetSelector);
  if (!isReady) {
    creationInProgress.delete(location);
    return false;
  }

  const targetElement = getTargetElement(targetSelector);

  logger.log("createKawarp - targetSelector:", targetSelector, "targetElement found:", !!targetElement);

  if (!targetElement) {
    logger.error("Target element not found for selector:", targetSelector);
    creationInProgress.delete(location);
    return false;
  }

  const existingKawarp = targetElement.querySelector(`#better-lyrics-kawarp-${location}`);
  if (existingKawarp) {
    existingKawarp.remove();
  }

  // The layers sit at negative z-index so page content paints above them. That only scopes
  // correctly when the target establishes a stacking context: #player-page already does via
  // its own z-index, but the browse and search targets do not, and without this the layers
  // escape to the root stacking context and render beneath YouTube Music's own page gradient.
  state.target = targetElement as HTMLElement;
  state.target.style.isolation = "isolate";

  state.container = document.createElement("div");
  state.container.id = `better-lyrics-kawarp-${location}`;
  const isBrowsePage = targetSelector !== "player-page";

  state.backdrop = document.createElement("div");
  state.backdrop.id = `better-lyrics-kawarp-backdrop-${location}`;
  state.backdrop.style.cssText = isBrowsePage
    ? `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: -2;
      background-color: #000;
      opacity: 0;
      will-change: opacity;
      transition: opacity 0.5s ease-out;
    `
    : `
      --sidebar: 240px;
      position: absolute;
      top: calc(-1 * var(--ytmusic-nav-bar-height, 64px));
      left: calc(-1 * var(--sidebar));
      width: calc(100% + var(--sidebar));
      height: calc(100% + var(--ytmusic-nav-bar-height, 64px) + var(--ytmusic-player-bar-height, 72px));
      pointer-events: none;
      z-index: -2;
      background-color: #000;
      opacity: 0;
      will-change: opacity;
      transition: opacity 0.5s ease-out;
    `;

  state.container.style.cssText = isBrowsePage
    ? `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: -1;
      opacity: 0;
      will-change: opacity, transform;
      transition: opacity 0.5s ease-out;
    `
    : `
      --sidebar: 240px;
      position: absolute;
      top: calc(-1 * var(--ytmusic-nav-bar-height, 64px));
      left: calc(-1 * var(--sidebar));
      width: calc(100% + var(--sidebar));
      height: calc(100% + var(--ytmusic-nav-bar-height, 64px) + var(--ytmusic-player-bar-height, 72px));
      pointer-events: none;
      z-index: -1;
      opacity: 0;
      will-change: opacity, transform;
      transition: opacity 0.5s ease-out;
    `;

  state.canvas = document.createElement("canvas");
  state.canvas.style.cssText = `
    width: 100%;
    height: 100%;
    display: block;
  `;
  state.container.appendChild(state.canvas);

  targetElement.insertBefore(state.backdrop, targetElement.firstChild);
  targetElement.insertBefore(state.container, state.backdrop.nextSibling);

  const dynamicSpeed = settings.kawarpAnimationSpeed * multipliers.speedMultiplier;

  state.instance = new Kawarp(state.canvas, {
    highPrecisionInput: true,
    highPrecisionOutput: hasHdrDisplay(state.canvas),
    warpIntensity: settings.kawarpWarpIntensity,
    blurPasses: settings.kawarpBlurPasses,
    animationSpeed: dynamicSpeed,
    transitionDuration: settings.kawarpTransitionDuration,
    saturation: settings.kawarpSaturation,
    dithering: settings.kawarpDithering,
    scale: 1,
  });

  state.currentSpeed = dynamicSpeed;
  state.targetSpeed = dynamicSpeed;
  state.lastSettings = { ...settings };
  state.lastMultipliers = { ...multipliers };
  watchOutputDisplay(state);

  state.isTransitioning = true;
  let albumArtUrl = getAlbumArtUrl();
  if (albumArtUrl) {
    albumArtUrl = await resolveImageUrl(albumArtUrl);
    try {
      await loadArtwork(state, state.instance, albumArtUrl);
      state.currentImageUrl = albumArtUrl;
      lastKnownImageUrl = albumArtUrl;
      logger.log("Kawarp loaded album art:", albumArtUrl);
    } catch (error) {
      logger.error("Failed to load album art for kawarp:", error);
    }
  }

  state.instance.start();
  state.isTransitioning = false;
  processQueuedImage(state, location);
  startVideoWatcher();

  state.observer = new IntersectionObserver(
    entries => {
      const entry = entries[0];
      const isVisible = entry.isIntersecting;

      if (state.isVisible !== isVisible) {
        state.isVisible = isVisible;
        if (state.instance) {
          if (isVisible) {
            state.instance.start();
          } else {
            state.instance.stop();
          }
        }
      }
    },
    { threshold: 0.1 }
  );

  state.observer.observe(state.container);

  void state.container.offsetHeight;

  // Delay fade-in to let kawarp render a few frames first
  setTimeout(() => {
    requestAnimationFrame(() => {
      if (state.container) {
        state.container.style.opacity = String(isVideoMode(state) ? settings.videoOpacity : settings.kawarpOpacity);
      }
      if (state.backdrop) {
        state.backdrop.style.opacity = "1";
      }
    });
  }, 300);

  creationInProgress.delete(location);
  return true;
};

export const destroyKawarp = (location?: string): void => {
  if (location) {
    const state = getKawarpState(location);
    logger.log(`Destroying kawarp for location: ${location}`);
    stopFollowingVideo(state);
    state.stopWatchingOutput?.();
    state.stopWatchingOutput = null;

    if (state.transitionTimeoutId !== null) {
      clearTimeout(state.transitionTimeoutId);
      state.transitionTimeoutId = null;
    }
    if (state.scaleAnimationId !== null) {
      cancelAnimationFrame(state.scaleAnimationId);
      state.scaleAnimationId = null;
    }
    if (state.speedAnimationId !== null) {
      cancelAnimationFrame(state.speedAnimationId);
      state.speedAnimationId = null;
    }
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    if (state.instance) {
      state.instance.stop();
      state.instance.dispose();
      state.instance = null;
    }
    if (state.container) {
      state.container.remove();
      state.container = null;
    }
    if (state.backdrop) {
      state.backdrop.remove();
      state.backdrop = null;
    }
    if (state.target) {
      state.target.style.removeProperty("isolation");
      state.target = null;
    }
    state.canvas = null;
    state.currentImageUrl = null;
    state.lastSettings = null;
    state.lastMultipliers = null;
    state.isVisible = true;
    state.isTransitioning = false;
    state.pendingImageUrl = null;
    state.currentScale = 1;
    state.targetScale = 1;
    state.currentSpeed = 1;
    state.targetSpeed = 1;
    state.isPaused = false;

    kawarps.delete(location);
    if (!Array.from(kawarps.values()).some(state => state.instance)) {
      stopVideoWatcher();
    }
  } else {
    logger.log("Destroying all kawarps");
    for (const loc of kawarps.keys()) {
      destroyKawarp(loc);
    }
  }
};

const processQueuedImage = (state: KawarpState, location: string): void => {
  const queuedImageUrl = state.pendingImageUrl;
  state.pendingImageUrl = null;
  if (!queuedImageUrl || queuedImageUrl === state.currentImageUrl) return;
  logger.log(`Processing queued image for ${location}:`, queuedImageUrl);
  void processImageTransition(state, queuedImageUrl, location);
};

const processImageTransition = async (state: KawarpState, imageUrl: string, location: string): Promise<void> => {
  // Loading artwork would replace the video; leaveVideoMode restores the current artwork instead.
  if (!state.instance || !state.container || state.videoMode) return;

  const transitionDuration = state.lastSettings?.kawarpTransitionDuration ?? 1000;

  state.isTransitioning = true;

  if (state.transitionTimeoutId !== null) {
    clearTimeout(state.transitionTimeoutId);
  }

  try {
    const instance = state.instance;
    await loadArtwork(state, instance, imageUrl);
    if (state.instance !== instance) return;
    state.currentImageUrl = imageUrl;
    lastKnownImageUrl = imageUrl;
    logger.log(`Updated kawarp image for ${location}:`, imageUrl);
  } catch (error) {
    logger.error("Failed to update kawarp image:", error);
    state.isTransitioning = false;
    return;
  }

  state.transitionTimeoutId = window.setTimeout(() => {
    if (state.isPaused) state.instance?.renderFrame();
    state.isTransitioning = false;
    state.transitionTimeoutId = null;
    processQueuedImage(state, location);
  }, transitionDuration);
};

export const updateKawarpImage = async (location: string = "player"): Promise<void> => {
  const state = getKawarpState(location);

  if (!state.instance || !state.container) return;

  let albumArtUrl = getAlbumArtUrl();
  if (!albumArtUrl || albumArtUrl === state.currentImageUrl) return;

  albumArtUrl = await resolveImageUrl(albumArtUrl);
  if (albumArtUrl === state.currentImageUrl) return;

  if (state.isTransitioning) {
    logger.log(`Transition in progress for ${location}, queueing image:`, albumArtUrl);
    state.pendingImageUrl = albumArtUrl;
    return;
  }

  await processImageTransition(state, albumArtUrl, location);
};

export const updateKawarpSpeed = (
  settings: GradientSettings,
  multipliers: DynamicMultipliers,
  location?: string
): void => {
  const updateForLocation = (loc: string) => {
    const state = getKawarpState(loc);

    if (!state.instance || !state.container) {
      return;
    }

    const beatChanged = state.lastMultipliers?.isBeat !== multipliers.isBeat;
    const speedChanged = state.lastMultipliers?.speedMultiplier !== multipliers.speedMultiplier || beatChanged;
    const scaleChanged = state.lastMultipliers?.scaleMultiplier !== multipliers.scaleMultiplier;

    if (!speedChanged && !scaleChanged) {
      return;
    }

    const motion = modeMotion(state, settings, multipliers);
    if (speedChanged) {
      state.instance.animationSpeed = state.isPaused ? 0 : motion.speed;
      state.currentSpeed = state.isPaused ? 0 : motion.speed;
      state.targetSpeed = state.currentSpeed;
    }

    if (scaleChanged || (isVideoMode(state) && speedChanged)) {
      state.targetScale = motion.scale;
      if (state.scaleAnimationId === null) {
        state.scaleAnimationId = requestAnimationFrame(() => animateScale(state));
      }
    }

    state.lastMultipliers = { ...multipliers };
  };

  if (location) {
    updateForLocation(location);
  } else {
    for (const loc of kawarps.keys()) {
      updateForLocation(loc);
    }
  }
};

export const updateKawarpSettings = (
  settings: GradientSettings,
  multipliers: DynamicMultipliers,
  location?: string
): void => {
  const updateForLocation = (loc: string) => {
    const state = getKawarpState(loc);

    if (!state.instance || !state.container) {
      return;
    }

    // If container was removed from DOM, clean up state
    if (!state.container.ownerDocument.contains(state.container)) {
      logger.log(`Container for ${loc} was removed from DOM, cleaning up state`);
      destroyKawarp(loc);
      return;
    }

    if (settingsEqual(state.lastSettings, settings)) {
      return;
    }

    state.lastSettings = { ...settings };
    state.lastMultipliers = { ...multipliers };
    applyModeSettings(state);
    if (state.videoSource)
      state.instance.loadVideo(state.videoSource, videoSourceOptions(state, state.videoSource, settings));
    syncVideoSource(state, loc, settings.videoEnabled ? findPlayableVideo() : null, performance.now());

    applyArtworkBrightness(state, SETTING_CHANGE_FILTER_TRANSITION_MS);
  };

  if (location) {
    updateForLocation(location);
  } else {
    for (const loc of kawarps.keys()) {
      updateForLocation(loc);
    }
  }
};

export const hasKawarp = (location?: string): boolean => {
  if (location) {
    const state = getKawarpState(location);
    return (
      state.instance !== null && state.container !== null && state.container.ownerDocument.contains(state.container)
    );
  }
  return (
    kawarps.size > 0 &&
    Array.from(kawarps.values()).some(
      s => s.instance !== null && s.container !== null && s.container.ownerDocument.contains(s.container)
    )
  );
};

export const getCurrentImageUrl = (): string | null => {
  return lastKnownImageUrl;
};

export const cleanupOrphanedKawarps = (): void => {
  const existingKawarps = document.querySelectorAll("[id^='better-lyrics-kawarp']");
  existingKawarps.forEach(kawarp => kawarp.remove());
  logger.log("Cleaned up orphaned kawarps:", existingKawarps.length);
};

export const pauseKawarp = (location?: string): void => {
  const pauseForLocation = (loc: string) => {
    const state = getKawarpState(loc);
    if (!state.instance || state.isPaused) return;

    state.isPaused = true;
    state.targetSpeed = 0;

    if (state.speedAnimationId === null) {
      state.speedAnimationId = requestAnimationFrame(() => animateSpeed(state));
    }
  };

  if (location) {
    pauseForLocation(location);
  } else {
    for (const loc of kawarps.keys()) {
      pauseForLocation(loc);
    }
  }
};

export const resumeKawarp = (location?: string): void => {
  const resumeForLocation = (loc: string) => {
    const state = getKawarpState(loc);
    if (!state.instance || !state.isPaused) return;

    state.isPaused = false;
    if (state.isVisible) state.instance.start();

    const settings = state.lastSettings ?? DEFAULT_GRADIENT_SETTINGS;
    state.targetSpeed = modeMotion(state, settings, state.lastMultipliers ?? DEFAULT_DYNAMIC_MULTIPLIERS).speed;

    if (state.speedAnimationId === null) {
      state.speedAnimationId = requestAnimationFrame(() => animateSpeed(state));
    }
  };

  if (location) {
    resumeForLocation(location);
  } else {
    for (const loc of kawarps.keys()) {
      resumeForLocation(loc);
    }
  }
};

export const createPipKawarp = async (
  pipWindow: Window,
  settings: GradientSettings,
  multipliers: DynamicMultipliers,
  imageUrl: string | null
): Promise<boolean> => {
  if (creationInProgress.has(PIP_LOCATION)) return false;

  let state = getKawarpState(PIP_LOCATION);
  if (state.instance) {
    destroyKawarp(PIP_LOCATION);
    state = getKawarpState(PIP_LOCATION);
  }

  creationInProgress.add(PIP_LOCATION);

  try {
    const pipDocument = pipWindow.document;

    state.container = pipDocument.createElement("div");
    state.container.id = `better-lyrics-kawarp-${PIP_LOCATION}`;
    state.container.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: -2;
      opacity: 0;
      will-change: opacity;
      transition: opacity 0.5s ease-out;
    `;

    state.canvas = pipDocument.createElement("canvas");
    state.canvas.style.cssText = "width: 100%; height: 100%; display: block;";
    state.container.appendChild(state.canvas);
    pipDocument.body.prepend(state.container);

    const dynamicSpeed = modeMotion(state, settings, multipliers).speed;

    state.instance = new Kawarp(state.canvas, {
      highPrecisionInput: true,
      highPrecisionOutput: hasHdrDisplay(state.canvas),
      warpIntensity: settings.kawarpWarpIntensity,
      blurPasses: settings.kawarpBlurPasses,
      animationSpeed: dynamicSpeed,
      transitionDuration: settings.kawarpTransitionDuration,
      saturation: settings.kawarpSaturation,
      dithering: settings.kawarpDithering,
      scale: 1,
    });

    state.currentSpeed = dynamicSpeed;
    state.targetSpeed = dynamicSpeed;
    state.lastSettings = { ...settings };
    state.lastMultipliers = { ...multipliers };
    watchOutputDisplay(state);

    if (imageUrl) {
      state.isTransitioning = true;
      try {
        await loadArtwork(state, state.instance, imageUrl);
        state.currentImageUrl = imageUrl;
      } catch (error) {
        logger.error("Failed to load artwork for pip kawarp:", error);
      } finally {
        state.isTransitioning = false;
      }
    }

    state.instance.start();
    state.container.style.opacity = String(isVideoMode(state) ? settings.videoOpacity : settings.kawarpOpacity);
    startVideoWatcher();

    logger.log("Mounted kawarp in the floating window");
    return true;
  } catch (error) {
    logger.error("Failed to mount kawarp in the floating window:", error);
    destroyKawarp(PIP_LOCATION);
    return false;
  } finally {
    creationInProgress.delete(PIP_LOCATION);
  }
};

export const setPipKawarpImage = async (imageUrl: string): Promise<void> => {
  const state = getKawarpState(PIP_LOCATION);
  if (!state.instance || imageUrl === state.currentImageUrl) return;

  if (state.isTransitioning) {
    state.pendingImageUrl = imageUrl;
    return;
  }

  await processImageTransition(state, imageUrl, PIP_LOCATION);
};
