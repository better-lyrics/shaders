import React, { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";

const COPIED_FEEDBACK_MS = 1500;

export const CopyChip: React.FC<{ value: string; tabIndex?: number }> = ({ value, tabIndex }) => {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimeoutRef = useRef<number>();

  useEffect(() => () => window.clearTimeout(resetTimeoutRef.current), []);

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return;
    }
    window.clearTimeout(resetTimeoutRef.current);
    setIsCopied(true);
    resetTimeoutRef.current = window.setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <>
      <button type="button" className="copy-chip" tabIndex={tabIndex} onClick={copyValue}>
        <code className="copy-chip__value">{value}</code>
        <span className="copy-chip__icons" data-state={isCopied ? "copied" : "idle"}>
          <CopyIcon size={11} className="copy-chip__icon copy-chip__icon--copy" />
          <CheckIcon size={11} className="copy-chip__icon copy-chip__icon--check" />
        </span>
      </button>
      <span className="copy-chip__status" aria-live="polite">
        {isCopied ? "Copied" : ""}
      </span>
    </>
  );
};
