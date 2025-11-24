import React from "react";
import { TabType } from "../types";

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="tabs">
      <button className={`tab ${activeTab === "colors" ? "tab--active" : ""}`} onClick={() => onTabChange("colors")}>
        Colors
      </button>
      <button
        className={`tab ${activeTab === "controls" ? "tab--active" : ""}`}
        onClick={() => onTabChange("controls")}
      >
        Controls
      </button>
    </div>
  );
};
