import React from "react";
import { ColorRow } from "../ColorRow";
import { EmptyState } from "../EmptyState";

interface ColorsTabProps {
  colors: string[];
  onColorChange: (index: number, color: string) => void;
}

export const ColorsTab: React.FC<ColorsTabProps> = ({ colors, onColorChange }) => {
  return (
    <div className="tab-content">
      {colors.length > 0 ? (
        <div className="colors-section">
          <div className="colors-grid">
            {colors.map((color, index) => (
              <ColorRow key={index} color={color} index={index} onColorChange={onColorChange} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
};
