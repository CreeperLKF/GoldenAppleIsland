import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import log from "../lib/log";
import ApprovalPoliciesSection from "./ApprovalPoliciesSection";
import GlobalShortcutsSection from "./GlobalShortcutsSection";
import LoggingSection from "./LoggingSection";
import NotificationsSection from "./NotificationsSection";
import PortSection from "./PortSection";
import WindowsHookSection from "./WindowsHookSection";
import WslInstancesSection from "./WslInstancesSection";
import SettingsTabs, { type TabDef } from "./SettingsTabs";
import { useAppSettings } from "../hooks/useAppSettings";
import type { AppSettings, SettingsTabId } from "../types/settings";

function SubsectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-semibold text-[var(--text-primary)]"
      style={{ fontSize: 12, padding: "8px 16px 4px" }}
    >
      {children}
    </div>
  );
}

function SubsectionDivider() {
  return (
    <div style={{ borderTop: "0.5px solid var(--border)", margin: "8px 16px" }} />
  );
}

function GeneralTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 0 }}>
      <SubsectionHeading>Notifications</SubsectionHeading>
      <NotificationsSection settings={settings} onChange={update} />
      <SubsectionDivider />
      <SubsectionHeading>WebSocket Port</SubsectionHeading>
      <PortSection settings={settings} onChange={update} />
      <SubsectionDivider />
      <SubsectionHeading>Debugging</SubsectionHeading>
      <LoggingSection settings={settings} onChange={update} />
      <SubsectionDivider />
      <SubsectionHeading>Global shortcuts</SubsectionHeading>
      <GlobalShortcutsSection settings={settings} onChange={update} />
    </div>
  );
}

function HookManagementTab() {
  return (
    <div className="flex flex-col" style={{ gap: 0 }}>
      <SubsectionHeading>Windows hook</SubsectionHeading>
      <WindowsHookSection />
      <SubsectionDivider />
      <SubsectionHeading>WSL instances</SubsectionHeading>
      <WslInstancesSection />
    </div>
  );
}

export default function SettingsWindow() {
  const { settings, loading, error, update } = useAppSettings();
  const [active, setActive] = useState<SettingsTabId>("general");

  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (!settings) return;
    restoredRef.current = true;
    if (settings.settings_last_tab && settings.settings_last_tab !== active) {
      setActive(settings.settings_last_tab);
    }
  }, [settings, active]);

  const onChangeTab = (id: SettingsTabId) => {
    setActive(id);
    update({ settings_last_tab: id }).catch(log.error);
  };

  const close = () => {
    getCurrentWindow().close().catch(log.error);
  };

  const tabs: TabDef[] = settings
    ? [
        {
          id: "general",
          label: "General",
          content: <GeneralTab settings={settings} update={update} />,
        },
        {
          id: "approval",
          label: "Approval Policy",
          content: <ApprovalPoliciesSection />,
        },
        {
          id: "hooks",
          label: "Hook Management",
          content: <HookManagementTab />,
        },
      ]
    : [];

  return (
    <div
      className="flex flex-col h-full w-full bg-[var(--bg-base)]"
      style={{
        borderRadius: 8,
        border: "0.5px solid var(--border)",
        overflow: "hidden",
      }}
    >
      <header
        className="flex items-center justify-between bg-[var(--bg-surface)]"
        style={{
          height: 40,
          padding: "0 12px",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        <span
          className="font-semibold text-[var(--text-primary)]"
          style={{ fontSize: 13 }}
        >
          Settings
        </span>
        <button
          type="button"
          onClick={close}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          style={{ fontSize: 12 }}
          aria-label="Close settings"
        >
          Close
        </button>
      </header>

      {loading && (
        <div
          className="text-[var(--text-tertiary)]"
          style={{ fontSize: 12, padding: 16 }}
        >
          Loading settings…
        </div>
      )}

      {error && (
        <div
          className="text-[var(--deny-text)]"
          style={{ fontSize: 12, padding: "0 16px" }}
        >
          {error}
        </div>
      )}

      {settings && (
        <SettingsTabs tabs={tabs} active={active} onChange={onChangeTab} />
      )}
    </div>
  );
}
