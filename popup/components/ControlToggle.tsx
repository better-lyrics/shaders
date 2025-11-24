import React from "react";

interface ControlToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export const ControlToggle: React.FC<ControlToggleProps> = ({ label, value, onChange }) => {
  const handleToggle = () => {
    onChange(!value);
  };

  return (
    <div className="control-row">
      <div className="control-header">
        <div className="control-label">
          <div className="control-label__title">
            <div className="control-label__title-fixed">{label}</div>
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
