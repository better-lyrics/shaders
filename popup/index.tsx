import React, { useState } from "react";
import "./popup.css";

// Hooks
import { useContentScript, useGradientSettings, useTabState } from "./hooks";

// Components
import { ColorsTab, ControlsTab, Header, TabBar } from "./components";

// Types
import { GradientSettings, ShaderType, defaultSettings } from "./types";

const Popup: React.FC = () => {
  const { activeTab, setActiveTab } = useTabState();
  const { colors: currentSongColors, songTitle, songAuthor, updateColors, updateGradientSettings } = useContentScript();

  const {
    gradientSettings,
    setGradientSettings,
    updateGradientSetting,
    resetGradientSettings,
    exportSettings,
    importSettings,
  } = useGradientSettings();

  const handleColorChange = async (index: number, color: string) => {
    const newColors = [...currentSongColors];
    newColors[index] = color;
    await updateColors(newColors);
  };

  const handleGradientSettingChange = async (key: keyof GradientSettings, value: number) => {
    const newSettings = updateGradientSetting(key, value);
    await updateGradientSettings(newSettings);
  };

  const handleToggleChange = async (key: keyof GradientSettings, value: boolean) => {
    const newSettings = { ...gradientSettings, [key]: value };
    await setGradientSettings(newSettings);
    await updateGradientSettings(newSettings);
  };

  const handleShaderTypeChange = async (type: ShaderType) => {
    const newSettings = { ...gradientSettings, shaderType: type };
    await setGradientSettings(newSettings);
    await updateGradientSettings(newSettings);
  };

  const handleResetAllGradientSettings = async () => {
    const newSettings = await resetGradientSettings();
    await updateGradientSettings(newSettings);
  };

  const handleExportSettings = () => {
    exportSettings();
  };

  const handleImportSettings = async () => {
    const importedSettings = await importSettings();
    if (importedSettings) {
      // Update content script with imported settings
      await updateGradientSettings(importedSettings);
    }
  };

  return (
    <div className="popup-container">
      <Header songTitle={songTitle} songAuthor={songAuthor} />

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="content">
        {activeTab === "colors" && (
          <ColorsTab
            colors={currentSongColors}
            shaderType={gradientSettings.shaderType}
            onColorChange={handleColorChange}
            onColorsChange={updateColors}
          />
        )}

        {activeTab === "controls" && (
          <ControlsTab
            settings={gradientSettings}
            onSettingChange={handleGradientSettingChange}
            onToggleChange={handleToggleChange}
            onShaderTypeChange={handleShaderTypeChange}
            onResetAll={handleResetAllGradientSettings}
            onExport={handleExportSettings}
            onImport={handleImportSettings}
          />
        )}
      </div>
    </div>
  );
};

export default Popup;
