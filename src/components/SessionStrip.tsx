interface SessionStripProps {
  cwd: string;
  autoApprove?: boolean;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "\u2026";
}

export default function SessionStrip({ cwd, autoApprove = false }: SessionStripProps) {
  const dotColor = autoApprove ? "var(--accent-green)" : "var(--accent-amber)";
  return (
    <div
      className="flex h-7 items-center px-3 gap-2 bg-[var(--bg-surface)]"
      style={{ borderBottom: "0.5px solid var(--border)" }}
    >
      <span
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, background: dotColor }}
        aria-hidden
      />
      <span className="text-[var(--text-secondary)]" style={{ fontSize: 12 }}>
        Session: {truncate(cwd, 35)}
        {autoApprove ? " (auto)" : ""}
      </span>
    </div>
  );
}
