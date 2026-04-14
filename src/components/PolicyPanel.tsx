import type { PolicyKind } from "../types/events";
import PolicyDropdown, { DropdownValue } from "./ui/PolicyDropdown";
import PolicySplitButton from "./ui/PolicySplitButton";
import { useForceOverrides } from "../hooks/useForceOverrides";

interface Props {
  activeSessionId: string | null;
  pendingCount: number;
  onCommitSessionPolicy: (kind: PolicyKind | null) => void;
  onApproveAll: () => void;
}

const FORCE_LABELS = {
  auto: "Force Auto",
  manual: "Force Manual",
  inherit: "no override",
};

function forceToDropdownValue(f: PolicyKind | null): DropdownValue {
  return f === null ? "inherit" : f;
}

export default function PolicyPanel({
  activeSessionId,
  pendingCount,
  onCommitSessionPolicy,
  onApproveAll,
}: Props) {
  const force = useForceOverrides();
  const current = activeSessionId ? force.get(activeSessionId) : null;

  const onChangeForce = (next: DropdownValue) => {
    if (!activeSessionId) return;
    if (next === "inherit") {
      force.set(activeSessionId, null);
    } else {
      force.set(activeSessionId, next);
    }
  };

  return (
    <div
      className="flex flex-col bg-[var(--bg-surface)]"
      style={{ borderTop: "0.5px solid var(--border)" }}
    >
      <div
        className="flex items-center px-2"
        style={{ height: 36, gap: 8 }}
      >
        <div style={{ flex: "1 1 0" }}>
          <PolicyDropdown
            value={forceToDropdownValue(current)}
            allowInherit
            onChange={onChangeForce}
            labels={FORCE_LABELS}
            ariaLabel="Session force override"
            disabled={activeSessionId === null}
          />
        </div>
        <div style={{ flex: "1.2 1 0", display: "flex", justifyContent: "flex-start" }}>
          <PolicySplitButton
            onCommit={onCommitSessionPolicy}
            disabled={activeSessionId === null}
          />
        </div>
        <button
          type="button"
          onClick={onApproveAll}
          disabled={pendingCount === 0}
          aria-label={`Approve all ${pendingCount} pending`}
          className="rounded transition-[filter,opacity] hover:brightness-95 disabled:opacity-40"
          style={{
            flex: "1 1 0",
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
    </div>
  );
}
