import {
  CANVAS_API_ENDPOINT,
  SPOTIFY_EMBED_URL,
  SPOTIFY_PATHFINDER_URL,
  SPOTIFY_SEARCH_SHA256,
} from "@/shared/constants/spotifyApi";
import {
  type LookupSpotifyCanvasResponse,
  type SpotifyCandidate,
  type TrackInput,
  buildSearchQueries,
  resolve,
} from "@/shared/utils/spotifyMatcher";
import browser from "webextension-polyfill";

interface SpotifySession {
  token: string;
  expiresAt: number;
}

const EXPIRY_SKEW_MS = 60_000;

let session: SpotifySession | null = null;
let sessionPending: Promise<string> | null = null;

async function getSpotifyToken(): Promise<string> {
  if (session && session.expiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return session.token;
  }
  if (!sessionPending) {
    sessionPending = (async () => {
      const response = await fetch(SPOTIFY_EMBED_URL);
      if (!response.ok) {
        throw new Error(`Spotify embed HTTP ${response.status}`);
      }
      const html = await response.text();
      const jsonText = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
      const parsed = jsonText ? JSON.parse(jsonText) : null;
      const sessionData = parsed?.props?.pageProps?.state?.settings?.session;
      if (!sessionData?.accessToken || typeof sessionData.accessTokenExpirationTimestampMs !== "number") {
        throw new Error("Spotify embed page did not contain a valid session token");
      }
      session = {
        token: sessionData.accessToken,
        expiresAt: sessionData.accessTokenExpirationTimestampMs,
      };
      return session.token;
    })().finally(() => {
      sessionPending = null;
    });
  }
  return sessionPending;
}

async function withSpotifyToken(call: (token: string) => Promise<Response>): Promise<Response> {
  const first = await getSpotifyToken();
  const res = await call(first);
  if (res.status !== 401) return res;
  if (session?.token === first) {
    session = null;
  }
  const refreshed = await getSpotifyToken();
  return call(refreshed);
}

const authHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  "app-platform": "WebPlayer",
});

interface PathfinderTrackItem {
  item?: {
    data?: {
      id?: string;
      uri?: string;
      name?: string;
      artists?: {
        items?: Array<{
          profile?: {
            name?: string;
          };
        }>;
      };
      albumOfTrack?: {
        name?: string;
      };
      duration?: {
        totalMilliseconds?: number;
      };
    };
  };
}

async function searchQuery(query: string): Promise<SpotifyCandidate[]> {
  const variables = {
    searchTerm: query,
    offset: 0,
    limit: 20,
    numberOfTopResults: 5,
    includeAudiobooks: false,
    includePreReleases: true,
    includeAlbumPreReleases: false,
    includeAuthors: false,
    includeEpisodeContentRatingsV2: false,
  };
  const extensions = {
    persistedQuery: {
      version: 1,
      sha256Hash: SPOTIFY_SEARCH_SHA256,
    },
  };
  const url =
    `${SPOTIFY_PATHFINDER_URL}?operationName=searchDesktop` +
    `&variables=${encodeURIComponent(JSON.stringify(variables))}` +
    `&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;

  const res = await withSpotifyToken(token => fetch(url, { headers: authHeaders(token) }));
  if (!res.ok) {
    throw new Error(`Spotify search HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    errors?: Array<{ message?: string }>;
    data?: {
      searchV2?: {
        tracksV2?: {
          items?: PathfinderTrackItem[];
        };
      };
    };
  };

  if (body.errors?.some(e => e.message === "PersistedQueryNotFound")) {
    throw new Error("Spotify rotated the persisted search query hash");
  }

  const items = body.data?.searchV2?.tracksV2?.items;
  if (!Array.isArray(items)) {
    throw new Error("Spotify search response shape changed");
  }

  const candidates: SpotifyCandidate[] = [];
  for (const entry of items) {
    const d = entry?.item?.data;
    const id = d?.id ?? d?.uri?.split(":").pop();
    const artists = (d?.artists?.items ?? []).map(a => a?.profile?.name).filter((n): n is string => Boolean(n));
    const durationMs = d?.duration?.totalMilliseconds;
    if (!id || !d?.name || artists.length === 0 || typeof durationMs !== "number") continue;
    candidates.push({
      id,
      title: d.name,
      artists,
      album: d.albumOfTrack?.name ?? "",
      durationMs,
    });
  }
  return candidates;
}

async function searchSpotifyTracks(track: TrackInput): Promise<SpotifyCandidate[]> {
  const queries = buildSearchQueries(track);
  if (queries.length === 0) return [];

  const restPromises = queries.slice(1).map(q => searchQuery(q).catch(() => []));
  const first = await searchQuery(queries[0]);
  if (resolve(track, first).kind === "matched") {
    return first;
  }

  const restResults = await Promise.all(restPromises);
  const seen = new Set<string>();
  const combined: SpotifyCandidate[] = [];
  for (const candidate of [first, ...restResults].flat()) {
    if (!seen.has(candidate.id)) {
      seen.add(candidate.id);
      combined.push(candidate);
    }
  }
  return combined;
}

interface CanvasStoreResponse {
  data?: Record<
    string,
    | {
        url?: string;
      }
    | null
    | undefined
  >;
}

async function fetchCanvasUrlForTrackId(trackId: string): Promise<string | null> {
  if (!/^[A-Za-z0-9]{22}$/.test(trackId)) return null;
  const res = await fetch(`${CANVAS_API_ENDPOINT}/${trackId}`);
  if (!res.ok) return null;
  const body = (await res.json()) as CanvasStoreResponse;
  const canvasUrl = body.data?.[trackId]?.url;
  return typeof canvasUrl === "string" && canvasUrl.length > 0 ? canvasUrl : null;
}

async function lookupSpotifyCanvas(track: TrackInput): Promise<LookupSpotifyCanvasResponse> {
  try {
    const candidates = await searchSpotifyTracks(track);
    const match = resolve(track, candidates);
    if (match.kind !== "matched") {
      return { videoUrl: null, trackId: null };
    }
    const trackId = match.track.candidate.id;
    const videoUrl = await fetchCanvasUrlForTrackId(trackId);
    return { videoUrl, trackId };
  } catch {
    return { videoUrl: null, trackId: null, error: true };
  }
}

browser.runtime.onMessage.addListener((msg: unknown) => {
  const message = msg as { action?: string; track?: TrackInput };
  if (message?.action === "lookupSpotifyCanvas" && message.track) {
    return lookupSpotifyCanvas(message.track);
  }
  return undefined;
});
