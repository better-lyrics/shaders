import type { PlasmoCSConfig } from "plasmo";

export const config: PlasmoCSConfig = {
  matches: ["https://music.youtube.com/*"],
  world: "MAIN",
};

interface MoviePlayer extends HTMLElement {
  getVideoData: () => { video_id: string; title: string; author: string };
  getDuration: () => number;
}

let lastVideoId: string | null = null;

setInterval(() => {
  const player = document.getElementById("movie_player") as MoviePlayer | null;

  if (!player?.getVideoData || !player?.getDuration) return;

  try {
    const { video_id, title, author } = player.getVideoData();
    const duration = player.getDuration();

    if (!video_id || !title) return;

    // Only dispatch when video changes to reduce noise
    if (video_id !== lastVideoId) {
      lastVideoId = video_id;

      document.dispatchEvent(
        new CustomEvent("bls-send-player-time", {
          detail: {
            videoId: video_id,
            song: title,
            artist: author,
            duration,
          },
        })
      );
    }
  } catch {
    // Player not ready
  }
}, 20);
