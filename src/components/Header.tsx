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

  return (
    <header
      data-tauri-drag-region
      className="flex h-9 items-center justify-between px-3 bg-[var(--bg-surface)] select-none"
      style={{ borderBottom: "0.5px solid var(--border)" }}
    >
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <span
          className="inline-block rounded-full"
          style={{ width: 8, height: 8, background: "var(--accent-green)" }}
          aria-hidden
        />
        <span
          className="font-semibold text-[var(--text-primary)]"
          style={{ fontSize: 13 }}
          data-tauri-drag-region
        >
          Claude Hook Guard
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span
          className="text-[var(--text-tertiary)] mr-1"
          style={{ fontSize: 11 }}
          data-tauri-drag-region
        >
          {status}
        </span>
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
