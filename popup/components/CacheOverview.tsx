import React from "react";
import { useCacheInfo } from "@/popup/hooks";

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  const precision = i === 0 ? 0 : 2;
  return `${value.toFixed(precision)} ${units[i]}`;
};

export const CacheOverview: React.FC = () => {
  const { count, sizeBytes, isClearing, clear, exportCache, importCache } = useCacheInfo();

  return (
    <div className="cache-overview">
      <div className="cache-overview__header">
        <span className="cache-overview__title">Animated Art Cache</span>
        <div className="cache-overview__actions">
          <button
            type="button"
            className="cache-overview__action"
            onClick={importCache}
            title="Import animated art cache"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 16.5a.75.75 0 0 1-.75-.75V5.06L8.03 8.28a.75.75 0 0 1-1.06-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06l-3.22-3.22v10.69a.75.75 0 0 1-.75.75" />
              <path d="M3.75 17.25a.75.75 0 0 1 .75.75v2.25c0 .138.112.25.25.25h14.5a.25.25 0 0 0 .25-.25V18a.75.75 0 0 1 1.5 0v2.25A1.75 1.75 0 0 1 19.25 22H4.75A1.75 1.75 0 0 1 3 20.25V18a.75.75 0 0 1 .75-.75" />
            </svg>
            IMPORT
          </button>
          <button
            type="button"
            className="cache-overview__action"
            onClick={exportCache}
            disabled={count === 0}
            title="Export animated art cache"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3a.75.75 0 0 1 .75.75v10.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3.75A.75.75 0 0 1 12 3" />
              <path d="M3.75 17.25a.75.75 0 0 1 .75.75v2.25c0 .138.112.25.25.25h14.5a.25.25 0 0 0 .25-.25V18a.75.75 0 0 1 1.5 0v2.25A1.75 1.75 0 0 1 19.25 22H4.75A1.75 1.75 0 0 1 3 20.25V18a.75.75 0 0 1 .75-.75" />
            </svg>
            EXPORT
          </button>
          <button
            type="button"
            className="cache-overview__action cache-overview__action--danger"
            onClick={clear}
            disabled={isClearing || count === 0}
            title="Clear animated art cache"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.75a2.25 2.25 0 0 0-2.122 1.5a.75.75 0 0 1-1.414-.5a3.751 3.751 0 0 1 7.073 0a.75.75 0 0 1-1.415.5A2.25 2.25 0 0 0 12 2.75M2.75 6a.75.75 0 0 1 .75-.75h17a.75.75 0 0 1 0 1.5h-17A.75.75 0 0 1 2.75 6m3.165 2.45a.75.75 0 1 0-1.497.1l.464 6.952c.085 1.282.154 2.318.316 3.132c.169.845.455 1.551 1.047 2.104s1.315.793 2.17.904c.822.108 1.86.108 3.146.108h.879c1.285 0 2.324 0 3.146-.108c.854-.111 1.578-.35 2.17-.904c.591-.553.877-1.26 1.046-2.104c.162-.814.23-1.85.316-3.132l.464-6.952a.75.75 0 0 0-1.497-.1l-.46 6.9c-.09 1.347-.154 2.285-.294 2.99c-.137.685-.327 1.047-.6 1.303c-.274.256-.648.422-1.34.512c-.713.093-1.653.095-3.004.095h-.774c-1.35 0-2.29-.002-3.004-.095c-.692-.09-1.066-.256-1.34-.512c-.273-.256-.463-.618-.6-1.303c-.14-.705-.204-1.643-.294-2.99z" />
              <path d="M9.425 10.254a.75.75 0 0 1 .821.671l.5 5a.75.75 0 0 1-1.492.15l-.5-5a.75.75 0 0 1 .671-.821m5.821.821a.75.75 0 0 0-1.492-.15l-.5 5a.75.75 0 0 0 1.492.15z" />
            </svg>
            {isClearing ? "CLEARING" : "CLEAR"}
          </button>
        </div>
      </div>
      <div className="cache-overview__stats">
        <div className="cache-overview__row">
          <span className="cache-overview__label">Cached Albums</span>
          <span className="cache-overview__dots" aria-hidden="true" />
          <span className="cache-overview__value">{count}</span>
        </div>
        <div className="cache-overview__row">
          <span className="cache-overview__label">Cache Size</span>
          <span className="cache-overview__dots" aria-hidden="true" />
          <span className="cache-overview__value">{formatBytes(sizeBytes)}</span>
        </div>
      </div>
    </div>
  );
};
