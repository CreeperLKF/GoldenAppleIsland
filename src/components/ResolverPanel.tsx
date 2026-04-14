import type { ApprovalPolicies, RecentSession } from "../types/events";
import { resolvePolicy, type TierResult } from "../lib/resolvePolicy";

interface Props {
  policies: ApprovalPolicies;
  recent: RecentSession[];
}

const CHAIN: Array<TierResult["tier"]> = [
  "global",
  "distro",
  "folder",
  "session",
];

const TIER_LABEL: Record<TierResult["tier"], string> = {
  global: "global",
  distro: "distribution",
  folder: "folder",
  session: "session",
};

const TIER_LABEL_TITLE: Record<TierResult["tier"], string> = {
  global: "Global",
  distro: "Distribution",
  folder: "Folder",
  session: "Session",
};

function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s;
  const keep = Math.max(4, Math.floor((max - 1) / 2));
  return `${s.slice(0, keep)}…${s.slice(s.length - keep)}`;
}

function formatResult(t: TierResult): string {
  const tierLabel = TIER_LABEL_TITLE[t.tier];
  const kindLabel = t.kind === "auto" ? "Auto" : t.kind === "manual" ? "Manual" : "—";
  if (t.tier === "global") {
    return `→ Global default → ${kindLabel}`;
  }
  const key = t.matchedKey
    ? t.tier === "session"
      ? truncateMiddle(t.matchedKey, 14)
      : truncateMiddle(t.matchedKey, 32)
    : "—";
  const suffix =
    t.tier === "folder" && t.includeSubdirectories ? " (includes subdirs)" : "";
  return `→ ${tierLabel} matched ${key} → ${kindLabel}${suffix}`;
}

export default function ResolverPanel({ policies, recent }: Props) {
  const session = recent[0] ?? null;

  const result = session
    ? resolvePolicy(policies, {
        sessionId: session.session_id,
        cwd: session.start_cwd_normalized,
        distro: session.distro,
      })
    : null;

  const winnerTier = result ? result.tiers[result.winnerIndex]?.tier ?? null : null;

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
        session 的策略配置按解析链依次覆盖
      </div>

      <div
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 4,
          marginTop: 2,
        }}
      >
        <span style={{ color: "var(--text-tertiary)" }}>resolve chain:&nbsp;</span>
        {CHAIN.map((tier, i) => {
          const isWinner = tier === winnerTier;
          return (
            <span key={tier} style={{ display: "inline-flex", alignItems: "center" }}>
              <span
                style={
                  isWinner
                    ? {
                        color: "var(--text-primary)",
                        fontWeight: 600,
                        background: "var(--badge-permission-bg)",
                        padding: "0 4px",
                        borderRadius: 3,
                      }
                    : {
                        color: "var(--text-tertiary)",
                      }
                }
              >
                {TIER_LABEL[tier]}
              </span>
              {i < CHAIN.length - 1 && (
                <span style={{ color: "var(--text-tertiary)", margin: "0 4px" }}>
                  ▸
                </span>
              )}
            </span>
          );
        })}
      </div>

      {session && result ? (
        <>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              color: "var(--text-tertiary)",
            }}
            title={`${session.session_id} · ${session.start_cwd_normalized}`}
          >
            last session:&nbsp;&nbsp;
            {truncateMiddle(session.session_id, 14)} ·{" "}
            {truncateMiddle(session.start_cwd_normalized, 32)} · {session.distro}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-primary)",
              marginTop: 2,
            }}
          >
            {formatResult(result.tiers[result.winnerIndex])}
          </div>
        </>
      ) : (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            padding: "2px 0",
          }}
        >
          No sessions seen yet — the resolver will show which tier wins once an
          event arrives.
        </div>
      )}
    </div>
  );
}
