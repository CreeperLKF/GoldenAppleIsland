import type { ApprovalPolicies, RecentSession } from "../types/events";
import { resolvePolicy, type TierResult } from "../lib/resolvePolicy";

interface Props {
  policies: ApprovalPolicies;
  recent: RecentSession[];
}

function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s;
  const keep = Math.max(4, Math.floor((max - 1) / 2));
  return `${s.slice(0, keep)}…${s.slice(s.length - keep)}`;
}

const TIER_LABEL: Record<string, string> = {
  global: "Global",
  distro: "Distribution",
  folder: "Folder",
  session: "Session",
};

function tierDisplay(t: TierResult): {
  label: string;
  key: string;
  kind: string;
  suffix: string;
} {
  const label = TIER_LABEL[t.tier] ?? t.tier;
  let key = "—";
  if (t.matchedKey) {
    key = t.tier === "session"
      ? truncateMiddle(t.matchedKey, 14)
      : truncateMiddle(t.matchedKey, 28);
  }
  const kind = t.kind
    ? t.kind === "auto"
      ? "Auto"
      : "Manual"
    : "—";
  const suffix =
    t.tier === "folder" && t.kind && t.includeSubdirectories
      ? " (subdirs)"
      : "";
  return { label, key, kind, suffix };
}

export default function ResolverPanel({ policies, recent }: Props) {
  const session = recent[0] ?? null;

  return (
    <div
      style={{
        border: "0.5px solid var(--border)",
        borderRadius: 4,
        padding: "8px 10px",
        margin: "0 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        className="font-semibold text-[var(--text-primary)]"
        style={{ fontSize: 12 }}
      >
        How policies resolve
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
        More specific tiers override less specific ones — the first match wins,
        top to bottom.
      </div>

      {session === null ? (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            padding: "6px 0",
          }}
        >
          No sessions seen yet — the resolver will show the winning tier once
          an event arrives.
        </div>
      ) : (
        <>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              fontFamily: "monospace",
            }}
            title={`${session.session_id} · ${session.start_cwd_normalized}`}
          >
            Session: {truncateMiddle(session.session_id, 14)} ·{" "}
            {truncateMiddle(session.start_cwd_normalized, 32)} ·{" "}
            {session.distro}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {(() => {
              const result = resolvePolicy(policies, {
                sessionId: session.session_id,
                cwd: session.start_cwd_normalized,
                distro: session.distro,
              });
              return result.tiers.map((t, i) => {
                const d = tierDisplay(t);
                const isWinner = i === result.winnerIndex;
                return (
                  <div
                    key={t.tier}
                    className="flex items-center"
                    style={{
                      gap: 8,
                      fontSize: 11,
                      paddingLeft: 6,
                      borderLeft: isWinner
                        ? "2px solid var(--accent, #4aa)"
                        : "2px solid transparent",
                      color: isWinner
                        ? "var(--text-primary)"
                        : "var(--text-tertiary)",
                      fontWeight: isWinner ? 600 : 400,
                    }}
                  >
                    <span style={{ width: 86 }}>{d.label}</span>
                    <span
                      style={{
                        flex: 1,
                        fontFamily: "monospace",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={t.matchedKey ?? ""}
                    >
                      {d.key}
                    </span>
                    <span style={{ width: 70 }}>
                      {d.kind}
                      {d.suffix}
                    </span>
                    <span style={{ width: 60, textAlign: "right" }}>
                      {isWinner ? "✓ WINNER" : "·"}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}
    </div>
  );
}
