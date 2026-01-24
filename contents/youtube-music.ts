import type { PlasmoCSConfig } from "plasmo";
import { logger } from "@/shared/utils/logger";
import * as audioAnalysis from "./lib/audioAnalysis";
import * as gradientController from "./lib/gradientController";
import * as kawarpManager from "./lib/kawarpManager";
import * as messageHandler from "./lib/messageHandler";
import * as navigationManager from "./lib/navigationManager";

export const config: PlasmoCSConfig = {
  matches: ["https://music.youtube.com/*"],
  all_frames: false,
};

const initializeApp = async (): Promise<void> => {
  const settings = await gradientController.initializeSettings();

  logger.log("Better Lyrics Shaders: Initializing...");
  logger.log("Loaded settings:", settings);
  logger.log("Effects enabled:", settings.enabled);

  kawarpManager.cleanupOrphanedKawarps();

  messageHandler.setupMessageListener({
    onSettingsUpdate: gradientController.updateGradientSettings,
    getCurrentData: () => {
      const songInfo = messageHandler.getSongInfo();
      return {
        songTitle: songInfo.title,
        songAuthor: songInfo.author,
        gradientSettings: gradientController.getSettings(),
      };
    },
  });

  audioAnalysis.initializeAudioAnalysis();

  setTimeout(async () => {
    await gradientController.checkAndUpdateGradient();

    for (let retries = 10; retries > 0; retries--) {
      if (gradientController.hasActiveEffect()) {
        logger.log("Effect initialized, stopping retry");
        break;
      }
      logger.log(`Effect not ready yet, retrying... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 500));
      await gradientController.checkAndUpdateGradient();
      if (retries === 1) {
        logger.log("Max retries reached");
      }
    }

    gradientController.startAudioIfEnabled();

    navigationManager.initialize(gradientController.checkAndUpdateGradient);
  }, 0);
};

const cleanup = (): void => {
  navigationManager.cleanup();
  gradientController.cleanup();
};

window.addEventListener("beforeunload", cleanup);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
