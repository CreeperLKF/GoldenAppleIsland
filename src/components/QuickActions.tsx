interface QuickActionsProps {
  pendingCount: number;
  autoApprove: boolean;
  onToggleAutoApprove: () => void;
  onApproveAll: () => void;
}

export default function QuickActions({
  pendingCount,
  autoApprove,
  onToggleAutoApprove,
  onApproveAll,
}: QuickActionsProps) {
  const autoStyle: React.CSSProperties = autoApprove
    ? {
        background: "var(--approve-bg)",
        color: "var(--approve-text)",
        borderColor: "var(--approve-text)",
      }
    : {
        background: "transparent",
        color: "var(--text-secondary)",
        borderColor: "var(--border)",
      };

  return (
    <div
      className="flex items-center gap-2 px-2 bg-[var(--bg-surface)]"
      style={{
        height: 36,
        borderTop: "0.5px solid var(--border)",
      }}
    >
      <button
        type="button"
        onClick={onToggleAutoApprove}
        aria-pressed={autoApprove}
        className="flex-1 rounded transition-[filter] hover:brightness-95"
        style={{
          height: 24,
          fontSize: 12,
          fontWeight: 600,
          borderWidth: "0.5px",
          borderStyle: "solid",
          ...autoStyle,
        }}
      >
        {autoApprove ? "Auto-approve ON" : "Auto-approve session"}
      </button>
      <button
        type="button"
        onClick={onApproveAll}
        disabled={pendingCount === 0}
        aria-label={`Approve all ${pendingCount} pending`}
        className="flex-1 rounded transition-[filter,opacity] hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          height: 24,
          fontSize: 12,
          fontWeight: 600,
          borderWidth: "0.5px",
          borderStyle: "solid",
          borderColor: "var(--border)",
          background: "transparent",
          color: "var(--text-secondary)",
        }}
      >
        Approve all{pendingCount > 0 ? ` (${pendingCount})` : ""}
      </button>
    </div>
  );
}
