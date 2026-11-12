import React, { useEffect, useId, useState } from "react";
import { CopyChip } from "./CopyChip";
import { CaretDownIcon } from "./icons";

export const ResistFingerprintingNotice: React.FC<{ open: boolean }> = ({ open }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();
  const chipTabIndex = open && isExpanded ? undefined : -1;

  useEffect(() => {
    if (!open) setIsExpanded(false);
  }, [open]);

  return (
    <div className={`fingerprinting-notice${open ? " fingerprinting-notice--open" : ""}`} aria-hidden={!open}>
      <div className="fingerprinting-notice__clip">
        <div
          className={`fingerprinting-notice__content${isExpanded ? " fingerprinting-notice__content--expanded" : ""}`}
        >
          <button
            type="button"
            className="fingerprinting-notice__toggle"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            tabIndex={open ? undefined : -1}
            onClick={() => setIsExpanded(expanded => !expanded)}
          >
            <span className="fingerprinting-notice__title">The background can't follow the animated art</span>
            <CaretDownIcon size={14} className="fingerprinting-notice__chevron" />
          </button>
          <div id={detailsId} className="fingerprinting-notice__details" aria-hidden={!isExpanded}>
            <div className="fingerprinting-notice__clip">
              <div className="fingerprinting-notice__body">
                <p className="fingerprinting-notice__text">
                  Resist fingerprinting caps video size, and animated album art goes over the cap, so the background
                  falls back to the still cover.
                </p>
                <p className="fingerprinting-notice__text">Exempt YouTube Music only:</p>
                <ol className="fingerprinting-notice__steps">
                  <li>
                    Go to <CopyChip value="about:config" tabIndex={chipTabIndex} />
                  </li>
                  <li>
                    Find <CopyChip value="privacy.resistFingerprinting.exemptedDomains" tabIndex={chipTabIndex} />
                  </li>
                  <li>
                    Add <CopyChip value="music.youtube.com" tabIndex={chipTabIndex} /> (comma-separated if other sites
                    are there)
                  </li>
                  <li>Reload this tab</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
