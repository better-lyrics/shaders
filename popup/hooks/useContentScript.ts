import { useEffect, useState, useCallback } from "react";
import { GradientSettings } from "../types";

interface ContentData {
  colors: string[];
  songTitle: string;
  songAuthor: string;
  gradientSettings: GradientSettings;
}

export const useContentScript = () => {
  const [data, setData] = useState<ContentData>({
    colors: [],
    songTitle: "",
    songAuthor: "",
    gradientSettings: {} as GradientSettings,
  });

  const sendMessage = useCallback(async (action: string, payload?: any) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        return await chrome.tabs.sendMessage(tab.id, { action, ...payload });
      }
    } catch (error) {
      console.error(`Error sending message (${action}):`, error);
    }
  }, []);

  const loadCurrentData = useCallback(async () => {
    const response = await sendMessage("getCurrentData");
    if (response) {
      setData({
        colors: response.colors || [],
        songTitle: response.songTitle || "",
        songAuthor: response.songAuthor || "",
        gradientSettings: response.gradientSettings || {},
      });
    }
  }, [sendMessage]);

  const updateColors = useCallback(
    async (colors: string[]) => {
      await sendMessage("updateColors", { colors });
    },
    [sendMessage]
  );

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
    updateColors,
    updateGradientSettings,
    reload: loadCurrentData,
  };
};
