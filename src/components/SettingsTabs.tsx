import type { ReactNode } from "react";
import type { SettingsTabId } from "../types/settings";

export interface TabDef {
  id: SettingsTabId;
  label: string;
  content: ReactNode;
}

interface Props {
  tabs: TabDef[];
  active: SettingsTabId;
  onChange: (id: SettingsTabId) => void;
}

export default function SettingsTabs({ tabs, active, onChange }: Props) {
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div
        role="tablist"
        className="flex items-center bg-[var(--bg-surface)]"
        style={{
          height: 36,
          padding: "0 8px",
          gap: 4,
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              style={{
                height: 32,
                padding: "0 10px",
                fontSize: 12,
                fontFamily: "var(--font-ui)",
                fontWeight: isActive ? 600 : 400,
                color: isActive
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
                background: "transparent",
                border: "none",
                borderBottom: isActive
                  ? "2px solid var(--gold)"
                  : "2px solid transparent",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto">{activeTab.content}</div>
    </div>
  );
}
