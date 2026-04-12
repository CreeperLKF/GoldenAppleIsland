import { useState, useCallback, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

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
  const [dragging, setDragging] = useState(false);

  const status =
    pendingCount > 0
      ? `${pendingCount} pending`
      : connected
        ? "All clear"
        : "No sessions";

  const startDrag = useCallback(() => {
    getCurrentWindow().startDragging().catch(() => {});
  }, []);

  // In drag mode, any mousedown on the header starts dragging
  useEffect(() => {
    if (!dragging) return;
    const header = document.getElementById("popup-header");
    if (!header) return;

    const onMouseDown = (e: MouseEvent) => {
      // Don't intercept clicks on buttons
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;
      startDrag();
    };

    header.addEventListener("mousedown", onMouseDown);
    return () => header.removeEventListener("mousedown", onMouseDown);
  }, [dragging, startDrag]);

  return (
    <header
      id="popup-header"
      className="flex h-9 items-center justify-between px-3 bg-[var(--bg-surface)] select-none"
      style={{
        borderBottom: "0.5px solid var(--border)",
        cursor: dragging ? "move" : "default",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block rounded-full"
          style={{ width: 8, height: 8, background: "var(--accent-green)" }}
          aria-hidden
        />
        <span
          className="font-semibold text-[var(--text-primary)]"
          style={{ fontSize: 13 }}
        >
          Claude Hook Guard
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span
          className="text-[var(--text-tertiary)] mr-1"
          style={{ fontSize: 11 }}
        >
          {status}
        </span>
        {/* Move/Drag toggle */}
        <button
          type="button"
          onClick={() => setDragging((d) => !d)}
          className="flex items-center justify-center rounded hover:bg-[var(--bg-elevated)]"
          style={{ width: 24, height: 24, fontSize: 13 }}
          aria-label={dragging ? "Exit move mode" : "Enter move mode"}
          title={dragging ? "Exit move mode" : "Move window"}
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
            style={{ color: dragging ? "var(--text-primary)" : "var(--text-tertiary)" }}
          >
            <polyline points="5 9 2 12 5 15" />
            <polyline points="9 5 12 2 15 5" />
            <polyline points="15 19 12 22 9 19" />
            <polyline points="19 9 22 12 19 15" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="12" y1="2" x2="12" y2="22" />
          </svg>
        </button>
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
