import { useState } from "react";
import type { PolicyKind } from "../types/events";
import PolicyDropdown, { DropdownValue } from "./ui/PolicyDropdown";
import PolicySplitButton from "./ui/PolicySplitButton";
import Icon from "./ui/Icon";
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

const FORCE_LABELS = { auto: "Force Auto", manual: "Force Manual", inherit: "No Override" };

function forceToDropdown(f: PolicyKind | null): DropdownValue {
  return f === null ? "inherit" : f;
}

export default function PolicyPanel({
  activeSessionId, pendingCount,
  onCommitSessionPolicy, onApproveAll,
  recentVisible, recentCollapsed, onToggleRecent,
}: Props) {
  const [flashing, setFlashing] = useState(false);

  const handleApproveAll = () => {
    onApproveAll();
    setFlashing(true);
    window.setTimeout(() => setFlashing(false), 400);
  };

  const force = useForceOverrides();
  const current = force.get();
  const { config: agentCfg } = useAgentConfig();
  const { config: externalCfg } = useExternalConfig();
  const agentConfigured = agentCfg?.workspace_path != null;
  const externalConfigured = externalCfg?.endpoint_url != null;

  const onChangeForce = (next: DropdownValue) => {
    if (next === "inherit") force.set(null);
    else force.set(next);
  };

  const hasPending = pendingCount > 0;
  const hasSession = activeSessionId !== null;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        boxShadow: "0 -0.5px 0 0 var(--border)",
        padding: "8px 10px",
        display: "flex",
        gap: 10,
        alignItems: "stretch",
      }}
    >
      {/* Left: two rows (OVERRIDE / SESSION), flex-grow */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="caption"
            style={{
              width: 64,
              textAlign: "right",
              color: "var(--text-secondary)",
              flexShrink: 0,
            }}
          >
            OVERRIDE
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PolicyDropdown
              value={forceToDropdown(current)}
              allowInherit
              onChange={onChangeForce}
              labels={FORCE_LABELS}
              ariaLabel="Session force override"
              agentConfigured={agentConfigured}
              externalConfigured={externalConfigured}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: hasSession ? 1 : 0.55,
          }}
        >
          <span
            className="caption"
            style={{
              width: 64,
              textAlign: "right",
              color: hasSession ? "var(--text-secondary)" : "var(--text-muted)",
              flexShrink: 0,
            }}
          >
            SESSION
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PolicySplitButton
              onCommit={onCommitSessionPolicy}
              disabled={!hasSession}
              agentConfigured={agentConfigured}
              externalConfigured={externalConfigured}
            />
          </div>
        </div>
      </div>

      {/* Right: Approve All - stretches to match left column height */}
      <button
        type="button"
        onClick={handleApproveAll}
        disabled={!hasPending}
        className={flashing ? "gold-flash" : undefined}
        aria-label={
          hasPending
            ? `Approve all ${pendingCount} pending`
            : "Approve All (no pending)"
        }
        style={{
          flex: "0 0 88px",
          alignSelf: "stretch",
          minHeight: 54,
          padding: "6px 8px",
          background: hasPending ? "var(--gold)" : "var(--bg-subtle)",
          color: hasPending ? "var(--gold-ink)" : "var(--text-muted)",
          border: hasPending ? "none" : "0.5px solid var(--border)",
          borderRadius: "var(--radius-md)",
          fontFamily: "var(--font-ui)",
          fontWeight: 500,
          cursor: hasPending ? "pointer" : "not-allowed",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          transition: "filter 120ms, background-color 120ms, color 120ms",
          boxShadow: hasPending
            ? "0 0 0 1px var(--gold-line), 0 2px 8px var(--gold-glow)"
            : "none",
        }}
        onMouseEnter={(e) => {
          if (hasPending) e.currentTarget.style.filter = "brightness(1.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "none";
        }}
      >
        <span style={{ fontSize: 12 }}>Approve All</span>
        <span
          className="tabular"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            opacity: hasPending ? 0.72 : 0.6,
          }}
        >
          {hasPending ? `${pendingCount} · ⇧A` : "none"}
        </span>
      </button>

      {/* Recent toggle - center aligned independently */}
      {recentVisible && (
        <button
          type="button"
          onClick={onToggleRecent}
          aria-label={recentCollapsed ? "Expand Recent" : "Collapse Recent"}
          style={{
            flex: "0 0 28px",
            alignSelf: "center",
            width: 28,
            height: 28,
            background: "transparent",
            border: "none",
            borderRadius: 6,
            color: "var(--text-tertiary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Icon name={recentCollapsed ? "chevron-down" : "chevron-up"} size={14} />
        </button>
      )}
    </div>
  );
}
