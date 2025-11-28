import { useState } from "react";
import { TabType } from "../types";

export const useTabState = (initialTab: TabType = "controls") => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  return { activeTab, setActiveTab };
};
