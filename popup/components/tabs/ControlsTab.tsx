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
    if (
      key === "enabled" ||
      key === "audioResponsive" ||
      key === "showLogs" ||
      key === "showOnBrowsePages" ||
      key === "enableAnimatedArt"
    ) {
      onToggleChange(key, defaultSettings[key] as boolean);
    } else {
      onSettingChange(key, defaultSettings[key] as number);
    }
  };

  const sliderHints: Partial<Record<keyof GradientSettings, string>> = {
    kawarpOpacity:
      "Controls the visibility of the Kawarp effect layer. At 0, the effect is invisible; at 1, it's fully opaque. Adjust to blend the animated background with the original UI.",
    kawarpWarpIntensity:
      "Controls how much the album art image gets stretched and distorted by the fluid simulation. At 0, the image stays static; higher values create more liquid, flowing distortions that make the background feel alive.",
    kawarpBlurPasses:
      "Determines how soft and dreamy the background appears. More passes create a smoother, more abstract look where colors blend together. Fewer passes keep more detail from the original album art visible.",
    kawarpAnimationSpeed:
      "How fast the fluid warping effect animates. Lower values create slow, hypnotic movements; higher values make the background more energetic and reactive. Works with audio responsive for beat-synced animation.",
    kawarpTransitionDuration:
      "How long (in milliseconds) the crossfade takes when switching between album art. Shorter durations feel snappier, longer durations create smoother, more cinematic transitions between songs.",
    kawarpSaturation:
      "Boosts or reduces color intensity of the album art. Values above 1.0 make colors more vivid and punchy; values below 1.0 create a more muted, desaturated aesthetic. 1.0 keeps original colors.",
    kawarpDithering:
      "Adds subtle noise to prevent color banding (visible stepping between colors). Higher values add more grain texture. Useful for smooth gradients on displays with limited color depth.",
    audioSpeedMultiplier:
      "How much to multiply animation speed when a beat is detected. Applied momentarily on each beat.",
    kawarpAudioScaleBoost: "Percentage to boost scale when a beat is detected. Creates a pulsing zoom effect on beats.",
    audioBeatThreshold:
      "Audio amplitude threshold for beat detection. Lower values = more sensitive (triggers on quieter sounds), higher values = less sensitive (requires louder peaks).",
  };

  return (
    <div className="tab-content">
      <div className="gradient-controls-section">
        <div className="controls-grid">
          <ControlToggle
            label="Enable Effects"
            value={settings.enabled}
            onChange={value => onToggleChange("enabled", value)}
            hint="Master toggle - Enables or disables the gradient effect entirely. Turn off to restore original YouTube Music appearance."
          />

          <ControlToggle
            label="Audio Responsive"
            value={settings.audioResponsive}
            onChange={value => onToggleChange("audioResponsive", value)}
            hint="Analyzes audio waveform in real-time to detect beats and pulse the gradient animation speed and scale."
          />

          <ControlToggle
            label="Show Logs"
            value={settings.showLogs}
            onChange={value => onToggleChange("showLogs", value)}
            hint="Shows debug information in the browser console for audio analysis and gradient updates."
          />

          <ControlToggle
            label="Show on Browse Pages"
            value={settings.showOnBrowsePages}
            onChange={value => onToggleChange("showOnBrowsePages", value)}
            hint="Displays the effect on browse pages (homepage and search). Warning: May cause degraded performance on lower-end devices."
          />

          <ControlToggle
            label="Animated Album Art"
            value={settings.enableAnimatedArt}
            onChange={value => onToggleChange("enableAnimatedArt", value)}
            hint="Displays animated album artwork (Apple Music video loops) when available, replacing the static album thumbnail in the player bar."
          />

          <ControlSlider
            key="kawarpOpacity"
            keyName="kawarpOpacity"
            value={settings.kawarpOpacity}
            onChange={onSettingChange}
            onReset={handleReset}
            hint={sliderHints.kawarpOpacity}
          />
          <ControlSlider
            key="kawarpWarpIntensity"
            keyName="kawarpWarpIntensity"
            value={settings.kawarpWarpIntensity}
            onChange={onSettingChange}
            onReset={handleReset}
            hint={sliderHints.kawarpWarpIntensity}
          />
          <ControlSlider
            key="kawarpBlurPasses"
            keyName="kawarpBlurPasses"
            value={settings.kawarpBlurPasses}
            onChange={onSettingChange}
            onReset={handleReset}
            hint={sliderHints.kawarpBlurPasses}
          />
          <ControlSlider
            key="kawarpAnimationSpeed"
            keyName="kawarpAnimationSpeed"
            value={settings.kawarpAnimationSpeed}
            onChange={onSettingChange}
            onReset={handleReset}
            hint={sliderHints.kawarpAnimationSpeed}
          />
          <ControlSlider
            key="kawarpTransitionDuration"
            keyName="kawarpTransitionDuration"
            value={settings.kawarpTransitionDuration}
            onChange={onSettingChange}
            onReset={handleReset}
            hint={sliderHints.kawarpTransitionDuration}
          />
          <ControlSlider
            key="kawarpSaturation"
            keyName="kawarpSaturation"
            value={settings.kawarpSaturation}
            onChange={onSettingChange}
            onReset={handleReset}
            hint={sliderHints.kawarpSaturation}
          />
          <ControlSlider
            key="kawarpDithering"
            keyName="kawarpDithering"
            value={settings.kawarpDithering}
            onChange={onSettingChange}
            onReset={handleReset}
            hint={sliderHints.kawarpDithering}
          />

          {settings.audioResponsive && (
            <>
              <ControlSlider
                key="audioSpeedMultiplier"
                keyName="audioSpeedMultiplier"
                value={settings.audioSpeedMultiplier}
                onChange={onSettingChange}
                onReset={handleReset}
                hint={sliderHints.audioSpeedMultiplier}
              />
              <ControlSlider
                key="kawarpAudioScaleBoost"
                keyName="kawarpAudioScaleBoost"
                value={settings.kawarpAudioScaleBoost}
                onChange={onSettingChange}
                onReset={handleReset}
                hint={sliderHints.kawarpAudioScaleBoost}
              />
              <ControlSlider
                key="audioBeatThreshold"
                keyName="audioBeatThreshold"
                value={settings.audioBeatThreshold}
                onChange={onSettingChange}
                onReset={handleReset}
                hint={sliderHints.audioBeatThreshold}
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
