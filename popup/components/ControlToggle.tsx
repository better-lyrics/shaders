import React from "react";
import { Tooltip } from "./Tooltip";

interface ControlToggleProps {
  label?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}

export const ControlToggle: React.FC<ControlToggleProps> = ({
  label,
  value,
  onChange,
  hint,
}) => {
  const handleToggle = () => {
    onChange(!value);
  };

  const displayLabel = label || (hint ? hint.split(" - ")[0] : "");

  const labelText = (
    <span
      style={
        hint
          ? {
              textDecoration: "underline dotted",
              textUnderlineOffset: "3px",
              cursor: "help",
            }
          : undefined
      }
    >
      {displayLabel}
    </span>
  );

  return (
    <div className="control-row">
      <div className="control-header">
        <div className="control-label">
          <div className="control-label__title">
            <div className="control-label__title-fixed">
              {hint ? <Tooltip content={hint}>{labelText}</Tooltip> : labelText}
            </div>
            <div className="control-label__body">{value ? "ON" : "OFF"}</div>
          </div>
        </div>
      </div>

      <div className="toggle-container">
        <button
          type="button"
          className={`toggle-button ${value ? "toggle-button--active" : ""}`}
          onClick={handleToggle}
          aria-pressed={value}
        >
          <div className="toggle-slider" />
        </button>
      </div>
    </div>
  );
};
