interface EmptyStateProps {
  connected: boolean;
}

export default function EmptyState({ connected }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-[var(--text-tertiary)]"
      style={{ padding: "24px 16px", gap: 6, fontSize: 13 }}
    >
      {connected ? (
        <div>All caught up</div>
      ) : (
        <>
          <div>No active sessions</div>
          <div>Start Claude Code in WSL to begin</div>
        </>
      )}
    </div>
  );
}
