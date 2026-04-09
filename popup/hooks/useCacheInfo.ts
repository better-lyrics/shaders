import { useCallback, useEffect, useState } from "react";
import browser from "webextension-polyfill";

interface CacheInfo {
  count: number;
  sizeBytes: number;
}

const sendMessage = async <T>(action: string, payload?: Record<string, unknown>): Promise<T | undefined> => {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return undefined;
    return (await browser.tabs.sendMessage(tab.id, { action, ...payload })) as T;
  } catch (error) {
    console.error(`Error sending message (${action}):`, error);
    return undefined;
  }
};

export const useCacheInfo = () => {
  const [cacheInfo, setCacheInfo] = useState<CacheInfo>({ count: 0, sizeBytes: 0 });
  const [isClearing, setIsClearing] = useState(false);

  const refresh = useCallback(async () => {
    const response = await sendMessage<CacheInfo>("getCacheInfo");
    if (response) setCacheInfo(response);
  }, []);

  const clear = useCallback(async () => {
    setIsClearing(true);
    await sendMessage<{ cleared: number }>("clearAnimatedArtCache");
    await refresh();
    setIsClearing(false);
  }, [refresh]);

  const importCache = useCallback(async (): Promise<number> => {
    return new Promise(resolve => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.onchange = async e => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(0);
          return;
        }

        try {
          const text = await file.text();
          const parsedCacheFile = JSON.parse(text);

          if (!parsedCacheFile.entries || typeof parsedCacheFile.entries !== "object") {
            alert("Invalid cache file format");
            resolve(0);
            return;
          }

          const response = await sendMessage<{ imported: number }>("importAnimatedArtCache", {
            entries: parsedCacheFile.entries,
          });
          await refresh();
          resolve(response?.imported ?? 0);
        } catch (error) {
          alert("Error reading cache file");
          console.error("Cache import error:", error);
          resolve(0);
        }
      };

      input.click();
    });
  }, [refresh]);

  const exportCache = useCallback(async () => {
    const entries = await sendMessage<Record<string, unknown>>("getCacheEntries");
    if (!entries) return;

    const payload = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      count: Object.keys(entries).length,
      entries,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `better-lyrics-shaders-cache-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    count: cacheInfo.count,
    sizeBytes: cacheInfo.sizeBytes,
    isClearing,
    refresh,
    clear,
    exportCache,
    importCache,
  };
};
