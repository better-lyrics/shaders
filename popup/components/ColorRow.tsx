import React from "react";
import { hslToHex, hexToHsl } from "../utils";

interface ColorRowProps {
  color: string;
  index: number;
  onColorChange: (index: number, color: string) => void;
}

export const ColorRow: React.FC<ColorRowProps> = ({ color, index, onColorChange }) => {
  return (
    <div className="color-row">
      <div className="color-preview">
        <input
          key={color}
          type="color"
          value={hslToHex(color)}
          onChange={e => onColorChange(index, hexToHsl(e.target.value))}
          className="color-picker"
        />
      </div>
      <div className="color-details">
        <input
          type="text"
          value={color}
          onChange={e => {
            if (e.target.value.match(/hsl\(\d+,\s*\d+%,\s*\d+%\)/)) {
              onColorChange(index, e.target.value);
            }
          }}
          placeholder="hsl(hue, sat%, light%)"
          className="color-input-text"
        />
      </div>
    </div>
  );
};
