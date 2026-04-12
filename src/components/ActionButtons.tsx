interface ActionButtonsProps {
  onApprove: () => void;
  onDeny: () => void;
  approveLabel: string;
  denyLabel: string;
  variant?: "approval" | "permission";
  onApproveSession?: () => void;
}

export default function ActionButtons({
  onApprove,
  onDeny,
  approveLabel,
  denyLabel,
  variant = "approval",
  onApproveSession,
}: ActionButtonsProps) {
  if (variant === "permission" && onApproveSession) {
    return (
      <div className="flex" style={{ borderTop: "0.5px solid var(--border)" }}>
        <button
          type="button"
          onClick={onApprove}
          aria-label={approveLabel}
          className="flex-1 h-9 font-semibold bg-[var(--approve-bg)] text-[var(--approve-text)] transition-[filter,transform] hover:brightness-95 active:scale-[0.98]"
          style={{ fontSize: 12, borderRight: "0.5px solid var(--border)" }}
        >
          Allow
        </button>
        <button
          type="button"
          onClick={onApproveSession}
          aria-label="Allow for session"
          className="flex-1 h-9 font-semibold transition-[filter,transform] hover:brightness-95 active:scale-[0.98]"
          style={{
            fontSize: 12,
            borderRight: "0.5px solid var(--border)",
            background: "var(--session-approve-bg)",
            color: "var(--session-approve-text)",
          }}
        >
          Allow session
        </button>
        <button
          type="button"
          onClick={onDeny}
          aria-label={denyLabel}
          className="flex-1 h-9 font-semibold bg-[var(--deny-bg)] text-[var(--deny-text)] transition-[filter,transform] hover:brightness-95 active:scale-[0.98]"
          style={{ fontSize: 12 }}
        >
          Deny
        </button>
      </div>
    );
  }

  return (
    <div className="flex" style={{ borderTop: "0.5px solid var(--border)" }}>
      <button
        type="button"
        onClick={onApprove}
        aria-label={approveLabel}
        className="flex-1 h-9 font-semibold bg-[var(--approve-bg)] text-[var(--approve-text)] transition-[filter,transform] hover:brightness-95 active:scale-[0.98]"
        style={{ fontSize: 13, borderRight: "0.5px solid var(--border)" }}
      >
        Approve
      </button>
      <button
        type="button"
        onClick={onDeny}
        aria-label={denyLabel}
        className="flex-1 h-9 font-semibold bg-[var(--deny-bg)] text-[var(--deny-text)] transition-[filter,transform] hover:brightness-95 active:scale-[0.98]"
        style={{ fontSize: 13 }}
      >
        Deny
      </button>
    </div>
  );
}
