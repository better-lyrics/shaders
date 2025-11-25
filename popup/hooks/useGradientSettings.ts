import { Storage } from "@plasmohq/storage";
import { useStorage } from "@plasmohq/storage/hook";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_GRADIENT_SETTINGS,
  GRADIENT_SETTINGS_STORAGE_KEY,
  type GradientSettings,
} from "../../shared/constants/gradientSettings";

const storage = new Storage();

export const useGradientSettings = () => {
  const [storedSettings, setStoredSettings] = useStorage<GradientSettings>(
    {
      key: GRADIENT_SETTINGS_STORAGE_KEY,
      instance: storage,
    },
    DEFAULT_GRADIENT_SETTINGS
  );

  // Local state for immediate UI updates
  const [localSettings, setLocalSettings] = useState<GradientSettings>(storedSettings);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync local state when stored settings change (on mount or external changes)
  useEffect(() => {
    setLocalSettings(storedSettings);
  }, [storedSettings]);

  // Update local state immediately, debounce storage write
  const updateGradientSetting = useCallback(
    (key: keyof GradientSettings, value: number) => {
      const newSettings = { ...localSettings, [key]: value };

      // Update UI immediately
      setLocalSettings(newSettings);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce storage write for 300ms
      debounceRef.current = setTimeout(async () => {
        await setStoredSettings(newSettings);
      }, 300);

      return newSettings;
    },
    [localSettings, setStoredSettings]
  );

  const resetGradientSettings = async () => {
    // Clear any pending debounced updates
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Update both local and stored settings immediately
    setLocalSettings(DEFAULT_GRADIENT_SETTINGS);
    await setStoredSettings(DEFAULT_GRADIENT_SETTINGS);
    return DEFAULT_GRADIENT_SETTINGS;
  };

  const exportSettings = useCallback(() => {
    const settingsData = {
      version: "1.0",
      settings: localSettings,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(settingsData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `better-lyrics-shaders-settings-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [localSettings]);

  const importSettings = useCallback((): Promise<GradientSettings | null> => {
    return new Promise(resolve => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.onchange = async e => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          const text = await file.text();
          const data = JSON.parse(text);

          if (data.settings && typeof data.settings === "object") {
            // Validate that all required keys exist
            const requiredKeys: (keyof GradientSettings)[] = [
              "distortion",
              "swirl",
              "offsetX",
              "offsetY",
              "scale",
              "rotation",
              "speed",
              "opacity",
              "audioResponsive",
              "audioSpeedMultiplier",
              "audioScaleBoost",
              "showLogs",
              "boostDullColors",
              "showOnHomepage",
              "rememberAlbumSettings",
              "vibrantSaturationThreshold",
              "vibrantRatioThreshold",
              "boostIntensity",
            ];

            const isValid = requiredKeys.every(key => {
              if (key === "audioResponsive" || key === "showLogs" || key === "boostDullColors" || key === "showOnHomepage" || key === "rememberAlbumSettings") {
                return typeof data.settings[key] === "boolean";
              }
              return typeof data.settings[key] === "number";
            });

            if (isValid) {
              // Clear any pending debounced updates
              if (debounceRef.current) {
                clearTimeout(debounceRef.current);
              }

              // Update both local and stored settings immediately
              setLocalSettings(data.settings);
              await setStoredSettings(data.settings);
              resolve(data.settings);
            } else {
              alert("Invalid settings file format");
              resolve(null);
            }
          } else {
            alert("Invalid settings file format");
            resolve(null);
          }
        } catch (error) {
          alert("Error reading settings file");
          console.error("Import error:", error);
          resolve(null);
        }
      };

      input.click();
    });
  }, [setStoredSettings]);

  return {
    gradientSettings: localSettings,
    setGradientSettings: setStoredSettings,
    updateGradientSetting,
    resetGradientSettings,
    exportSettings,
    importSettings,
  };
};
