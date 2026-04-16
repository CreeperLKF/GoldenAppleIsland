import Button from "./ui/Button";

interface ActionButtonsProps {
  onApprove: () => void;
  onDeny: () => void;
  approveLabel: string;
  denyLabel: string;
  variant?: "approval" | "permission";
  onApproveSession?: () => void;
}

export default function ActionButtons({
  onApprove, onDeny, approveLabel, denyLabel,
  variant = "approval", onApproveSession,
}: ActionButtonsProps) {
  // Permission 变体:三按钮
  if (variant === "permission" && onApproveSession) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderTop: "0.5px solid var(--border)",
        }}
      >
        <Button
          variant="primary"
          onClick={onApprove}
          aria-label={approveLabel}
          kbd="A"
          style={{ justifyContent: "center" }}
        >
          Allow
        </Button>
        <Button
          variant="ghost"
          onClick={onApproveSession}
          aria-label="Allow for session"
          size="sm"
          style={{
            color: "var(--sem-info)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          For session
        </Button>
        <Button
          variant="secondary"
          tone="danger"
          onClick={onDeny}
          aria-label={denyLabel}
          kbd="D"
          style={{ justifyContent: "center" }}
        >
          Deny
        </Button>
      </div>
    );
  }

  // 默认:Approve (primary, gold) + Deny (secondary, danger)
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        padding: "8px 12px",
        borderTop: "0.5px solid var(--border)",
      }}
    >
      <Button
        variant="primary"
        onClick={onApprove}
        aria-label={approveLabel}
        kbd="A"
        style={{ justifyContent: "center" }}
      >
        Approve
      </Button>
      <Button
        variant="secondary"
        tone="danger"
        onClick={onDeny}
        aria-label={denyLabel}
        kbd="D"
        style={{ justifyContent: "center" }}
      >
        Deny
      </Button>
    </div>
  );
}
