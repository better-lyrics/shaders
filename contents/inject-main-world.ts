import type { PlasmoCSConfig } from "plasmo";

export const config: PlasmoCSConfig = {
  matches: ["https://music.youtube.com/*"],
  run_at: "document_start",
  all_frames: false,
};

function injectScript(fileName: string): void {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL(fileName);
  script.type = "text/javascript";
  (document.head || document.documentElement).appendChild(script);
}

injectScript("assets/earlyInject.js");

window.addEventListener("DOMContentLoaded", () => {
  injectScript("assets/playerScript.js");
});
