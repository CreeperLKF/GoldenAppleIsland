import { useEffect, useState } from "react";
import type { HistoryEntry } from "../hooks/useHistory";

interface HistoryListProps {
  items: HistoryEntry[];
}

function formatAgo(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const secs = Math.max(0, Math.round((now - t) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function statusGlyph(action: HistoryEntry["action"]): {
  glyph: string;
  color: string;
} {
  if (action === "approve") return { glyph: "✓", color: "var(--approve-text)" };
  if (action === "deny") return { glyph: "✗", color: "var(--deny-text)" };
  return { glyph: "◷", color: "var(--text-tertiary)" };
}

export default function HistoryList({ items }: HistoryListProps) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (items.length === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;

  const limit = expanded ? 20 : 5;
  const visible = items.slice(0, limit);
  const hasMore = items.length > 5;

  return (
    <section
      className="px-3 py-2 bg-[var(--bg-surface)]"
      style={{ borderTop: "0.5px solid var(--border)" }}
      aria-label="Recent decisions"
    >
      <div
        className="font-semibold text-[var(--text-primary)]"
        style={{ fontSize: 12, marginBottom: 4 }}
      >
        Recent
      </div>
      <ul className="flex flex-col" style={{ gap: 0 }}>
        {visible.map((item) => {
          const { glyph, color } = statusGlyph(item.action);
          return (
            <li
              key={item.id}
              className="flex items-center"
              style={{ height: 24, fontSize: 12 }}
            >
              <span
                aria-hidden
                style={{ color, width: 16, display: "inline-block" }}
              >
                {glyph}
              </span>
              <span
                className="text-[var(--text-secondary)] flex-1 truncate"
                style={{ marginRight: 8 }}
              >
                {item.tool_name}: {item.summary}
              </span>
              <span
                className="text-[var(--text-tertiary)]"
                style={{ fontSize: 11 }}
              >
                {formatAgo(item.timestamp, now)}
              </span>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          style={{ fontSize: 11 }}
        >
          {expanded ? "Show less" : `Show more (${items.length - 5})`}
        </button>
      )}
    </section>
  );
}
