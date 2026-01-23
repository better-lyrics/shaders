import { Storage } from "@plasmohq/storage";
import { useStorage } from "@plasmohq/storage/hook";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_GRADIENT_SETTINGS,
  GRADIENT_SETTINGS_STORAGE_KEY,
  type GradientSettings,
} from "../../shared/constants/gradientSettings";

const storage = new Storage();

interface LegacySettings {
  shaderType?: string;
  distortion?: number;
  swirl?: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  rotation?: number;
  speed?: number;
  opacity?: number;
  boostDullColors?: boolean;
  vibrantSaturationThreshold?: number;
  vibrantRatioThreshold?: number;
  boostIntensity?: number;
  rememberAlbumSettings?: boolean;
  audioScaleBoost?: number;
}

export const useGradientSettings = () => {
  const [storedSettings, setStoredSettings] = useStorage<Partial<GradientSettings>>(
    {
      key: GRADIENT_SETTINGS_STORAGE_KEY,
      instance: storage,
    },
    DEFAULT_GRADIENT_SETTINGS
  );

  const mergedSettings = useMemo<GradientSettings>(() => {
    return {
      ...DEFAULT_GRADIENT_SETTINGS,
      ...storedSettings,
    };
  }, [storedSettings]);

  const [localSettings, setLocalSettings] = useState<GradientSettings>(mergedSettings);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalSettings(mergedSettings);
  }, [mergedSettings]);

  const updateGradientSetting = useCallback(
    (key: keyof GradientSettings, value: number) => {
      const newSettings = { ...localSettings, [key]: value };

      setLocalSettings(newSettings);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        await setStoredSettings(newSettings);
      }, 300);

      return newSettings;
    },
    [localSettings, setStoredSettings]
  );

  const resetGradientSettings = async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setLocalSettings(DEFAULT_GRADIENT_SETTINGS);
    await setStoredSettings(DEFAULT_GRADIENT_SETTINGS);
    return DEFAULT_GRADIENT_SETTINGS;
  };

  const exportSettings = useCallback(() => {
    const settingsData = {
      version: "2.0",
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
            const importedSettings = data.settings as GradientSettings & LegacySettings;

            const {
              shaderType,
              distortion,
              swirl,
              offsetX,
              offsetY,
              scale,
              rotation,
              speed,
              opacity,
              boostDullColors,
              vibrantSaturationThreshold,
              vibrantRatioThreshold,
              boostIntensity,
              rememberAlbumSettings,
              audioScaleBoost,
              ...validSettings
            } = importedSettings;

            const mergedImport: GradientSettings = {
              ...DEFAULT_GRADIENT_SETTINGS,
              ...validSettings,
            };

            const booleanKeys: (keyof GradientSettings)[] = [
              "audioResponsive",
              "showLogs",
              "showOnBrowsePages",
              "enabled",
              "pauseOnInactive",
              "enableAnimatedArt",
            ];

            const isValid = Object.entries(mergedImport).every(([key, value]) => {
              if (booleanKeys.includes(key as keyof GradientSettings)) {
                return typeof value === "boolean";
              }
              return typeof value === "number";
            });

            if (isValid) {
              const settingsToSave = mergedImport;
              if (debounceRef.current) {
                clearTimeout(debounceRef.current);
              }

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
