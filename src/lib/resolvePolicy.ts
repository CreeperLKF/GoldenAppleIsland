// GoldenAppleIsland/src/lib/resolvePolicy.ts
import type {
  ApprovalPolicies,
  PolicyKind,
  PolicyScope,
} from "../types/events";

export interface TierResult {
  tier: PolicyScope;
  matchedKey: string | null;
  kind: PolicyKind | null;
  includeSubdirectories?: boolean;
}

export interface ResolutionResult {
  tiers: TierResult[]; // order: global, distro, folder, session
  winnerIndex: number; // index into `tiers` of the winning tier
}

interface SessionContext {
  sessionId: string;
  cwd: string;
  distro: string;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function folderMatches(
  folderPath: string,
  includeSubdirectories: boolean,
  cwd: string,
): boolean {
  const f = normalizePath(folderPath);
  const c = normalizePath(cwd);
  if (!f || !c) return false;
  if (f === c) return true;
  if (includeSubdirectories) return c.startsWith(f + "/");
  return false;
}

export function resolvePolicy(
  policies: ApprovalPolicies,
  ctx: SessionContext,
): ResolutionResult {
  // Global
  const globalTier: TierResult = {
    tier: "global",
    matchedKey: "global",
    kind: policies.global,
  };

  // Distro
  const distroRule = ctx.distro ? policies.per_distro[ctx.distro] : undefined;
  const distroTier: TierResult = {
    tier: "distro",
    matchedKey: distroRule ? ctx.distro : null,
    kind: distroRule ? distroRule.kind : null,
  };

  // Folder — longest match wins among entries that match the cwd.
  let folderMatch: { path: string; kind: PolicyKind; includeSub: boolean } | null =
    null;
  for (const [path, rule] of Object.entries(policies.per_folder)) {
    if (folderMatches(path, rule.include_subdirectories, ctx.cwd)) {
      if (!folderMatch || normalizePath(path).length > normalizePath(folderMatch.path).length) {
        folderMatch = {
          path,
          kind: rule.kind,
          includeSub: rule.include_subdirectories,
        };
      }
    }
  }
  const folderTier: TierResult = {
    tier: "folder",
    matchedKey: folderMatch ? folderMatch.path : null,
    kind: folderMatch ? folderMatch.kind : null,
    includeSubdirectories: folderMatch ? folderMatch.includeSub : undefined,
  };

  // Session
  const sessionRule = ctx.sessionId
    ? policies.per_session.find((r) => r.session_id === ctx.sessionId)
    : undefined;
  const sessionTier: TierResult = {
    tier: "session",
    matchedKey: sessionRule ? ctx.sessionId : null,
    kind: sessionRule ? sessionRule.kind : null,
  };

  const tiers = [globalTier, distroTier, folderTier, sessionTier];
  // Winner = most specific tier with a non-null kind. Global is always non-null.
  let winnerIndex = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (tiers[i].kind !== null) {
      winnerIndex = i;
      break;
    }
  }
  return { tiers, winnerIndex };
}
