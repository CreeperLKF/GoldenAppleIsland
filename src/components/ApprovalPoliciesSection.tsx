import { useMemo, useState } from "react";
import { useApprovalPolicies } from "../hooks/useApprovalPolicies";
import PolicyDropdown, { DropdownValue } from "./ui/PolicyDropdown";
import { resolvePolicy } from "../lib/resolvePolicy";
import ResolverPanel from "./ResolverPanel";
import type { PolicyKind, RecentSession } from "../types/events";

const SIMPLE_LABELS = { auto: "Auto", manual: "Manual" };

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
    <section style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      <ResolverPanel policies={policies} recent={recent} />
      <div className="font-semibold text-[var(--text-primary)]" style={{ fontSize: 12 }}>
        Approval policies
      </div>

      {/* Global */}
      <div className="flex items-center" style={{ gap: 8 }}>
        <span style={{ width: 110, fontSize: 12, color: "var(--text-secondary)" }}>
          Global
        </span>
        <PolicyDropdown
          value={policies.global}
          allowInherit={false}
          onChange={onChangeGlobal}
          labels={SIMPLE_LABELS}
          ariaLabel="Global approval policy"
        />
      </div>

      {/* Per distro */}
      <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
          Per distribution
        </div>
        {distroEntries.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            No distribution rules.
          </div>
        )}
        {distroEntries.map(([distro, rule]) => (
          <div key={distro} className="flex items-center" style={{ gap: 8, marginBottom: 4 }}>
            <span style={{ width: 140, fontSize: 12 }}>{distro}</span>
            <PolicyDropdown
              value={rule.kind}
              allowInherit={false}
              onChange={(v) => v !== "inherit" && setDistro(distro, v)}
              labels={SIMPLE_LABELS}
            />
            <button
              type="button"
              onClick={() => removeDistro(distro)}
              aria-label={`Remove ${distro}`}
              style={{ fontSize: 12, color: "var(--text-tertiary)" }}
            >
              ×
            </button>
          </div>
        ))}
        <div className="flex items-center" style={{ gap: 8, marginTop: 4 }}>
          <input
            placeholder="Distribution name (e.g. Ubuntu)"
            value={newDistro}
            onChange={(e) => setNewDistro(e.target.value)}
            style={{
              flex: 1,
              fontSize: 12,
              padding: "2px 6px",
              background: "var(--bg-surface)",
              border: "0.5px solid var(--border)",
              borderRadius: 3,
              color: "var(--text-primary)",
            }}
          />
          <button
            type="button"
            disabled={newDistro.trim() === ""}
            onClick={() => {
              setDistro(newDistro.trim(), "auto");
              setNewDistro("");
            }}
            style={{ fontSize: 12, padding: "2px 8px" }}
          >
            + Add auto rule
          </button>
        </div>
      </div>

      {/* Per folder */}
      <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
          Per folder
        </div>
        {folderEntries.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            No folder rules.
          </div>
        )}
        {folderEntries.map(([path, rule]) => (
          <div key={path} className="flex items-center" style={{ gap: 8, marginBottom: 4 }}>
            <span style={{ flex: 1, fontSize: 11, fontFamily: "monospace" }}>{path}</span>
            <PolicyDropdown
              value={rule.kind}
              allowInherit={false}
              onChange={(v) =>
                v !== "inherit" && setFolder(path, v, rule.include_subdirectories)
              }
              labels={SIMPLE_LABELS}
            />
            <label style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              <input
                type="checkbox"
                checked={rule.include_subdirectories}
                onChange={(e) =>
                  setFolder(path, rule.kind, e.target.checked)
                }
              />{" "}
              subfolders
            </label>
            <button
              type="button"
              onClick={() => removeFolder(path)}
              aria-label={`Remove ${path}`}
              style={{ fontSize: 12, color: "var(--text-tertiary)" }}
            >
              ×
            </button>
          </div>
        ))}
        <div className="flex items-center" style={{ gap: 8, marginTop: 4 }}>
          <input
            placeholder="Folder path (Windows or WSL)"
            value={newFolderPath}
            onChange={(e) => setNewFolderPath(e.target.value)}
            style={{
              flex: 1,
              fontSize: 12,
              padding: "2px 6px",
              background: "var(--bg-surface)",
              border: "0.5px solid var(--border)",
              borderRadius: 3,
              color: "var(--text-primary)",
            }}
          />
          <label style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            <input
              type="checkbox"
              checked={newFolderSubdirs}
              onChange={(e) => setNewFolderSubdirs(e.target.checked)}
            />{" "}
            subdirs
          </label>
          <PolicyDropdown
            value={newFolderKind}
            allowInherit={false}
            onChange={(v) => v !== "inherit" && setNewFolderKind(v)}
            labels={SIMPLE_LABELS}
          />
          <button
            type="button"
            disabled={newFolderPath.trim() === ""}
            onClick={() => {
              setFolder(newFolderPath.trim(), newFolderKind, newFolderSubdirs);
              setNewFolderPath("");
              setNewFolderSubdirs(false);
              setNewFolderKind("auto");
            }}
            style={{ fontSize: 12, padding: "2px 8px" }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Recent sessions */}
      <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
          Recent sessions ({recent.length})
        </div>
        {recent.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            No active sessions seen yet.
          </div>
        )}
        {recent.map((s) => (
          <div key={s.session_id} style={{ marginBottom: 6 }}>
            <div
              className="flex items-center"
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "var(--text-secondary)",
                gap: 6,
              }}
              title={`${s.session_id} · ${s.start_cwd_normalized}`}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.session_id.slice(0, 14)}… {s.distro} · {s.start_cwd_normalized} ·{" "}
                {formatRelative(s.last_seen_at_ms)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: "var(--badge-permission-bg)",
                  color: "var(--badge-permission-text)",
                  whiteSpace: "nowrap",
                }}
              >
                {chipFor(s)}
              </span>
            </div>
            <div className="flex items-center" style={{ gap: 8, marginTop: 2 }}>
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
              />
              {s.rule_kind !== null && (
                <button
                  type="button"
                  onClick={() => setPromoting(s.session_id)}
                  style={{ fontSize: 11, color: "var(--text-tertiary)" }}
                >
                  Promote to folder…
                </button>
              )}
              {promoting === s.session_id && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={promoteSubdirs}
                      onChange={(e) => setPromoteSubdirs(e.target.checked)}
                    />{" "}
                    subdirs
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      await promoteSession(s.session_id, promoteSubdirs);
                      setPromoting(null);
                      setPromoteSubdirs(false);
                    }}
                    style={{ marginLeft: 6 }}
                  >
                    confirm
                  </button>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
