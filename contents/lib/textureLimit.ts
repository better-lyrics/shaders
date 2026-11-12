const RESIST_FINGERPRINTING_MAX_TEXTURE_SIZE = 2048;
// Chromium limits are 8192 or more, so only Gecko can report a cap below animated art
const IS_FIREFOX_BUILD = process.env.PLASMO_BROWSER === "firefox";

let maxTextureSize: number | null = null;

const getMaxTextureSize = (): number => {
  if (maxTextureSize !== null) return maxTextureSize;
  const probe = document.createElement("canvas").getContext("webgl");
  const probedSize: number = probe?.getParameter(probe.MAX_TEXTURE_SIZE) || Number.POSITIVE_INFINITY;
  probe?.getExtension("WEBGL_lose_context")?.loseContext();
  maxTextureSize = probedSize;
  return probedSize;
};

export const exceedsMaxTextureSize = (video: HTMLVideoElement): boolean =>
  IS_FIREFOX_BUILD && Math.max(video.videoWidth, video.videoHeight) > getMaxTextureSize();

// Firefox caps MAX_TEXTURE_SIZE at exactly 2048 under privacy.resistFingerprinting (kCommonMaxTextureSize)
export const isTextureSizeCappedByResistFingerprinting = (): boolean =>
  IS_FIREFOX_BUILD && getMaxTextureSize() === RESIST_FINGERPRINTING_MAX_TEXTURE_SIZE;
