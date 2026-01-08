import React from "react";
import "./popup.css";

import { useContentScript, useGradientSettings, useTabState } from "./hooks";
import { AboutTab, ControlsTab, Header, TabBar } from "./components";
import { GradientSettings } from "./types";

const Popup: React.FC = () => {
  const { activeTab, setActiveTab } = useTabState();
  const { songTitle, songAuthor, updateGradientSettings } = useContentScript();

  const {
    gradientSettings,
    setGradientSettings,
    updateGradientSetting,
    resetGradientSettings,
    exportSettings,
    importSettings,
  } = useGradientSettings();

  const handleGradientSettingChange = async (key: keyof GradientSettings, value: number) => {
    const newSettings = updateGradientSetting(key, value);
    await updateGradientSettings(newSettings);
  };

  const handleToggleChange = async (key: keyof GradientSettings, value: boolean) => {
    const newSettings = { ...gradientSettings, [key]: value };
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
      await updateGradientSettings(importedSettings);
    }
  };

  return (
    <div className="popup-container">
      <Header songTitle={songTitle} songAuthor={songAuthor} />

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="content">
        {activeTab === "about" && <AboutTab />}

        {activeTab === "controls" && (
          <ControlsTab
            settings={gradientSettings}
            onSettingChange={handleGradientSettingChange}
            onToggleChange={handleToggleChange}
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
