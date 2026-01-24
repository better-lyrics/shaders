(function () {
  const originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    const urlString = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    const shouldIntercept =
      urlString.startsWith("https://music.youtube.com/youtubei/v1/browse") ||
      urlString.startsWith("https://music.youtube.com/youtubei/v1/next");

    if (shouldIntercept) {
      let requestJson = null;
      if (init?.body) {
        try {
          requestJson = JSON.parse(init.body);
        } catch {}
      }

      const response = await originalFetch(input, init);
      const cloned = response.clone();

      cloned
        .json()
        .then(responseJson => {
          document.dispatchEvent(
            new CustomEvent("bls-send-response", {
              detail: { url: urlString, requestJson, responseJson },
            })
          );
        })
        .catch(() => {});

      return response;
    }

    return originalFetch(input, init);
  };
})();
