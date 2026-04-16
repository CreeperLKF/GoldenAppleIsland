interface EmptyStateProps {
  connected: boolean;
}

export default function EmptyState({ connected }: EmptyStateProps) {
  const { main, sub } = connected
    ? { main: "All caught up",      sub: "Waiting for the next tool call…" }
    : { main: "No active sessions", sub: "Start Claude Code in WSL to begin" };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px 16px",
        gap: 4,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "var(--fs-body)", color: "var(--text-secondary)" }}>
        {main}
      </div>
      <div style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)" }}>
        {sub}
      </div>
    </div>
  );
}
