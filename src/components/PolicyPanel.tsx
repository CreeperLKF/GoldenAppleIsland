import type { PolicyKind } from "../types/events";
import PolicyDropdown, { DropdownValue } from "./ui/PolicyDropdown";
import PolicySplitButton from "./ui/PolicySplitButton";
import { useForceOverrides } from "../hooks/useForceOverrides";
import { useAgentConfig } from "../hooks/useAgentConfig";
import { useExternalConfig } from "../hooks/useExternalConfig";

interface Props {
  activeSessionId: string | null;
  pendingCount: number;
  onCommitSessionPolicy: (kind: PolicyKind | null) => void;
  onApproveAll: () => void;
  recentVisible: boolean;
  recentCollapsed: boolean;
  onToggleRecent: () => void;
}

const FORCE_LABELS = {
  auto: "Force Auto",
  manual: "Force Manual",
  inherit: "No Override",
};

function forceToDropdownValue(f: PolicyKind | null): DropdownValue {
  return f === null ? "inherit" : f;
}

export default function PolicyPanel({
  activeSessionId,
  pendingCount,
  onCommitSessionPolicy,
  onApproveAll,
  recentVisible,
  recentCollapsed,
  onToggleRecent,
}: Props) {
  const force = useForceOverrides();
  const current = force.get();
  const { config: agentCfg } = useAgentConfig();
  const { config: externalCfg } = useExternalConfig();
  const agentConfigured = agentCfg?.workspace_path != null;
  const externalConfigured = externalCfg?.endpoint_url != null;

  const onChangeForce = (next: DropdownValue) => {
    if (next === "inherit") {
      force.set(null);
    } else {
      force.set(next);
    }
  };

  return (
    <div
      className="bg-[var(--bg-surface)]"
      style={{ borderTop: "0.5px solid var(--border)" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto auto",
          gridTemplateRows: "32px 32px",
          columnGap: 8,
          rowGap: 4,
          padding: "6px 8px",
          alignItems: "center",
        }}
      >
        {/* Row 1: Override Policy */}
        <span
          style={{
            gridColumn: "1 / 2",
            gridRow: "1 / 2",
            fontSize: 12,
            color: "var(--text-secondary)",
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          Override Policy
        </span>
        <div style={{ gridColumn: "2 / 3", gridRow: "1 / 2" }}>
          <PolicyDropdown
            value={forceToDropdownValue(current)}
            allowInherit
            onChange={onChangeForce}
            labels={FORCE_LABELS}
            ariaLabel="Session force override"
            agentConfigured={agentConfigured}
            externalConfigured={externalConfigured}
          />
        </div>

        {/* Approve All: spans both rows, column 3 */}
        <button
          type="button"
          onClick={onApproveAll}
          disabled={pendingCount === 0}
          aria-label={`Approve all ${pendingCount} pending`}
          className="transition-[filter,opacity] hover:brightness-110 disabled:opacity-40"
          style={{
            gridColumn: "3 / 4",
            gridRow: "1 / 3",
            width: 84,
            height: "100%",
            fontSize: 12,
            fontWeight: 600,
            background: "var(--accent-green-dark)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 6,
            cursor: pendingCount === 0 ? "not-allowed" : "pointer",
          }}
        >
          Approve All{pendingCount > 0 ? ` (${pendingCount})` : ""}
        </button>

        {/* Recent toggle: spans both rows, column 4 */}
        {recentVisible && (
          <button
            type="button"
            onClick={onToggleRecent}
            aria-label={recentCollapsed ? "Expand Recent" : "Collapse Recent"}
            className="rounded hover:text-[var(--text-primary)]"
            style={{
              gridColumn: "4 / 5",
              gridRow: "1 / 3",
              width: 24,
              height: 24,
              alignSelf: "center",
              justifySelf: "center",
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {recentCollapsed ? "▸" : "▾"}
          </button>
        )}

        {/* Row 2: Session Policy */}
        <span
          style={{
            gridColumn: "1 / 2",
            gridRow: "2 / 3",
            fontSize: 12,
            color: "var(--text-secondary)",
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          Session Policy
        </span>
        <div style={{ gridColumn: "2 / 3", gridRow: "2 / 3" }}>
          <PolicySplitButton
            onCommit={onCommitSessionPolicy}
            disabled={activeSessionId === null}
          />
        </div>
      </div>
    </div>
  );
}
