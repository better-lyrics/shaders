import React from "react";

export const EmptyState: React.FC = () => {
  return (
    <div className="empty-state">
      <div className="empty-icon">🎵</div>
      <h3>No song detected</h3>
      <p>Please visit YouTube Music and play a song to see the extracted colors</p>
    </div>
  );
};
