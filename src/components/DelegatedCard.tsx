import { useEffect, useState } from "react";
import type { DelegationKind } from "../types/events";
import { categorize } from "../types/events";
import CategoryTag, { categoryVeinColor } from "./ui/CategoryTag";
import Icon from "./ui/Icon";
import { middleEllipsis } from "../lib/format";

interface DelegatedCardProps {
  state: {
    event_id: string;
    kind: DelegationKind;
    started_at_ms: number;
    tool_name: string;
    session_cwd: string;
    source_distro: string;
    tool_input: unknown;
  };
  onTakeOver: (event_id: string) => void;
}

function formatElapsed(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function describeInput(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "object") {
    const o = input as Record<string, unknown>;
    if (typeof o.command === "string") {
      return o.command.length > 60 ? `${o.command.slice(0, 60)}…` : o.command;
    }
    if (typeof o.file_path === "string") return o.file_path;
    if (typeof o.path === "string") return o.path;
  }
  try {
    const s = JSON.stringify(input);
    if (s === "null") return "";
    return s.length > 60 ? `${s.slice(0, 60)}…` : s;
  } catch { return ""; }
}

export default function DelegatedCard({ state, onTakeOver }: DelegatedCardProps) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const category = categorize(state.tool_name);
  const elapsed = formatElapsed(tick - state.started_at_ms);
  const veinColor = categoryVeinColor(category);
  const body = describeInput(state.tool_input) || state.tool_name || "(in flight)";

  return (
    <article
      className="card-enter"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border)",
        borderRadius: "var(--radius-md)",
        borderLeft: `3px solid ${veinColor}`,
        marginLeft: 10, marginRight: 10, marginTop: 8,
        overflow: "hidden",
        opacity: 0.82,
      }}
    >
      <div style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CategoryTag category={category} />
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: "var(--fs-small)",
              color: "var(--gold)",
              fontFamily: "var(--font-ui)",
            }}>
              <Icon name="loader" size={10} className="spin" />
              {state.kind === "agent" ? "Agent deciding" : "External deciding"}
            </span>
          </div>
          <span
            className="tabular"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-mono-xs)",
              color: "var(--text-tertiary)",
            }}
          >
            {elapsed}
          </span>
        </div>

        <div
          className="mono"
          style={{
            fontSize: "var(--fs-mono)",
            lineHeight: "var(--lh-mono)",
            color: "var(--text-primary)",
            wordBreak: "break-all",
          }}
        >
          {body}
        </div>

        <div
          className="mono"
          style={{
            marginTop: 6,
            fontSize: "var(--fs-mono-sm)",
            color: "var(--text-tertiary)",
          }}
        >
          {middleEllipsis(state.session_cwd, 36)} · {state.source_distro}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            onClick={() => onTakeOver(state.event_id)}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "var(--fs-small)",
              color: "var(--text-secondary)",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              textDecorationColor: "var(--gold-line)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--gold)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            Take over
          </button>
        </div>
      </div>
    </article>
  );
}
