import { getCurrentWindow } from "@tauri-apps/api/window";
import NotificationsSection from "./NotificationsSection";
import WslInstancesSection from "./WslInstancesSection";
import { useAppSettings } from "../hooks/useAppSettings";

export default function SettingsWindow() {
  const { settings, loading, error, update } = useAppSettings();

  const close = () => {
    getCurrentWindow().close().catch(() => {});
  };

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

      <div className="flex-1 overflow-y-auto flex flex-col" style={{ gap: 4 }}>
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
          <>
            <NotificationsSection settings={settings} onChange={update} />
            <div
              style={{
                borderTop: "0.5px solid var(--border)",
                margin: "0 16px",
              }}
            />
            <WslInstancesSection />
          </>
        )}
      </div>
    </div>
  );
}
