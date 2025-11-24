import React from "react";
import { GradientSettings, defaultSettings } from "../../types";
import { ControlSlider } from "../ControlSlider";
import { ControlToggle } from "../ControlToggle";

interface ControlsTabProps {
  settings: GradientSettings;
  onSettingChange: (key: keyof GradientSettings, value: number) => void;
  onToggleChange: (key: keyof GradientSettings, value: boolean) => void;
  onResetAll: () => void;
  onExport: () => void;
  onImport: () => void;
}

export const ControlsTab: React.FC<ControlsTabProps> = ({
  settings,
  onSettingChange,
  onToggleChange,
  onResetAll,
  onExport,
  onImport,
}) => {
  const handleReset = (key: keyof GradientSettings) => {
    if (key === "audioResponsive" || key === "showLogs") {
      onToggleChange(key, defaultSettings[key] as boolean);
    } else {
      onSettingChange(key, defaultSettings[key] as number);
    }
  };

  return (
    <div className="tab-content">
      <div className="gradient-controls-section">
        <div className="controls-grid">
          <ControlToggle
            label="Audio Responsive"
            value={settings.audioResponsive}
            onChange={value => onToggleChange("audioResponsive", value)}
          />

          <ControlToggle
            label="Show Logs"
            value={settings.showLogs}
            onChange={value => onToggleChange("showLogs", value)}
          />

          {Object.entries(settings)
            .filter(
              ([key]) => !["audioResponsive", "audioSpeedMultiplier", "audioScaleBoost", "showLogs"].includes(key)
            )
            .map(([key, value]) => (
              <ControlSlider
                key={key}
                keyName={key}
                value={value as number}
                onChange={onSettingChange}
                onReset={handleReset}
              />
            ))}

          {settings.audioResponsive && (
            <>
              <ControlSlider
                key="audioSpeedMultiplier"
                keyName="audioSpeedMultiplier"
                value={settings.audioSpeedMultiplier}
                onChange={onSettingChange}
                onReset={handleReset}
              />
              <ControlSlider
                key="audioScaleBoost"
                keyName="audioScaleBoost"
                value={settings.audioScaleBoost}
                onChange={onSettingChange}
                onReset={handleReset}
              />
            </>
          )}
        </div>

        <div className="controls-actions">
          <button onClick={onImport} className="action-button import-button" title="Import Settings">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
              <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M5 13V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2h-5.5M2 19h7m-3-3l3 3l-3 3" />
              </g>
            </svg>
            IMPORT
          </button>

          <button onClick={onExport} className="action-button export-button" title="Export Settings">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
              <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M11.5 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v5m-5 6h7m-3-3l3 3l-3 3" />
              </g>
            </svg>
            EXPORT
          </button>

          <button onClick={onResetAll} className="action-button reset-button" title="Reset to Default">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                fill="currentColor"
              />
            </svg>
            RESET TO DEFAULTS
          </button>
        </div>
      </div>
    </div>
  );
};
