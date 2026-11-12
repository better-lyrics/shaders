import React from "react";
import { GradientSettings } from "@/popup/types";
import { ControlToggle } from "../ControlToggle";

interface GeneralTabProps {
  settings: GradientSettings;
  onToggleChange: (key: keyof GradientSettings, value: boolean) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings, onToggleChange }) => (
  <div className="panel">
    <ControlToggle
      label="Audio reactive"
      hint="Pulse the background in time with the music."
      value={settings.audioResponsive}
      onChange={value => onToggleChange("audioResponsive", value)}
    />
    <ControlToggle
      label="Animated album art"
      hint="Play looping artwork when the album has it."
      value={settings.enableAnimatedArt}
      onChange={value => onToggleChange("enableAnimatedArt", value)}
    />
    <ControlToggle
      label="Spotify Canvas"
      hint="Play looping Spotify Canvas videos instead of album art when available."
      value={settings.enableSpotifyCanvas}
      onChange={value => onToggleChange("enableSpotifyCanvas", value)}
    />
    <ControlToggle
      label="Show on browse pages"
      hint="Extends the effect to home and search. Costs performance."
      value={settings.showOnBrowsePages}
      onChange={value => onToggleChange("showOnBrowsePages", value)}
    />
    <ControlToggle
      label="Pause when inactive"
      hint="Stop rendering while the tab is hidden."
      value={settings.pauseOnInactive}
      onChange={value => onToggleChange("pauseOnInactive", value)}
    />
  </div>
);
