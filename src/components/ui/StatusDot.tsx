type Status = "live" | "idle" | "offline" | "approved" | "denied" | "auto";

const STYLE: Record<Status, { bg: string; pulse?: boolean }> = {
  live:     { bg: "var(--gold)",        pulse: true },
  idle:     { bg: "var(--text-tertiary)" },
  offline:  { bg: "var(--text-muted)" },
  approved: { bg: "var(--sem-approve)" },
  denied:   { bg: "var(--sem-deny)" },
  auto:     { bg: "var(--gold-lo)" },
};

export default function StatusDot({ status, size = 8 }: { status: Status; size?: number }) {
  const s = STYLE[status];
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size, height: size,
        borderRadius: "50%",
        background: s.bg,
        boxShadow: s.pulse
          ? `0 0 0 0 ${s.bg}`
          : "none",
        animation: s.pulse ? "dot-pulse 2.5s ease-in-out infinite" : undefined,
      }}
    />
  );
}
