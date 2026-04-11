interface HeaderProps {
  pendingCount: number;
  connected: boolean;
}

export default function Header({ pendingCount, connected }: HeaderProps) {
  const status =
    pendingCount > 0
      ? `${pendingCount} pending`
      : connected
        ? "All clear"
        : "No sessions";

  return (
    <header
      className="flex h-9 items-center justify-between px-3 bg-[var(--bg-surface)]"
      style={{ borderBottom: "0.5px solid var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block rounded-full"
          style={{ width: 8, height: 8, background: "var(--accent-green)" }}
          aria-hidden
        />
        <span
          className="font-semibold text-[var(--text-primary)]"
          style={{ fontSize: 13 }}
        >
          Claude Hook Guard
        </span>
      </div>
      <span className="text-[var(--text-tertiary)]" style={{ fontSize: 11 }}>
        {status}
      </span>
    </header>
  );
}
