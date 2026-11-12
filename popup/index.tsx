import React from "react";
import "./popup.css";

import {
  AboutTab,
  AudioTab,
  ExtrasTab,
  Footer,
  GeneralTab,
  Header,
  LookTab,
  MotionTab,
  NowPlaying,
  ResistFingerprintingNotice,
  TabBar,
  VideoTab,
} from "./components";
import { useContentScript, useGradientSettings, useTabState } from "./hooks";
import { GradientSettings, SettingsTab, defaultSettings } from "./types";

const Popup: React.FC = () => {
  const { activeTab, selectTab, isAboutOpen, toggleAbout } = useTabState();
  const {
    songTitle,
    songAuthor,
    albumArtUrl,
    animatedArtUrl,
    isAd,
    animatedArtBlockedByResistFingerprinting,
    updateGradientSettings,
  } = useContentScript();

  const {
    gradientSettings,
    setGradientSettings,
    updateGradientSetting,
    resetGradientSettings,
    exportSettings,
    importSettings,
  } = useGradientSettings();

  const handleSettingChange = async (key: keyof GradientSettings, value: number) => {
    await updateGradientSettings(updateGradientSetting(key, value));
  };

  const handleToggleChange = async (key: keyof GradientSettings, value: boolean) => {
    const newSettings = { ...gradientSettings, [key]: value };
    await setGradientSettings(newSettings);
    await updateGradientSettings(newSettings);
  };

  const handleSettingReset = async (key: keyof GradientSettings) => {
    await handleSettingChange(key, defaultSettings[key] as number);
  };

  const handleResetAll = async () => {
    await updateGradientSettings(await resetGradientSettings());
  };

  const handleImport = async () => {
    const imported = await importSettings();
    if (imported) await updateGradientSettings(imported);
  };

  const sliderProps = {
    settings: gradientSettings,
    onSettingChange: handleSettingChange,
    onSettingReset: handleSettingReset,
  };

  const panels: Record<SettingsTab, React.ReactNode> = {
    general: <GeneralTab settings={gradientSettings} onToggleChange={handleToggleChange} />,
    look: <LookTab {...sliderProps} onToggleChange={handleToggleChange} />,
    motion: <MotionTab {...sliderProps} />,
    video: <VideoTab {...sliderProps} onToggleChange={handleToggleChange} />,
    audio: <AudioTab {...sliderProps} onToggleChange={handleToggleChange} />,
    extras: <ExtrasTab settings={gradientSettings} onToggleChange={handleToggleChange} />,
  };

  return (
    <div className="popup">
      <Header />

      <NowPlaying
        songTitle={songTitle}
        songAuthor={songAuthor}
        albumArtUrl={albumArtUrl}
        animatedArtUrl={animatedArtUrl}
        isAd={isAd}
        enabled={gradientSettings.enabled}
        onEnabledChange={value => handleToggleChange("enabled", value)}
      />

      <ResistFingerprintingNotice open={animatedArtBlockedByResistFingerprinting} />

      {!isAboutOpen && <TabBar activeTab={activeTab} onTabChange={selectTab} />}

      <div className="scroll">{isAboutOpen ? <AboutTab /> : panels[activeTab]}</div>

      <Footer
        isAboutOpen={isAboutOpen}
        onAboutToggle={toggleAbout}
        onImport={handleImport}
        onExport={exportSettings}
        onReset={handleResetAll}
      />
    </div>
  );
};

export default Popup;
