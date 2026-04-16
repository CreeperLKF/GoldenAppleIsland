import type { ApprovalPolicies, RecentSession } from "../types/events";
import { resolvePolicy, type TierResult } from "../lib/resolvePolicy";
import Icon from "./ui/Icon";
import { middleEllipsis } from "../lib/format";

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

function formatResult(t: TierResult): string {
  const tierLabel = TIER_LABEL_TITLE[t.tier];
  const kindLabel = t.kind === "auto" ? "Auto" : t.kind === "manual" ? "Manual" : "—";
  if (t.tier === "global") {
    return `→ Global default → ${kindLabel}`;
  }
  const key = t.matchedKey
    ? t.tier === "session"
      ? middleEllipsis(t.matchedKey, 14)
      : middleEllipsis(t.matchedKey, 32)
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
        background: "var(--bg-subtle)",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-mono-xs)",
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Breadcrumb chain */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        {CHAIN.map((tier, i) => {
          const isWinner = tier === winnerTier;
          return (
            <span key={tier} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span
                style={
                  isWinner
                    ? {
                        background: "var(--gold)",
                        color: "var(--gold-ink)",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 4,
                      }
                    : {
                        background: "transparent",
                        color: "var(--text-tertiary)",
                      }
                }
              >
                {TIER_LABEL[tier]}
              </span>
              {i < CHAIN.length - 1 && (
                <Icon name="chevron-right" size={10} style={{ color: "var(--text-muted)" }} />
              )}
            </span>
          );
        })}
        {result && (
          <span style={{ marginLeft: "auto", color: "var(--text-secondary)" }}>
            {result.tiers[result.winnerIndex]?.kind === "auto" ? "→ Auto" : "→ Manual"}
          </span>
        )}
      </div>

      {session && result ? (
        <>
          <div
            style={{ color: "var(--text-tertiary)" }}
            title={`${session.session_id} · ${session.start_cwd_normalized}`}
          >
            last session:&nbsp;&nbsp;
            {middleEllipsis(session.session_id, 14)} ·{" "}
            {middleEllipsis(session.start_cwd_normalized, 32)} · {session.distro}
          </div>
          <div style={{ color: "var(--text-primary)" }}>
            {formatResult(result.tiers[result.winnerIndex])}
          </div>
        </>
      ) : (
        <div style={{ color: "var(--text-tertiary)" }}>
          No sessions seen yet — the resolver will show which tier wins once an
          event arrives.
        </div>
      )}
    </div>
  );
}
