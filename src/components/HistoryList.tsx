import { useEffect, useState } from "react";
import type { HistoryEntry } from "../hooks/useHistory";
import { formatAgo } from "../lib/format";

interface HistoryListProps {
  items: HistoryEntry[];
  collapsed: boolean;
}

function veinColor(item: HistoryEntry): string {
  if (item.answer) return "var(--sem-violet)";
  if (item.action === "approve" && item.source === "auto") return "var(--gold-lo)";
  if (item.action === "approve" && item.source === "agent") return "var(--sem-violet)";
  if (item.action === "approve" && item.source === "external") return "var(--sem-info)";
  if (item.action === "approve") return "var(--gold)";
  if (item.action === "deny") return "var(--sem-deny)";
  return "var(--text-muted)";
}

function sourceLabel(item: HistoryEntry): string | null {
  if (item.source === "auto") return "auto";
  if (item.source === "agent") return "agent";
  if (item.source === "external") return "ext";
  return null;
}

export default function HistoryList({ items, collapsed }: HistoryListProps) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (items.length === 0 || collapsed) return;
    const id = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(id);
  }, [items.length, collapsed]);

  if (items.length === 0) return null;

  if (collapsed) {
    return (
      <section
        style={{
          padding: "6px 12px",
          background: "var(--bg-surface)",
          boxShadow: "0 0.5px 0 0 var(--border)",
        }}
      >
        <div className="caption" style={{ color: "var(--text-tertiary)" }}>
          RECENT · {items.length}
        </div>
      </section>
    );
  }

  const visible = expanded ? items : items.slice(0, 5);
  const hasMore = items.length > 5;

  return (
    <section
      style={{
        padding: "8px 12px 6px",
        background: "var(--bg-surface)",
        boxShadow: "0 0.5px 0 0 var(--border)",
      }}
    >
      <div className="caption" style={{ color: "var(--text-tertiary)", marginBottom: 6 }}>
        RECENT
      </div>
      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          listStyle: "none",
          margin: 0,
          padding: 0,
          maxHeight: expanded ? 280 : "none",
          overflowY: expanded ? "auto" : "visible",
        }}
      >
        {visible.map((item) => {
          const tag = sourceLabel(item);
          return (
            <li
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2px 1fr auto auto",
                alignItems: "center",
                gap: 8,
                height: 22,
                padding: "0 0 0 4px",
                position: "relative",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 2, height: 12,
                  background: veinColor(item),
                  borderRadius: 1,
                }}
              />
              <span
                style={{
                  fontSize: "var(--fs-small)",
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>
                  {item.tool_name}
                </span>
                <span style={{ margin: "0 6px", color: "var(--text-muted)" }}>·</span>
                {item.summary}
              </span>
              {tag && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontStyle: "italic",
                    color: "var(--text-muted)",
                  }}
                  title={item.reason ?? undefined}
                >
                  {tag}
                </span>
              )}
              <span
                className="tabular"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--text-tertiary)",
                  minWidth: 28,
                  textAlign: "right",
                }}
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
          style={{
            marginTop: 4,
            background: "transparent",
            border: "none",
            padding: "2px 0",
            fontSize: 10,
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
          }}
        >
          {expanded ? "− collapse" : `+ show ${items.length - 5} more`}
        </button>
      )}
    </section>
  );
}
