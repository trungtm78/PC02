import { type ReactNode } from "react";
import { TAB_CONTAINER, TAB_LIST, getTabClass } from "@/constants/styles";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface TabBarProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  /** If true, renders without the outer container (for embedding) */
  inline?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TabBar<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  inline = false,
}: TabBarProps<T>) {
  const tabList = (
    <div className={TAB_LIST} data-testid="tab-list">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={getTabClass(activeTab === tab.id)}
          data-testid={`tab-${tab.id}`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );

  if (inline) return tabList;

  return <div className={TAB_CONTAINER}>{tabList}</div>;
}
