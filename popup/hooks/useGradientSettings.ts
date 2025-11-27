import { Storage } from "@plasmohq/storage";
import { useStorage } from "@plasmohq/storage/hook";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_GRADIENT_SETTINGS,
  GRADIENT_SETTINGS_STORAGE_KEY,
  type GradientSettings,
} from "../../shared/constants/gradientSettings";

const storage = new Storage();

export const useGradientSettings = () => {
  const [storedSettings, setStoredSettings] = useStorage<Partial<GradientSettings>>(
    {
      key: GRADIENT_SETTINGS_STORAGE_KEY,
      instance: storage,
    },
    DEFAULT_GRADIENT_SETTINGS
  );

  // Merge stored settings with defaults to handle version mismatches
  // This ensures new settings have default values for existing users
  const mergedSettings = useMemo<GradientSettings>(() => {
    return {
      ...DEFAULT_GRADIENT_SETTINGS,
      ...storedSettings,
    };
  }, [storedSettings]);

  // Local state for immediate UI updates
  const [localSettings, setLocalSettings] = useState<GradientSettings>(mergedSettings);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync local state when stored settings change (on mount or external changes)
  useEffect(() => {
    setLocalSettings(mergedSettings);
  }, [mergedSettings]);

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
            // Merge imported settings with defaults to handle missing keys from older exports
            const mergedImport: GradientSettings = {
              ...DEFAULT_GRADIENT_SETTINGS,
              ...data.settings,
            };

            // Validate types for the imported settings
            const booleanKeys: (keyof GradientSettings)[] = [
              "audioResponsive",
              "showLogs",
              "boostDullColors",
              "showOnBrowsePages",
              "rememberAlbumSettings",
              "enabled",
            ];

            const isValid = Object.entries(mergedImport).every(([key, value]) => {
              if (booleanKeys.includes(key as keyof GradientSettings)) {
                return typeof value === "boolean";
              }
              return typeof value === "number";
            });

            if (isValid) {
              const settingsToSave = mergedImport;
              // Clear any pending debounced updates
              if (debounceRef.current) {
                clearTimeout(debounceRef.current);
              }

              // Update both local and stored settings immediately
              setLocalSettings(settingsToSave);
              await setStoredSettings(settingsToSave);
              resolve(settingsToSave);
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
