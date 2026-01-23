(function () {
  let lastVideoId = null;

  setInterval(() => {
    const player = document.getElementById("movie_player");
    if (!player?.getVideoData || !player?.getDuration) return;

    try {
      const { video_id, title, author } = player.getVideoData();
      const duration = player.getDuration();

      if (!video_id || !title) return;

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
    } catch {}
  }, 20);
})();
