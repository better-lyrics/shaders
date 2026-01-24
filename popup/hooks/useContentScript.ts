import { useEffect, useState, useCallback } from "react";
import browser from "webextension-polyfill";
import { GradientSettings } from "@/popup/types";

interface ContentData {
  songTitle: string;
  songAuthor: string;
  gradientSettings: GradientSettings;
}

export const useContentScript = () => {
  const [data, setData] = useState<ContentData>({
    songTitle: "",
    songAuthor: "",
    gradientSettings: {} as GradientSettings,
  });

  const sendMessage = useCallback(async (action: string, payload?: Record<string, unknown>) => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        return await browser.tabs.sendMessage(tab.id, { action, ...payload });
      }
    } catch (error) {
      console.error(`Error sending message (${action}):`, error);
    }
  }, []);

  const loadCurrentData = useCallback(async () => {
    const response = (await sendMessage("getCurrentData")) as ContentData | undefined;
    if (response) {
      setData({
        songTitle: response.songTitle || "",
        songAuthor: response.songAuthor || "",
        gradientSettings: response.gradientSettings || ({} as GradientSettings),
      });
    }
  }, [sendMessage]);

  const updateGradientSettings = useCallback(
    async (settings: GradientSettings) => {
      await sendMessage("updateGradientSettings", { settings });
    },
    [sendMessage]
  );

  useEffect(() => {
    loadCurrentData();
    const interval = setInterval(loadCurrentData, 2000);
    return () => clearInterval(interval);
  }, [loadCurrentData]);

  return {
    ...data,
    updateGradientSettings,
    reload: loadCurrentData,
  };
};
