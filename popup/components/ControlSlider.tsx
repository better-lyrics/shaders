import React from "react";
import { GradientSettings } from "../types";
import { ResetIcon } from "./ResetIcon";
import { getControlConfig, formatValue, getControlLabel } from "../utils";

interface ControlSliderProps {
  keyName: string;
  value: number;
  onChange: (key: keyof GradientSettings, value: number) => void;
  onReset: (key: keyof GradientSettings) => void;
}

export const ControlSlider: React.FC<ControlSliderProps> = ({ keyName, value, onChange, onReset }) => {
  const keyTyped = keyName as keyof GradientSettings;
  const { min, max, step } = getControlConfig(keyName);

  return (
    <div className="control-row">
      <div className="control-header">
        <label className="control-label">
          <span className="control-label__title">
            <div className="control-label__title-fixed">
              {getControlLabel(keyName)}
              <ResetIcon onClick={() => onReset(keyTyped)} title={`Reset ${keyName} to default`} />
            </div>
            <span className="control-label__body">{formatValue(keyName, value)}</span>
          </span>
        </label>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(keyTyped, parseFloat(e.target.value))}
        className="control-slider"
      />
    </div>
  );
};
