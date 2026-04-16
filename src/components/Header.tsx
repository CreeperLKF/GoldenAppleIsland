import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import log from "../lib/log";
import logoUrl from "../assets/logo.png";
import Icon from "./ui/Icon";

interface HeaderProps {
  pendingCount: number;
  connected: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function statusLabel(pendingCount: number, connected: boolean) {
  if (pendingCount > 0) return { text: `${pendingCount} pending`, tone: "warn" as const };
  if (connected) return { text: "idle", tone: "muted" as const };
  return { text: "offline", tone: "muted" as const };
}

export default function Header({
  pendingCount, connected, pinned, onTogglePin, collapsed, onToggleCollapse,
}: HeaderProps) {
  const status = statusLabel(pendingCount, connected);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    getCurrentWindow().startDragging().catch(log.error);
  }, []);

  const openSettings = useCallback(() => {
    invoke("open_settings_window").catch(log.error);
  }, []);

  return (
    <header
      id="popup-header"
      onMouseDown={handleMouseDown}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 36,
        padding: "0 10px",
        background: "var(--bg-surface)",
        userSelect: "none",
        cursor: "grab",
        /* hairline divider without subpixel issues */
        boxShadow: "0 0.5px 0 0 var(--border)",
      }}
    >
      {/* Left: brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <img
          src={logoUrl}
          alt=""
          width={16}
          height={16}
          draggable={false}
          style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "var(--fs-title)",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          Golden Apple Island
        </span>
      </div>

      {/* Right: status + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <span
          className="tabular"
          style={{
            fontSize: "var(--fs-small)",
            color: status.tone === "warn" ? "var(--cat-shell)" : "var(--text-tertiary)",
            marginRight: 6,
            fontFamily: "var(--font-mono)",
            fontWeight: status.tone === "warn" ? 500 : 400,
          }}
        >
          {status.text}
        </span>
        <IconButton
          label={pinned ? "Unpin from top" : "Pin to top"}
          onClick={onTogglePin}
          active={pinned}
        >
          <Icon name="pin" size={14} />
        </IconButton>
        <IconButton label="Open settings" onClick={openSettings}>
          <Icon name="settings" size={14} />
        </IconButton>
        <IconButton label="Minimize" onClick={() => invoke("hide_popup").catch(log.error)}>
          <Icon name="minimize" size={14} />
        </IconButton>
        <IconButton label={collapsed ? "Expand" : "Collapse"} onClick={onToggleCollapse}>
          <Icon name={collapsed ? "chevron-down" : "chevron-up"} size={14} />
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({
  children, onClick, label, active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 28, height: 28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        color: active ? "var(--gold)" : "var(--text-tertiary)",
        cursor: "pointer",
        transition: "background-color 120ms, color 120ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
        if (!active) e.currentTarget.style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        if (!active) e.currentTarget.style.color = "var(--text-tertiary)";
      }}
    >
      {children}
    </button>
  );
}
