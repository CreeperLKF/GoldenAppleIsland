/** Relative time display: "now", "5s", "3m", "2h" */
export function formatAgo(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "just now";
  const secs = Math.max(0, Math.round((now - t) / 1000));
  if (secs < 2) return "now";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}

/** Truncate with middle ellipsis: "abcde…vwxyz" */
export function middleEllipsis(s: string, max: number): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(s.length - half)}`;
}
