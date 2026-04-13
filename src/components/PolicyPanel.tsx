import type { HookEvent, PolicyKind, PolicyScope } from "../types/events";
import PolicyDropdown, { DropdownValue } from "./ui/PolicyDropdown";

interface Resolved {
  kind: PolicyKind;
  scope: PolicyScope;
}

interface Props {
  topEvent: HookEvent | null;
  topResolved: Resolved | null;
  sessionOverride: PolicyKind | null;
  pendingCount: number;
  onChangePolicy: (next: DropdownValue) => void;
  onApproveAll: () => void;
}

function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s;
  const keep = Math.max(4, Math.floor((max - 1) / 2));
  return `${s.slice(0, keep)}…${s.slice(s.length - keep)}`;
}

function labelFromOverride(o: PolicyKind | null): DropdownValue {
  if (o === null) return "inherit";
  return o;
}

function effectiveLabel(r: Resolved | null): string {
  if (!r) return "";
  const kind = r.kind === "auto" ? "Auto" : "Manual";
  return `${kind} (${r.scope})`;
}

export default function PolicyPanel({
  topEvent,
  topResolved,
  sessionOverride,
  pendingCount,
  onChangePolicy,
  onApproveAll,
}: Props) {
  // Info bar is intentionally hidden for now — the code below is kept so we
  // can re-enable it (or swap it for a different presentation) without
  // reconstructing the session/path/effective-label layout from scratch.
  // Flip SHOW_INFO_BAR to true to bring it back.
  const SHOW_INFO_BAR = false;
  const sessShort = topEvent ? truncateMiddle(topEvent.session_id, 14) : "";
  const pathShort = topEvent
    ? truncateMiddle(topEvent.session_cwd || "—", 42)
    : "";

  return (
    <div
      className="flex flex-col bg-[var(--bg-surface)]"
      style={{ borderTop: "0.5px solid var(--border)" }}
    >
      {/* Info bar — preserved intentionally; gated by SHOW_INFO_BAR = false. */}
      {SHOW_INFO_BAR && topEvent && (
        <div
          className="flex items-center px-2"
          style={{
            height: 20,
            fontSize: 11,
            color: "var(--text-tertiary)",
            gap: 8,
          }}
        >
          <span
            title={topEvent.session_id}
            style={{
              flexShrink: 0,
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {sessShort}
          </span>
          <span
            title={topEvent.session_cwd}
            className="flex-1 truncate"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {pathShort}
          </span>
          <span style={{ flexShrink: 0, color: "var(--text-secondary)" }}>
            {effectiveLabel(topResolved)}
          </span>
        </div>
      )}

      {/* Action bar — always visible so the dropdown is reachable */}
      <div
        className="flex items-center px-2"
        style={{
          height: 36,
          gap: 8,
        }}
      >
        <div style={{ flex: "1.4 1 0" }}>
          <PolicyDropdown
            value={labelFromOverride(sessionOverride)}
            allowInherit
            onChange={onChangePolicy}
            ariaLabel="Session policy override"
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
