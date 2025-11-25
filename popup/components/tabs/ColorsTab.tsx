import React, { useState, useRef, useEffect } from "react";
import { ColorRow } from "../ColorRow";
import { EmptyState } from "../EmptyState";

interface ColorsTabProps {
  colors: string[];
  onColorChange: (index: number, color: string) => void;
  onColorsChange?: (colors: string[]) => void;
}

export const ColorsTab: React.FC<ColorsTabProps> = ({ colors, onColorChange, onColorsChange }) => {
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
  const pasteContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showPasteInput && pasteContainerRef.current) {
      pasteContainerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [showPasteInput]);

  const handleCopyPalette = async () => {
    const colorText = colors.join("\n");
    try {
      await navigator.clipboard.writeText(colorText);
      alert("Color palette copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    }
  };

  const handlePasteColors = async () => {
    console.log("Paste colors clicked, input:", pasteInput);

    const lines = pasteInput.trim().split("\n").filter(line => line.trim());
    console.log("Parsed lines:", lines);

    const validColors = lines.filter(line => {
      const hslMatch = line.match(/hsl\(\d+,\s*\d+%,\s*\d+%\)/);
      return hslMatch !== null;
    });

    console.log("Valid colors found:", validColors);

    if (validColors.length === 0) {
      alert("No valid HSL colors found. Please paste colors in format: hsl(360, 100%, 50%)");
      return;
    }

    const newColors = [...colors];
    const colorsToUpdate = validColors.slice(0, Math.min(5, colors.length));

    colorsToUpdate.forEach((color, index) => {
      newColors[index] = color;
    });

    console.log("Updating colors to:", newColors);

    if (onColorsChange) {
      await onColorsChange(newColors);
    } else {
      for (let i = 0; i < colorsToUpdate.length; i++) {
        await onColorChange(i, colorsToUpdate[i]);
      }
    }

    setPasteInput("");
    setShowPasteInput(false);
  };

  return (
    <div className="tab-content">
      {colors.length > 0 ? (
        <div className="colors-section">
          <div className="colors-grid">
            {colors.map((color, index) => (
              <ColorRow key={index} color={color} index={index} onColorChange={onColorChange} />
            ))}
          </div>

          <div className="colors-actions">
            <button onClick={handleCopyPalette} className="action-button" title="Copy Color Palette">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                  <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </g>
              </svg>
              COPY PALETTE
            </button>

            <button
              onClick={() => setShowPasteInput(!showPasteInput)}
              className="action-button"
              title="Paste Colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                  <path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z" />
                  <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
                </g>
              </svg>
              PASTE COLORS
            </button>
          </div>

          {showPasteInput && (
            <div className="paste-input-container" ref={pasteContainerRef}>
              <textarea
                className="paste-input"
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder="Paste colors here (one per line)&#10;e.g. hsl(227, 37%, 22%)"
                rows={5}
              />
              <div className="paste-actions">
                <button onClick={handlePasteColors} className="action-button">
                  Apply
                </button>
                <button
                  onClick={() => {
                    setShowPasteInput(false);
                    setPasteInput("");
                  }}
                  className="action-button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
};
