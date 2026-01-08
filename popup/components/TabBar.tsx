import React from "react";
import { TabType } from "../types";

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="tabs">
      <button
        className={`tab ${activeTab === "controls" ? "tab--active" : ""}`}
        onClick={() => onTabChange("controls")}
      >
        Controls
      </button>
      <button className={`tab ${activeTab === "about" ? "tab--active" : ""}`} onClick={() => onTabChange("about")}>
        About
      </button>
    </div>
  );
};
