import { ARTWORK_API_ENDPOINT } from "@/shared/constants/artworkApi";
import { logger } from "@/shared/utils/logger";
import { Storage } from "@plasmohq/storage";
import { solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/web/pbkdf2";

type PowChallenge = Parameters<typeof solveChallenge>[0]["challenge"];
type PowSolution = NonNullable<Awaited<ReturnType<typeof solveChallenge>>>;

interface StoredToken {
  token: string;
}

interface TokenClaims {
  iat?: number;
  exp?: number;
}

const storage = new Storage({ area: "local" });

const TOKEN_STORAGE_KEY = "blsArtworkPriorityToken";
const SOLVE_TIMEOUT_MS = 60_000;
const REFRESH_AFTER_LIFETIME_FRACTION = 0.8;
const NO_IAT_REFRESH_MARGIN_SEC = 600;

let refreshInFlight: Promise<void> | null = null;

function decodeClaims(token: string): TokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (base64.length % 4)) % 4;
    return JSON.parse(atob(base64.padEnd(base64.length + padding, "="))) as TokenClaims;
  } catch {
    return null;
  }
}

function isUsable(claims: TokenClaims, nowSec: number): boolean {
  return typeof claims.exp === "number" && claims.exp > nowSec;
}

function needsRefresh(claims: TokenClaims, nowSec: number): boolean {
  if (typeof claims.exp !== "number") return true;
  if (typeof claims.iat === "number" && claims.iat < claims.exp) {
    const refreshAt = claims.iat + (claims.exp - claims.iat) * REFRESH_AFTER_LIFETIME_FRACTION;
    return nowSec >= refreshAt;
  }
  return nowSec >= claims.exp - NO_IAT_REFRESH_MARGIN_SEC;
}

async function fetchChallenge(): Promise<PowChallenge | null> {
  try {
    const response = await fetch(`${ARTWORK_API_ENDPOINT}/challenge`);
    if (!response.ok) return null;
    return (await response.json()) as PowChallenge;
  } catch (error) {
    logger.log("Artwork token: challenge fetch failed", error);
    return null;
  }
}

async function solvePow(challenge: PowChallenge): Promise<PowSolution | null> {
  try {
    return await solveChallenge({ challenge, deriveKey, timeout: SOLVE_TIMEOUT_MS });
  } catch (error) {
    logger.log("Artwork token: proof-of-work solve failed", error);
    return null;
  }
}

async function requestMintedToken(challenge: PowChallenge, solution: PowSolution): Promise<string | null> {
  try {
    const response = await fetch(`${ARTWORK_API_ENDPOINT}/mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge, solution }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { token?: unknown };
    return typeof data.token === "string" ? data.token : null;
  } catch (error) {
    logger.log("Artwork token: mint request failed", error);
    return null;
  }
}

async function runRefresh(): Promise<void> {
  const challenge = await fetchChallenge();
  if (!challenge) return;

  const solution = await solvePow(challenge);
  if (!solution) return;

  const token = await requestMintedToken(challenge, solution);
  if (!token) return;

  try {
    await storage.set(TOKEN_STORAGE_KEY, { token } satisfies StoredToken);
    logger.log("Artwork token: refreshed priority token");
  } catch (error) {
    logger.log("Artwork token: storage write failed", error);
  }
}

function ensureRefresh(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = runRefresh()
      .catch(error => {
        logger.log("Artwork token: refresh failed", error);
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function getToken(): Promise<string | null> {
  let stored: StoredToken | null = null;
  try {
    stored = (await storage.get<StoredToken>(TOKEN_STORAGE_KEY)) ?? null;
  } catch (error) {
    logger.log("Artwork token: storage read failed", error);
  }

  const claims = stored ? decodeClaims(stored.token) : null;
  const nowSec = Date.now() / 1000;
  const usable = claims !== null && isUsable(claims, nowSec);

  if (claims === null || !usable || needsRefresh(claims, nowSec)) {
    void ensureRefresh();
  }

  if (stored !== null && usable) {
    return stored.token;
  }
  return null;
}
