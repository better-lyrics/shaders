import React from "react";
import { GradientSettings, ShaderType, defaultSettings } from "../../types";
import { ControlSlider } from "../ControlSlider";
import { ControlToggle } from "../ControlToggle";

interface ControlsTabProps {
  settings: GradientSettings;
  onSettingChange: (key: keyof GradientSettings, value: number) => void;
  onToggleChange: (key: keyof GradientSettings, value: boolean) => void;
  onShaderTypeChange: (type: ShaderType) => void;
  onResetAll: () => void;
  onExport: () => void;
  onImport: () => void;
}

export const ControlsTab: React.FC<ControlsTabProps> = ({
  settings,
  onSettingChange,
  onToggleChange,
  onShaderTypeChange,
  onResetAll,
  onExport,
  onImport,
}) => {
  const isMeshGradient = settings.shaderType === "mesh";
  const isKawarp = settings.shaderType === "kawarp";
  const handleReset = (key: keyof GradientSettings) => {
    if (
      key === "enabled" ||
      key === "audioResponsive" ||
      key === "showLogs" ||
      key === "boostDullColors" ||
      key === "showOnBrowsePages" ||
      key === "rememberAlbumSettings"
    ) {
      onToggleChange(key, defaultSettings[key] as boolean);
    } else {
      onSettingChange(key, defaultSettings[key] as number);
    }
  };

  const sliderHints: Partial<Record<keyof GradientSettings, string>> = {
    speed: "Controls how fast the gradient animation moves. Higher values create faster, more dynamic motion.",
    scale: "Adjusts the size/zoom level of the gradient pattern. Lower values zoom in, higher values zoom out.",
    distortion: "Amount of warping and deformation applied to the gradient. Creates fluid, organic shapes.",
    swirl: "Adds rotational twisting to the gradient pattern. Higher values create more spiral effects.",
    opacity: "Transparency level of the gradient overlay. Lower values make it more see-through.",
    kawarpWarpIntensity: "Intensity of the fluid warping effect. Higher values create more dramatic distortion.",
    kawarpBlurPasses:
      "Number of blur passes applied to the image. Higher values create a smoother, more diffused look.",
    kawarpAnimationSpeed: "Speed of the fluid animation. Higher values create faster, more dynamic motion.",
    kawarpTransitionDuration: "Duration of the crossfade transition when changing album art (in milliseconds).",
    kawarpSaturation: "Color saturation multiplier. Values above 1 boost colors, below 1 mute them.",
    kawarpDithering: "Amount of dithering to reduce color banding. Higher values add more noise.",
    audioSpeedMultiplier:
      "How much to multiply animation speed when a beat is detected. Applied momentarily on each beat.",
    audioScaleBoost: "Percentage to boost scale when a beat is detected. Creates a pulsing zoom effect on beats.",
    audioBeatThreshold:
      "Audio amplitude threshold for beat detection. Lower values = more sensitive (triggers on quieter sounds), higher values = less sensitive (requires louder peaks).",
    vibrantSaturationThreshold:
      "Minimum saturation percentage for a color to be considered vibrant. Colors above this threshold are counted toward the vibrant ratio.",
    vibrantRatioThreshold:
      "Maximum percentage of vibrant colors allowed before skipping boost. If set to 50% and more than half the colors are vibrant, boosting is skipped since the palette is already colorful.",
    boostIntensity:
      "Strength of the saturation boost applied to dull colors. Higher values create more vivid colors when boost is triggered.",
  };

  return (
    <div className="tab-content">
      <div className="gradient-controls-section">
        <div className="controls-grid">
          <ControlToggle
            label="Enable Shaders"
            value={settings.enabled}
            onChange={value => onToggleChange("enabled", value)}
            hint="Master toggle - Enables or disables the gradient shader effect entirely. Turn off to restore original YouTube Music appearance."
          />

          <div className="shader-type-selector">
            <span className="shader-type-label">Shader Type</span>
            <div className="shader-type-buttons">
              <button
                className={`shader-type-button ${isMeshGradient ? "active" : ""}`}
                onClick={() => onShaderTypeChange("mesh")}
              >
                Mesh Gradient
              </button>
              <button
                className={`shader-type-button ${isKawarp ? "active" : ""}`}
                onClick={() => onShaderTypeChange("kawarp")}
              >
                Kawarp
              </button>
            </div>
          </div>

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
            hint="Shows debug information in the browser console for color extraction, audio analysis, and gradient updates."
          />

          <ControlToggle
            label="Show on Browse Pages"
            value={settings.showOnBrowsePages}
            onChange={value => onToggleChange("showOnBrowsePages", value)}
            hint="Displays the shader on browse pages (homepage and search). Warning: May cause degraded performance on lower-end devices."
          />

          <ControlToggle
            label="Remember Album Settings"
            value={settings.rememberAlbumSettings}
            onChange={value => onToggleChange("rememberAlbumSettings", value)}
            hint="Automatically saves and restores settings for each album."
          />

          {isMeshGradient && (
            <ControlToggle
              value={settings.boostDullColors}
              onChange={value => onToggleChange("boostDullColors", value)}
              label="Boost Dull Colors"
              hint="Enhances muted colors extracted from album art."
            />
          )}

          <ControlSlider
            key="opacity"
            keyName="opacity"
            value={settings.opacity}
            onChange={onSettingChange}
            onReset={handleReset}
            hint={sliderHints.opacity}
          />

          {isMeshGradient && (
            <>
              <ControlSlider
                key="speed"
                keyName="speed"
                value={settings.speed}
                onChange={onSettingChange}
                onReset={handleReset}
                hint={sliderHints.speed}
              />
              <ControlSlider
                key="scale"
                keyName="scale"
                value={settings.scale}
                onChange={onSettingChange}
                onReset={handleReset}
                hint={sliderHints.scale}
              />
              <ControlSlider
                key="distortion"
                keyName="distortion"
                value={settings.distortion}
                onChange={onSettingChange}
                onReset={handleReset}
                hint={sliderHints.distortion}
              />
              <ControlSlider
                key="swirl"
                keyName="swirl"
                value={settings.swirl}
                onChange={onSettingChange}
                onReset={handleReset}
                hint={sliderHints.swirl}
              />
              <ControlSlider
                key="rotation"
                keyName="rotation"
                value={settings.rotation}
                onChange={onSettingChange}
                onReset={handleReset}
                hint="Rotation angle of the gradient pattern in degrees."
              />
              <ControlSlider
                key="offsetX"
                keyName="offsetX"
                value={settings.offsetX}
                onChange={onSettingChange}
                onReset={handleReset}
                hint="Horizontal offset of the gradient pattern."
              />
              <ControlSlider
                key="offsetY"
                keyName="offsetY"
                value={settings.offsetY}
                onChange={onSettingChange}
                onReset={handleReset}
                hint="Vertical offset of the gradient pattern."
              />
            </>
          )}

          {isKawarp && (
            <>
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
            </>
          )}

          {isMeshGradient && settings.boostDullColors && (
            <>
              <ControlSlider
                key="vibrantSaturationThreshold"
                keyName="vibrantSaturationThreshold"
                value={settings.vibrantSaturationThreshold}
                onChange={onSettingChange}
                onReset={handleReset}
                hint={sliderHints.vibrantSaturationThreshold}
              />
              <ControlSlider
                key="vibrantRatioThreshold"
                keyName="vibrantRatioThreshold"
                value={settings.vibrantRatioThreshold}
                onChange={onSettingChange}
                onReset={handleReset}
                hint={sliderHints.vibrantRatioThreshold}
              />
              <ControlSlider
                key="boostIntensity"
                keyName="boostIntensity"
                value={settings.boostIntensity}
                onChange={onSettingChange}
                onReset={handleReset}
                hint={sliderHints.boostIntensity}
              />
            </>
          )}

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
                key="audioScaleBoost"
                keyName="audioScaleBoost"
                value={settings.audioScaleBoost}
                onChange={onSettingChange}
                onReset={handleReset}
                hint={sliderHints.audioScaleBoost}
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
