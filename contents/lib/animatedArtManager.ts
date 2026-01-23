import { logger } from "../../shared/utils/logger";

const API_ENDPOINT = "https://artwork.boidu.dev";
const VIDEO_ELEMENT_ID = "bls-video";
const MAX_CACHE_SIZE = 50;

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

interface CacheEntry {
  videoUrl: string | null;
  timestamp: number;
}

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
const artworkCache = new Map<string, CacheEntry>();

function abortPendingFetch(): void {
  if (pendingFetch) {
    pendingFetch.abort();
    pendingFetch = null;
  }
}

const extractAlbumFromDOMOnce = (): string | null => {
  const byline =
    document.querySelector("yt-formatted-string.byline.ytmusic-player-bar") ||
    document.querySelector(".subtitle.ytmusic-player-bar yt-formatted-string.byline") ||
    document.querySelector("ytmusic-player-bar .byline");

  if (!byline) return null;

  // Structure: "Artist1 • Artist2 • ... • Album • Year"
  // With featured artists, there can be multiple artist links before the album
  // Album is the LAST <a> element (year is plain text, not a link)
  const links = byline.querySelectorAll("a");
  if (links.length >= 2) {
    return links[links.length - 1].textContent?.trim() || null;
  }

  return null;
};

const extractAlbumFromDOM = async (maxRetries = 10, delayMs = 100): Promise<string | null> => {
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
};

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

const processPlaylistContents = (contents: PlaylistContent[]): void => {
  for (const content of contents) {
    let renderer = content.playlistPanelVideoRenderer;
    if (!renderer) {
      renderer = content.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
    }

    if (!renderer) continue;

    const videoId = renderer.videoId;
    if (!videoId) continue;

    if (renderer.longBylineText) {
      const album = extractBylineAlbum(renderer.longBylineText);
      if (album) {
        videoIdToAlbumMap.set(videoId, album);
      }
    }
  }

  // Prune old entries if map gets too large
  if (videoIdToAlbumMap.size > 100) {
    const keys = Array.from(videoIdToAlbumMap.keys());
    for (let i = 0; i < 50; i++) {
      videoIdToAlbumMap.delete(keys[i]);
    }
  }
};

const extractFromNextResponse = (requestJson: unknown, responseJson: unknown): void => {
  try {
    const request = requestJson as Record<string, unknown>;
    const response = responseJson as Record<string, unknown>;

    // Get videoId from request
    const requestVideoId = request?.videoId as string;

    // Get videoId from currentVideoEndpoint (this might be the CURRENT playing song)
    const endpoint = response?.currentVideoEndpoint as Record<string, unknown>;
    const watchEndpoint = endpoint?.watchEndpoint as Record<string, unknown>;
    const currentEndpointVideoId = watchEndpoint?.videoId as string;

    // Process ALL songs in the queue (like Better Lyrics does)
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

    // Fallback: continuationContents
    if (!playlistContents) {
      const continuationContents = response?.continuationContents as Record<string, unknown>;
      const playlistContinuation = continuationContents?.playlistPanelContinuation as Record<string, unknown>;
      playlistContents = playlistContinuation?.contents as PlaylistContent[];
    }

    // Fallback: onResponseReceivedEndpoints
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

    // Also extract album from browserMediaSession for the endpoint videoId
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
        // Set for both videoIds if available
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
};

function getCacheKey(song: string, artist: string, album: string): string {
  return `${song}|${artist}|${album}`;
}

const pruneCache = (): void => {
  if (artworkCache.size <= MAX_CACHE_SIZE) return;

  const entries = Array.from(artworkCache.entries());
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

  const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
  for (const [key] of toRemove) {
    artworkCache.delete(key);
  }
};

const fetchArtworkUrl = async (
  song: string,
  artist: string,
  duration: number,
  album: string,
  signal: AbortSignal
): Promise<string | null> => {
  const cacheKey = getCacheKey(song, artist, album);
  const cached = artworkCache.get(cacheKey);

  if (cached) {
    logger.log("Animated art: cache hit", { hasVideo: !!cached.videoUrl });
    return cached.videoUrl;
  }

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

    artworkCache.set(cacheKey, {
      videoUrl: data.videoUrl,
      timestamp: Date.now(),
    });

    pruneCache();

    logger.log("Animated art: API response", { hasVideo: !!data.videoUrl });
    return data.videoUrl;
  } catch (error) {
    logger.log("Animated art: fetch error", error);
    return null;
  }
};

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

const injectAnimatedArt = (videoUrl: string): void => {
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
};

const removeAnimatedArt = (): void => {
  const video = document.querySelector(`#${VIDEO_ELEMENT_ID}`);
  if (video) {
    const thumbnail = video.parentElement;
    video.remove();
    if (thumbnail) {
      thumbnail.style.isolation = "";
    }
  }
};

const tryFetchArtwork = async (): Promise<void> => {
  if (!isEnabled || !currentPlayerData) return;

  const { videoId, song, artist, duration } = currentPlayerData;

  if (videoId === lastProcessedVideoId) return;

  // CRITICAL: Set immediately to prevent concurrent calls from both
  // handlePlayerTime and handleApiResponse from proceeding
  lastProcessedVideoId = videoId;

  abortPendingFetch();

  // Check if we have album from /next response
  let album = videoIdToAlbumMap.get(videoId);
  let albumSource = "map";

  // Fallback: extract from DOM with retry if not in map
  if (!album) {
    album = (await extractAlbumFromDOM()) || "";
    albumSource = album ? "dom" : "none";
    if (album) {
      videoIdToAlbumMap.set(videoId, album);
    }
  }

  logger.log("Animated art: fetching", { song, artist, album, albumSource, videoId });

  pendingFetch = new AbortController();

  const videoUrl = await fetchArtworkUrl(song, artist, duration, album, pendingFetch.signal);

  pendingFetch = null;

  if (!isEnabled || videoId !== currentPlayerData?.videoId) return;

  if (videoUrl) {
    injectAnimatedArt(videoUrl);
  } else {
    removeAnimatedArt();
  }
};

const handlePlayerTime = (event: Event): void => {
  if (!isEnabled) return;

  const customEvent = event as CustomEvent<PlayerData>;
  const { videoId, song, artist, duration } = customEvent.detail;

  // Song changed - cleanup before processing new song
  if (currentPlayerData && currentPlayerData.videoId !== videoId) {
    logger.log("Animated art: song changed, clearing old artwork");

    abortPendingFetch();

    removeAnimatedArt();
    lastProcessedVideoId = null;
  }

  currentPlayerData = { videoId, song, artist, duration };

  tryFetchArtwork();
};

const handleApiResponse = (event: Event): void => {
  if (!isEnabled) return;

  const customEvent = event as CustomEvent<{
    url: string;
    requestJson: unknown;
    responseJson: unknown;
  }>;

  const { url, requestJson, responseJson } = customEvent.detail;

  // Only process /next responses for album extraction
  if (!url.includes("/youtubei/v1/next")) return;

  extractFromNextResponse(requestJson, responseJson);

  // Try to fetch if we now have album for current player
  tryFetchArtwork();
};

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
