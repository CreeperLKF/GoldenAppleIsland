import { useEffect, useState } from "react";
import type { DelegationKind } from "../types/events";
import { categorize, badgeClass } from "../types/events";

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
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function middleEllipsis(s: string, max: number): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(s.length - half)}`;
}

function describeInput(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (typeof obj.command === "string") {
      const cmd = obj.command;
      return cmd.length > 60 ? `${cmd.slice(0, 60)}…` : cmd;
    }
    if (typeof obj.file_path === "string") return obj.file_path;
    if (typeof obj.path === "string") return obj.path;
  }
  try {
    const s = JSON.stringify(input);
    if (s === "null") return "";
    return s.length > 60 ? `${s.slice(0, 60)}…` : s;
  } catch {
    return "";
  }
}

export default function DelegatedCard({ state, onTakeOver }: DelegatedCardProps) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const category = categorize(state.tool_name);
  const elapsed = formatElapsed(tick - state.started_at_ms);
  const label =
    state.kind === "agent" ? "Agent deciding…" : "External deciding…";
  const rawBody = describeInput(state.tool_input);
  const body = rawBody || state.tool_name || "(in flight — details unavailable)";
  const cwdDisplay = middleEllipsis(state.session_cwd || "", 35);

  return (
    <article
      className="card-enter overflow-hidden bg-[var(--bg-surface)]"
      style={{
        borderRadius: 6,
        border: "0.5px solid var(--border)",
        marginLeft: 8,
        marginRight: 8,
        marginTop: 6,
        marginBottom: 6,
        opacity: 0.7,
      }}
    >
      <div style={{ padding: "10px 12px" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: 6 }}>
            <span
              className={`inline-flex items-center rounded font-semibold ${badgeClass(category)}`}
              style={{
                height: 20,
                padding: "2px 8px",
                fontSize: 11,
                borderRadius: 4,
              }}
            >
              {category}
            </span>
            <span
              className="text-[var(--text-secondary)] inline-flex items-center"
              style={{ fontSize: 11, gap: 4 }}
            >
              <span className="spin" aria-hidden>
                ⟳
              </span>
              {label}
            </span>
          </div>
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: 11 }}>
            {elapsed}
          </span>
        </div>

        <div
          className="mono text-[var(--text-primary)] mt-2 break-all"
          style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}
        >
          {body}
        </div>

        <div
          className="text-[var(--text-secondary)] mt-1 truncate"
          style={{ fontSize: 12 }}
          title={`${state.session_cwd} · ${state.source_distro}`}
        >
          {cwdDisplay} · {state.source_distro}
        </div>

        <div
          className="flex items-center justify-end"
          style={{ marginTop: 8 }}
        >
          <button
            type="button"
            onClick={() => onTakeOver(state.event_id)}
            className="text-[var(--text-primary)]"
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 4,
              border: "0.5px solid var(--border)",
              background: "transparent",
            }}
          >
            Take over
          </button>
        </div>
      </div>
    </article>
  );
}
