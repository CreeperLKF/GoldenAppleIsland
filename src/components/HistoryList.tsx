export default function HistoryList() {
  return (
    <section
      className="px-3 py-2 text-[var(--text-secondary)]"
      style={{ borderTop: "0.5px solid var(--border)", fontSize: 12 }}
      aria-label="Recent decisions"
    >
      <div className="font-semibold text-[var(--text-primary)]" style={{ fontSize: 12 }}>
        Recent
      </div>
    </section>
  );
}
