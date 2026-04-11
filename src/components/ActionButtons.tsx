interface ActionButtonsProps {
  onApprove: () => void;
  onDeny: () => void;
  approveLabel: string;
  denyLabel: string;
}

export default function ActionButtons({
  onApprove,
  onDeny,
  approveLabel,
  denyLabel,
}: ActionButtonsProps) {
  return (
    <div
      className="flex"
      style={{ borderTop: "0.5px solid var(--border)" }}
    >
      <button
        type="button"
        onClick={onApprove}
        aria-label={approveLabel}
        className="flex-1 h-9 font-semibold bg-[var(--approve-bg)] text-[var(--approve-text)] transition-[filter,transform] hover:brightness-95 active:scale-[0.98]"
        style={{
          fontSize: 13,
          borderRight: "0.5px solid var(--border)",
        }}
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
