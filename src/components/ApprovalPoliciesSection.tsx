import { useMemo, useState } from "react";
import { useApprovalPolicies } from "../hooks/useApprovalPolicies";
import { useAgentConfig } from "../hooks/useAgentConfig";
import { useExternalConfig } from "../hooks/useExternalConfig";
import PolicyDropdown, { DropdownValue } from "./ui/PolicyDropdown";
import { resolvePolicy } from "../lib/resolvePolicy";
import ResolverPanel from "./ResolverPanel";
import AgentApproveSection from "./AgentApproveSection";
import ExternalApproveSection from "./ExternalApproveSection";
import SectionCard from "./ui/SectionCard";
import Icon from "./ui/Icon";
import type { PolicyKind, RecentSession } from "../types/events";

const SIMPLE_LABELS = { auto: "Auto", manual: "Manual" };

/** Fixed width for all PolicyDropdown instances in this tab */
const DROPDOWN_STYLE: React.CSSProperties = { width: 160 };

function formatRelative(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function ApprovalPoliciesSection() {
  const {
    policies,
    recent,
    setGlobal,
    setDistro,
    removeDistro,
    setFolder,
    removeFolder,
    setSession,
    removeSession,
    promoteSession,
  } = useApprovalPolicies();
  const { config: agentCfg } = useAgentConfig();
  const { config: externalCfg } = useExternalConfig();
  const agentConfigured = agentCfg?.workspace_path != null;
  const externalConfigured = externalCfg?.endpoint_url != null;

  const onRequestConfigure = (which: "agent" | "external") => {
    const id =
      which === "agent" ? "agent-approve-section" : "external-approve-section";
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const dropdownExtra = {
    agentConfigured,
    externalConfigured,
    onRequestConfigure,
  };

  const distroEntries = useMemo(
    () => Object.entries(policies.per_distro),
    [policies],
  );
  const folderEntries = useMemo(
    () => Object.entries(policies.per_folder),
    [policies],
  );

  const [newDistro, setNewDistro] = useState("");
  const [newFolderPath, setNewFolderPath] = useState("");
  const [newFolderSubdirs, setNewFolderSubdirs] = useState(false);
  const [newFolderKind, setNewFolderKind] = useState<PolicyKind>("auto");
  const [promoting, setPromoting] = useState<string | null>(null);
  const [promoteSubdirs, setPromoteSubdirs] = useState(false);

  const chipFor = (s: RecentSession) => {
    const r = resolvePolicy(policies, {
      sessionId: s.session_id,
      cwd: s.start_cwd_normalized,
      distro: s.distro,
    });
    const winner = r.tiers[r.winnerIndex];
    const tier = winner.tier;
    const kind = winner.kind === "auto" ? "auto" : "manual";
    return `${tier} · ${kind}`;
  };

  const onChangeGlobal = (next: DropdownValue) => {
    if (next === "inherit") return;
    setGlobal(next);
  };

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Resolve Chain */}
      <SectionCard title="Resolve Chain">
        <ResolverPanel policies={policies} recent={recent} />
      </SectionCard>

      {/* Approval Policies */}
      <SectionCard title="Approval Policies">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Global */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="caption" style={{ width: 110, color: "var(--text-secondary)" }}>
              Global
            </span>
            <div style={DROPDOWN_STYLE}>
              <PolicyDropdown
                value={policies.global}
                allowInherit={false}
                onChange={onChangeGlobal}
                labels={SIMPLE_LABELS}
                ariaLabel="Global approval policy"
                {...dropdownExtra}
              />
            </div>
          </div>

          {/* Per distro */}
          <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 8 }}>
            <div className="caption" style={{ color: "var(--text-secondary)", marginBottom: 6 }}>
              Per distribution
            </div>
            {distroEntries.length === 0 && (
              <div style={{ fontSize: "var(--fs-small)", color: "var(--text-tertiary)" }}>
                No distribution rules.
              </div>
            )}
            {distroEntries.map(([distro, rule]) => (
              <div key={distro} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ width: 140, fontSize: "var(--fs-small)", fontFamily: "var(--font-mono)" }}>
                  {distro}
                </span>
                <div style={DROPDOWN_STYLE}>
                  <PolicyDropdown
                    value={rule.kind}
                    allowInherit={false}
                    onChange={(v) => v !== "inherit" && setDistro(distro, v)}
                    labels={SIMPLE_LABELS}
                    {...dropdownExtra}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeDistro(distro)}
                  aria-label={`Remove ${distro}`}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-tertiary)",
                    cursor: "pointer",
                    padding: 2,
                    display: "inline-flex",
                  }}
                >
                  <Icon name="x" size={10} />
                </button>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <input
                placeholder="Distribution name (e.g. Ubuntu)"
                value={newDistro}
                onChange={(e) => setNewDistro(e.target.value)}
                style={{
                  flex: 1,
                  fontSize: "var(--fs-small)",
                  padding: "4px 8px",
                  background: "var(--bg-subtle)",
                  border: "0.5px solid var(--border-strong)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-ui)",
                }}
              />
              <button
                type="button"
                disabled={newDistro.trim() === ""}
                onClick={() => {
                  setDistro(newDistro.trim(), "auto");
                  setNewDistro("");
                }}
                style={{
                  fontSize: "var(--fs-small)",
                  padding: "4px 8px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: newDistro.trim() === "" ? "not-allowed" : "pointer",
                  opacity: newDistro.trim() === "" ? 0.4 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                + Add auto rule
              </button>
            </div>
          </div>

          {/* Per folder */}
          <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 8 }}>
            <div className="caption" style={{ color: "var(--text-secondary)", marginBottom: 6 }}>
              Per folder
            </div>
            {folderEntries.length === 0 && (
              <div style={{ fontSize: "var(--fs-small)", color: "var(--text-tertiary)" }}>
                No folder rules.
              </div>
            )}
            {folderEntries.map(([path, rule]) => (
              <div key={path} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{
                  flex: 1,
                  fontSize: "var(--fs-small)",
                  fontFamily: "var(--font-mono)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {path}
                </span>
                <div style={DROPDOWN_STYLE}>
                  <PolicyDropdown
                    value={rule.kind}
                    allowInherit={false}
                    onChange={(v) =>
                      v !== "inherit" && setFolder(path, v, rule.include_subdirectories)
                    }
                    labels={SIMPLE_LABELS}
                    {...dropdownExtra}
                  />
                </div>
                <label style={{
                  fontSize: "var(--fs-caption)",
                  color: "var(--text-tertiary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  whiteSpace: "nowrap",
                }}>
                  <input
                    type="checkbox"
                    checked={rule.include_subdirectories}
                    onChange={(e) =>
                      setFolder(path, rule.kind, e.target.checked)
                    }
                  />
                  subdir
                </label>
                <button
                  type="button"
                  onClick={() => removeFolder(path)}
                  aria-label={`Remove ${path}`}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-tertiary)",
                    cursor: "pointer",
                    padding: 2,
                    display: "inline-flex",
                  }}
                >
                  <Icon name="x" size={10} />
                </button>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <input
                placeholder="Folder path (Windows or WSL)"
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                style={{
                  flex: 1,
                  fontSize: "var(--fs-small)",
                  padding: "4px 8px",
                  background: "var(--bg-subtle)",
                  border: "0.5px solid var(--border-strong)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-ui)",
                }}
              />
              <label style={{
                fontSize: "var(--fs-caption)",
                color: "var(--text-tertiary)",
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                whiteSpace: "nowrap",
              }}>
                <input
                  type="checkbox"
                  checked={newFolderSubdirs}
                  onChange={(e) => setNewFolderSubdirs(e.target.checked)}
                />
                subdir
              </label>
              <div style={DROPDOWN_STYLE}>
                <PolicyDropdown
                  value={newFolderKind}
                  allowInherit={false}
                  onChange={(v) => v !== "inherit" && setNewFolderKind(v)}
                  labels={SIMPLE_LABELS}
                  {...dropdownExtra}
                />
              </div>
              <button
                type="button"
                disabled={newFolderPath.trim() === ""}
                onClick={() => {
                  setFolder(newFolderPath.trim(), newFolderKind, newFolderSubdirs);
                  setNewFolderPath("");
                  setNewFolderSubdirs(false);
                  setNewFolderKind("auto");
                }}
                style={{
                  fontSize: "var(--fs-small)",
                  padding: "4px 8px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: newFolderPath.trim() === "" ? "not-allowed" : "pointer",
                  opacity: newFolderPath.trim() === "" ? 0.4 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Recent sessions */}
          <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 8 }}>
            <div className="caption" style={{ color: "var(--text-secondary)", marginBottom: 6 }}>
              Recent sessions ({recent.length})
            </div>
            {recent.length === 0 && (
              <div style={{ fontSize: "var(--fs-small)", color: "var(--text-tertiary)" }}>
                No active sessions seen yet.
              </div>
            )}
            {recent.map((s) => (
              <div key={s.session_id} style={{ marginBottom: 6 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: "var(--fs-small)",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-secondary)",
                    gap: 6,
                  }}
                  title={`${s.session_id} · ${s.start_cwd_normalized}`}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.session_id.slice(0, 14)}… {s.distro} · {s.start_cwd_normalized} ·{" "}
                    {formatRelative(s.last_seen_at_ms)}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--fs-caption)",
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: "rgba(245, 158, 11, 0.10)",
                      color: "var(--cat-permission)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {chipFor(s)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <div style={DROPDOWN_STYLE}>
                    <PolicyDropdown
                      value={s.rule_kind ?? "inherit"}
                      allowInherit
                      onChange={(v) => {
                        if (v === "inherit") {
                          removeSession(s.session_id);
                        } else {
                          setSession(s.session_id, v);
                        }
                      }}
                      {...dropdownExtra}
                    />
                  </div>
                  {s.rule_kind !== null && (
                    <button
                      type="button"
                      onClick={() => setPromoting(s.session_id)}
                      style={{
                        fontSize: "var(--fs-small)",
                        color: "var(--text-tertiary)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Promote to folder…
                    </button>
                  )}
                  {promoting === s.session_id && (
                    <span style={{ fontSize: "var(--fs-small)", color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <input
                          type="checkbox"
                          checked={promoteSubdirs}
                          onChange={(e) => setPromoteSubdirs(e.target.checked)}
                        />
                        subdir
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          await promoteSession(s.session_id, promoteSubdirs);
                          setPromoting(null);
                          setPromoteSubdirs(false);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          fontSize: "var(--fs-small)",
                        }}
                      >
                        confirm
                      </button>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Agent Approve */}
      <SectionCard title="Agent Approve">
        <AgentApproveSection />
      </SectionCard>

      {/* External Approve */}
      <SectionCard title="External Approve">
        <ExternalApproveSection />
      </SectionCard>
    </div>
  );
}
