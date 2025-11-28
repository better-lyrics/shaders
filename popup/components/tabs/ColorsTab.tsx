import React, { useState, useRef, useEffect } from "react";
import type { ShaderType } from "../../types";
import { ColorRow } from "../ColorRow";
import { EmptyState } from "../EmptyState";

interface ColorsTabProps {
  colors: string[];
  shaderType: ShaderType;
  onColorChange: (index: number, color: string) => void;
  onColorsChange?: (colors: string[]) => void;
}

export const ColorsTab: React.FC<ColorsTabProps> = ({ colors, shaderType, onColorChange, onColorsChange }) => {
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

    const lines = pasteInput
      .trim()
      .split("\n")
      .filter(line => line.trim());
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

  if (shaderType === "kawarp") {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-icon empty-icon--full-opacity">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 512 512">
              <path
                d="M 512 256 C 512 397.385 397.385 512 256 512 C 114.615 512 0 397.385 0 256 C 0 114.615 114.615 0 256 0 C 397.385 0 512 114.615 512 256 Z M 216.877 101.494 C 129.312 123.247 77.337 215.006 103.18 301.61 C 121.687 363.631 176.581 409.295 240.38 414.757 C 287.712 418.809 329.728 405.453 364.631 372.705 C 402.973 336.73 419.903 291.754 414.474 239.817 C 408.507 182.738 378.509 140.758 327.553 113.442 C 291.849 96.169 254.947 92.037 216.877 101.494 Z M 111.49 258.009 C 111.657 203.346 135.045 160.293 181.947 132.029 C 257.535 86.476 354.347 118.494 389.27 199.487 C 425.321 283.1 374.187 380.741 284.761 397.772 C 230.539 408.099 184.56 391.825 147.1 351.356 C 123.778 324.1 111.384 293.035 111.49 258.009 Z M 275.782 205.816 C 285.751 205.816 295.066 205.859 304.381 205.802 C 312.272 205.755 316.316 201.706 316.432 193.751 C 316.512 188.253 316.544 182.75 316.422 177.253 C 316.252 169.635 312.169 165.693 304.507 165.667 C 292.342 165.626 280.176 165.637 268.011 165.66 C 259.036 165.678 255.746 169.021 255.743 178.109 C 255.734 207.273 255.743 236.436 255.729 265.6 C 255.729 267.311 255.584 269.021 255.493 271.034 C 252.926 269.96 250.993 269 248.965 268.328 C 234.723 263.608 221.596 265.768 210.09 275.438 C 198.291 285.355 193.507 298.277 196.25 313.409 C 200.094 334.613 218.73 348.223 240.237 346.153 C 260.242 344.228 275.646 326.851 275.757 305.878 C 275.856 287.047 275.781 268.215 275.782 248.883 C 275.782 234.286 275.782 220.188 275.782 205.816 Z"
                fill="rgb(242, 12, 50)"
              />
              <path
                d="M 216.877 101.494 C 129.312 123.247 77.337 215.006 103.18 301.61 C 121.687 363.631 176.581 409.295 240.38 414.757 C 287.712 418.809 329.728 405.453 364.631 372.705 C 402.973 336.73 419.903 291.754 414.474 239.817 C 408.507 182.738 378.509 140.758 327.553 113.442 C 291.849 96.169 254.947 92.037 216.877 101.494 Z M 111.49 258.009 C 111.657 203.346 135.045 160.293 181.947 132.029 C 257.535 86.476 354.347 118.494 389.27 199.487 C 425.321 283.1 374.187 380.741 284.761 397.772 C 230.539 408.099 184.56 391.825 147.1 351.356 C 123.778 324.1 111.384 293.035 111.49 258.009 Z M 275.782 205.816 C 285.751 205.816 295.066 205.859 304.381 205.802 C 312.272 205.755 316.316 201.706 316.432 193.751 C 316.512 188.253 316.544 182.75 316.422 177.253 C 316.252 169.635 312.169 165.693 304.507 165.667 C 292.342 165.626 280.176 165.637 268.011 165.66 C 259.036 165.678 255.746 169.021 255.743 178.109 C 255.734 207.273 255.743 236.436 255.729 265.6 C 255.729 267.311 255.584 269.021 255.493 271.034 C 252.926 269.96 250.993 269 248.965 268.328 C 234.723 263.608 221.596 265.768 210.09 275.438 C 198.291 285.355 193.507 298.277 196.25 313.409 C 200.094 334.613 218.73 348.223 240.237 346.153 C 260.242 344.228 275.646 326.851 275.757 305.878 C 275.856 287.047 275.781 268.215 275.782 248.883 C 275.782 234.286 275.782 220.188 275.782 205.816 Z"
                fill="#fff"
              />
            </svg>
          </div>
          <h3>Kawarp Mode</h3>
          <p>
            Kawarp uses the album artwork directly to create fluid, animated backgrounds. No color extraction needed.
          </p>
          <p className="kawarp-credit">
            <a href="https://kawarp.boidu.dev/" target="_blank" rel="noopener noreferrer">
              Kawarp
            </a>{" "}
            is developed in-house by the Better Lyrics team.
          </p>
        </div>
      </div>
    );
  }

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

            <button onClick={() => setShowPasteInput(!showPasteInput)} className="action-button" title="Paste Colors">
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
                onChange={e => setPasteInput(e.target.value)}
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
