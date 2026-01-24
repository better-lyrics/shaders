import { Storage } from "@plasmohq/storage";
import { logger } from "@/shared/utils/logger";

const API_ENDPOINT = "https://artwork.boidu.dev";
const VIDEO_ELEMENT_ID = "bls-video";
const NOT_FOUND_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const storage = new Storage();

interface PlayerData {
  videoId: string;
  song: string;
  artist: string;
  duration: number;
}

interface ArtworkResponse {
  albumId: string;
  animated: boolean;
  artist: string;
  name: string;
  static: string;
  videoUrl: string | null;
}

interface NotFoundEntry {
  notFoundAt: number;
}

type CachedArtwork = string | NotFoundEntry;

interface LongBylineRun {
  text: string;
}

interface PlaylistPanelVideoRenderer {
  videoId: string;
  longBylineText?: {
    runs: LongBylineRun[];
  };
}

interface PlaylistContent {
  playlistPanelVideoRenderer?: PlaylistPanelVideoRenderer;
  playlistPanelVideoWrapperRenderer?: {
    primaryRenderer?: {
      playlistPanelVideoRenderer?: PlaylistPanelVideoRenderer;
    };
  };
}

let isEnabled = false;
let currentPlayerData: PlayerData | null = null;
let lastProcessedVideoId: string | null = null;
let pendingFetch: AbortController | null = null;

const videoIdToAlbumMap = new Map<string, string>();

function abortPendingFetch(): void {
  if (pendingFetch) {
    pendingFetch.abort();
    pendingFetch = null;
  }
}

function extractAlbumFromDOMOnce(): string | null {
  const byline =
    document.querySelector("yt-formatted-string.byline.ytmusic-player-bar") ||
    document.querySelector(".subtitle.ytmusic-player-bar yt-formatted-string.byline") ||
    document.querySelector("ytmusic-player-bar .byline");

  if (!byline) return null;

  const links = byline.querySelectorAll("a");
  if (links.length >= 2) {
    return links[links.length - 1].textContent?.trim() || null;
  }

  return null;
}

async function extractAlbumFromDOM(maxRetries = 10, delayMs = 100): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    const album = extractAlbumFromDOMOnce();
    if (album) {
      logger.log("Animated art: extracted album from DOM:", album);
      return album;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  logger.log("Animated art: byline element not found after retries");
  return null;
}

function isValidBylinePart(text: string | undefined): text is string {
  if (!text || text.length === 0) return false;
  if (text === "•" || text === "&") return false;
  if (text.includes("views") || text.includes("likes")) return false;
  return true;
}

function extractBylineAlbum(longBylineText: { runs: LongBylineRun[] }): string {
  const parts = longBylineText.runs.map(r => r.text?.trim()).filter(isValidBylinePart);

  if (parts.length >= 2) {
    return parts[parts.length - 2] || "";
  }
  return "";
}

function processPlaylistContents(contents: PlaylistContent[]): void {
  for (const content of contents) {
    const renderer =
      content.playlistPanelVideoRenderer ||
      content.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;

    if (!renderer?.videoId) continue;

    if (renderer.longBylineText) {
      const album = extractBylineAlbum(renderer.longBylineText);
      if (album) {
        videoIdToAlbumMap.set(renderer.videoId, album);
      }
    }
  }

  if (videoIdToAlbumMap.size > 100) {
    const keys = Array.from(videoIdToAlbumMap.keys());
    for (let i = 0; i < 50; i++) {
      videoIdToAlbumMap.delete(keys[i]);
    }
  }
}

function extractFromNextResponse(requestJson: unknown, responseJson: unknown): void {
  try {
    const request = requestJson as Record<string, unknown>;
    const response = responseJson as Record<string, unknown>;

    const requestVideoId = request?.videoId as string;

    const endpoint = response?.currentVideoEndpoint as Record<string, unknown>;
    const watchEndpoint = endpoint?.watchEndpoint as Record<string, unknown>;
    const currentEndpointVideoId = watchEndpoint?.videoId as string;

    const contents = response?.contents as Record<string, unknown>;
    const singleColumn = contents?.singleColumnMusicWatchNextResultsRenderer as Record<string, unknown>;
    const tabbedRenderer = singleColumn?.tabbedRenderer as Record<string, unknown>;
    const watchNextRenderer = tabbedRenderer?.watchNextTabbedResultsRenderer as Record<string, unknown>;
    const tabs = watchNextRenderer?.tabs as Array<Record<string, unknown>>;

    let playlistContents: PlaylistContent[] | null = null;

    if (tabs) {
      for (const tab of tabs) {
        const tabRenderer = tab?.tabRenderer as Record<string, unknown>;
        const content = tabRenderer?.content as Record<string, unknown>;
        const musicQueue = content?.musicQueueRenderer as Record<string, unknown>;
        const queueContent = musicQueue?.content as Record<string, unknown>;
        const playlistPanel = queueContent?.playlistPanelRenderer as Record<string, unknown>;
        const panelContents = playlistPanel?.contents as PlaylistContent[];

        if (panelContents) {
          playlistContents = panelContents;
          break;
        }
      }
    }

    if (!playlistContents) {
      const continuationContents = response?.continuationContents as Record<string, unknown>;
      const playlistContinuation = continuationContents?.playlistPanelContinuation as Record<string, unknown>;
      playlistContents = playlistContinuation?.contents as PlaylistContent[];
    }

    if (!playlistContents) {
      const endpoints = response?.onResponseReceivedEndpoints as Array<Record<string, unknown>>;
      if (endpoints?.[0]) {
        const queueUpdate = endpoints[0]?.queueUpdateCommand as Record<string, unknown>;
        const inlineContents = queueUpdate?.inlineContents as Record<string, unknown>;
        const playlistPanel = inlineContents?.playlistPanelRenderer as Record<string, unknown>;
        playlistContents = playlistPanel?.contents as PlaylistContent[];
      }
    }

    if (playlistContents) {
      processPlaylistContents(playlistContents);
    }

    const playerOverlays = response?.playerOverlays as Record<string, unknown>;
    const playerOverlayRenderer = playerOverlays?.playerOverlayRenderer as Record<string, unknown>;
    const browserMediaSession = playerOverlayRenderer?.browserMediaSession as Record<string, unknown>;
    const mediaSessionRenderer = browserMediaSession?.browserMediaSessionRenderer as Record<string, unknown>;

    if (mediaSessionRenderer) {
      const albumRuns = (mediaSessionRenderer?.album as Record<string, unknown>)?.runs as Array<
        Record<string, unknown>
      >;
      const album = albumRuns?.[0]?.text as string;

      if (album) {
        if (requestVideoId) {
          videoIdToAlbumMap.set(requestVideoId, album);
        }
        if (currentEndpointVideoId && currentEndpointVideoId !== requestVideoId) {
          videoIdToAlbumMap.set(currentEndpointVideoId, album);
        }
      }
    }
  } catch (error) {
    logger.log("Animated art: extraction error", error);
  }
}

function getCacheKey(artist: string, album: string): string {
  return `bls_${artist}|${album}`;
}

function isNotFoundEntry(value: CachedArtwork): value is NotFoundEntry {
  return typeof value === "object" && "notFoundAt" in value;
}

async function fetchArtworkUrl(
  song: string,
  artist: string,
  duration: number,
  album: string,
  signal: AbortSignal
): Promise<string | null> {
  const cacheKey = getCacheKey(artist, album);

  try {
    const cached = await storage.get<CachedArtwork>(cacheKey);

    if (cached !== undefined) {
      if (typeof cached === "string") {
        logger.log(`Animated art: cache hit for "${artist} - ${album}"`, {
          cacheKey,
        });
        return cached;
      }

      if (isNotFoundEntry(cached)) {
        const isExpired = Date.now() - cached.notFoundAt >= NOT_FOUND_EXPIRY_MS;
        if (!isExpired) {
          logger.log(`Animated art: cache hit (not found) for "${artist} - ${album}"`, { cacheKey });
          return null;
        }
        logger.log(`Animated art: not-found cache expired for "${artist} - ${album}"`, { cacheKey });
      }
    }
  } catch (error) {
    logger.log("Animated art: cache read error", error);
  }

  logger.log(`Animated art: fetching for "${artist} - ${album}"`, { cacheKey });

  const params = new URLSearchParams({
    s: song,
    a: artist,
    d: Math.round(duration).toString(),
    al: album,
  });

  const url = `${API_ENDPOINT}?${params.toString()}`;

  try {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      logger.log("Animated art: API error", response.status);
      return null;
    }

    const data: ArtworkResponse = await response.json();

    if (data.videoUrl) {
      await storage.set(cacheKey, data.videoUrl);
      logger.log(`Animated art: cached "${artist} - ${album}"`, { cacheKey });
    } else {
      await storage.set(cacheKey, {
        notFoundAt: Date.now(),
      } satisfies NotFoundEntry);
      logger.log(`Animated art: cached not-found for "${artist} - ${album}"`, {
        cacheKey,
      });
    }

    return data.videoUrl;
  } catch (error) {
    logger.log("Animated art: fetch error", error);
    return null;
  }
}

function createVideoElement(videoUrl: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.id = VIDEO_ELEMENT_ID;
  video.muted = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2;";

  const source = document.createElement("source");
  source.src = videoUrl;
  source.type = "video/mp4";
  video.appendChild(source);

  return video;
}

function injectAnimatedArt(videoUrl: string): void {
  const thumbnail = document.querySelector("#thumbnail") as HTMLElement | null;
  if (!thumbnail) {
    logger.log("Animated art: #thumbnail not found");
    return;
  }

  const existingVideo = thumbnail.querySelector(`#${VIDEO_ELEMENT_ID}`);
  if (existingVideo) {
    existingVideo.remove();
  }

  thumbnail.style.isolation = "isolate";
  const video = createVideoElement(videoUrl);
  thumbnail.appendChild(video);

  logger.log("Animated art: video injected");
}

function removeAnimatedArt(): void {
  const video = document.querySelector(`#${VIDEO_ELEMENT_ID}`);
  if (!video) return;

  const thumbnail = video.parentElement;
  video.remove();
  if (thumbnail) {
    thumbnail.style.isolation = "";
  }
}

async function tryFetchArtwork(): Promise<void> {
  if (!isEnabled || !currentPlayerData) return;

  const { videoId, song, artist, duration } = currentPlayerData;

  if (videoId === lastProcessedVideoId) return;

  lastProcessedVideoId = videoId;

  abortPendingFetch();

  let album = videoIdToAlbumMap.get(videoId);
  if (!album) {
    album = (await extractAlbumFromDOM()) || "";
    if (album) {
      videoIdToAlbumMap.set(videoId, album);
    }
  }

  logger.log("Animated art: fetching", { song, artist, album, videoId });

  pendingFetch = new AbortController();

  const videoUrl = await fetchArtworkUrl(song, artist, duration, album, pendingFetch.signal);

  pendingFetch = null;

  if (!isEnabled || videoId !== currentPlayerData?.videoId) return;

  if (videoUrl) {
    injectAnimatedArt(videoUrl);
  } else {
    removeAnimatedArt();
  }
}

function handlePlayerTime(event: Event): void {
  if (!isEnabled) return;

  const customEvent = event as CustomEvent<PlayerData>;
  const { videoId, song, artist, duration } = customEvent.detail;

  if (currentPlayerData && currentPlayerData.videoId !== videoId) {
    logger.log("Animated art: song changed, clearing old artwork");
    abortPendingFetch();
    removeAnimatedArt();
    lastProcessedVideoId = null;
  }

  currentPlayerData = { videoId, song, artist, duration };

  tryFetchArtwork();
}

function handleApiResponse(event: Event): void {
  if (!isEnabled) return;

  const customEvent = event as CustomEvent<{
    url: string;
    requestJson: unknown;
    responseJson: unknown;
  }>;

  const { url, requestJson, responseJson } = customEvent.detail;

  if (!url.includes("/youtubei/v1/next")) return;

  extractFromNextResponse(requestJson, responseJson);
  tryFetchArtwork();
}

export function initialize(enabled: boolean): void {
  isEnabled = enabled;

  if (enabled) {
    document.addEventListener("bls-send-player-time", handlePlayerTime);
    document.addEventListener("bls-send-response", handleApiResponse);
  }
}

export function setEnabled(enabled: boolean): void {
  const wasEnabled = isEnabled;
  isEnabled = enabled;

  if (enabled && !wasEnabled) {
    document.addEventListener("bls-send-player-time", handlePlayerTime);
    document.addEventListener("bls-send-response", handleApiResponse);
  } else if (!enabled && wasEnabled) {
    cleanup();
  }
}

export function cleanup(): void {
  abortPendingFetch();

  document.removeEventListener("bls-send-player-time", handlePlayerTime);
  document.removeEventListener("bls-send-response", handleApiResponse);

  removeAnimatedArt();

  currentPlayerData = null;
  lastProcessedVideoId = null;
  videoIdToAlbumMap.clear();
  isEnabled = false;
}
