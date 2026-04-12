import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import log from "../lib/log";
import logoUrl from "../assets/logo.png";

interface HeaderProps {
  pendingCount: number;
  connected: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Header({
  pendingCount,
  connected,
  pinned,
  onTogglePin,
  collapsed,
  onToggleCollapse,
}: HeaderProps) {
  const status =
    pendingCount > 0
      ? `${pendingCount} pending`
      : connected
        ? "All clear"
        : "No sessions";

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      getCurrentWindow().startDragging().catch(log.error);
    },
    [],
  );

  const openSettings = useCallback(() => {
    invoke("open_settings_window").catch(log.error);
  }, []);

  return (
    <header
      id="popup-header"
      className="flex h-9 items-center justify-between px-3 bg-[var(--bg-surface)] select-none"
      style={{
        borderBottom: "0.5px solid var(--border)",
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center gap-2">
        <img
          src={logoUrl}
          alt=""
          width={16}
          height={16}
          draggable={false}
          style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
        />
        <span
          className="inline-block rounded-full"
          style={{ width: 8, height: 8, background: "var(--accent-green)" }}
          aria-hidden
        />
        <span
          className="font-semibold text-[var(--text-primary)]"
          style={{ fontSize: 13 }}
        >
          Golden Apple Island
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span
          className="text-[var(--text-tertiary)] mr-1"
          style={{ fontSize: 11 }}
        >
          {status}
        </span>
        {/* Pin toggle */}
        <button
          type="button"
          onClick={onTogglePin}
          className="flex items-center justify-center rounded hover:bg-[var(--bg-elevated)]"
          style={{ width: 24, height: 24, fontSize: 13 }}
          aria-label={pinned ? "Unpin from top" : "Pin to top"}
          title={pinned ? "Unpin from top" : "Pin to top"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={pinned ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: pinned ? "var(--text-primary)" : "var(--text-tertiary)" }}
          >
            <path d="M12 17v5" />
            <path d="M9 2h6l-1 7h4l-2 4H8l-2-4h4L9 2z" />
          </svg>
        </button>
        {/* Settings */}
        <button
          type="button"
          onClick={openSettings}
          className="flex items-center justify-center rounded hover:bg-[var(--bg-elevated)]"
          style={{ width: 24, height: 24, fontSize: 13 }}
          aria-label="Open settings"
          title="Settings"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--text-tertiary)" }}
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center justify-center rounded hover:bg-[var(--bg-elevated)]"
          style={{ width: 24, height: 24, fontSize: 13 }}
          aria-label={collapsed ? "Expand" : "Collapse"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--text-tertiary)" }}
          >
            {collapsed ? (
              <polyline points="6 9 12 15 18 9" />
            ) : (
              <polyline points="18 15 12 9 6 15" />
            )}
          </svg>
        </button>
      </div>
    </header>
  );
}
