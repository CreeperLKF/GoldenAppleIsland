import { useEffect, useRef } from "react";
import type { CustomHookSet } from "../types/modes";

interface Props {
  value: CustomHookSet;
  onChange: (next: CustomHookSet) => void;
  onClose: () => void;
}

type Row = { key: keyof CustomHookSet; label: string };

const CONTROL_ROWS: Row[] = [
  { key: "permission_request", label: "PermissionRequest" },
];

const AUDIT_ROWS: Row[] = [
  { key: "pre_tool_use", label: "PreToolUse" },
];

const OBSERVE_ROWS: Row[] = [
  { key: "user_prompt_submit", label: "UserPromptSubmit" },
  { key: "post_tool_use", label: "PostToolUse" },
  { key: "notification", label: "Notification" },
  { key: "stop", label: "Stop" },
  { key: "subagent_stop", label: "SubagentStop" },
  { key: "pre_compact", label: "PreCompact" },
  { key: "session_start", label: "SessionStart" },
  { key: "session_end", label: "SessionEnd" },
];

function allChecked(value: CustomHookSet, rows: Row[]): boolean {
  return rows.every((r) => value[r.key]);
}

export default function CustomModePopover({ value, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const toggle = (key: keyof CustomHookSet) => {
    onChange({ ...value, [key]: !value[key] });
  };

  const section = (title: string, rows: Row[]) => {
    const tierActive = allChecked(value, rows);
    return (
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: tierActive ? 700 : 500,
            color: "var(--text-secondary)",
          }}
        >
          {title} {tierActive && "(coverage)"}
        </div>
        <div style={{ marginLeft: 16 }}>
          {rows.map((r) => (
            <label
              key={r.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                padding: "2px 0",
              }}
            >
              <input
                type="checkbox"
                checked={value[r.key]}
                onChange={() => toggle(r.key)}
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={ref}
      role="dialog"
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        zIndex: 20,
        background: "var(--bg-elevated)",
        border: "0.5px solid var(--border)",
        borderRadius: 6,
        padding: "8px 12px",
        minWidth: 220,
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      {section("Control tier", CONTROL_ROWS)}
      {section("Audit tier (adds on top of Control)", AUDIT_ROWS)}
      {section("Observe tier (adds on top of Audit)", OBSERVE_ROWS)}
      <div style={{ marginTop: 10, textAlign: "right" }}>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          style={{ fontSize: 11 }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
