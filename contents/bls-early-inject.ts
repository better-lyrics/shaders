import type { PlasmoCSConfig } from "plasmo";

export const config: PlasmoCSConfig = {
  matches: ["https://music.youtube.com/*"],
  world: "MAIN",
  run_at: "document_start",
};

const originalFetch = window.fetch;

function getUrlString(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlString = getUrlString(input);

  const shouldIntercept =
    urlString.startsWith("https://music.youtube.com/youtubei/v1/browse") ||
    urlString.startsWith("https://music.youtube.com/youtubei/v1/next");

  if (shouldIntercept) {
    let requestJson: unknown = null;

    if (init?.body) {
      try {
        requestJson = JSON.parse(init.body as string);
      } catch {
        // Not JSON body, ignore
      }
    }

    const response = await originalFetch(input, init);
    const cloned = response.clone();

    cloned
      .json()
      .then(responseJson => {
        document.dispatchEvent(
          new CustomEvent("bls-send-response", {
            detail: {
              url: urlString,
              requestJson,
              responseJson,
              status: response.status,
              timestamp: Date.now(),
            },
          })
        );
      })
      .catch(() => {});

    return response;
  }

  return originalFetch(input, init);
};
