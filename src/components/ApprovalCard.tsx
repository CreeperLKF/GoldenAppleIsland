import { useEffect, useState } from "react";
import type { HookEvent } from "../types/events";
import { categorize, badgeClass, detectVariant } from "../types/events";
import ActionButtons from "./ActionButtons";

interface ApprovalCardProps {
  event: HookEvent;
  resolving: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onApproveSession?: () => void;
}

function formatAgo(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "just now";
  const secs = Math.max(0, Math.round((now - t) / 1000));
  if (secs < 2) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function describe(event: HookEvent): { primary: string; description: string } {
  const category = categorize(event.tool_name);
  const input = event.tool_input;
  const cwd = event.session_cwd;

  if (category === "Shell command") {
    const command = typeof input.command === "string" ? input.command : String(input.command ?? "");
    return { primary: command, description: `Execute shell command in ${cwd}` };
  }
  if (category === "File write") {
    const path = typeof input.file_path === "string" ? input.file_path : String(input.file_path ?? input.path ?? "");
    return { primary: path, description: `Write to ${path}` };
  }
  if (category === "File read") {
    const path = typeof input.file_path === "string" ? input.file_path : String(input.file_path ?? "");
    return { primary: path, description: `Read ${path}` };
  }
  if (category === "File search") {
    const pattern = typeof input.pattern === "string" ? input.pattern : String(input.pattern ?? "");
    return { primary: pattern, description: `Search in ${cwd}` };
  }
  return { primary: event.tool_name, description: `Run ${event.tool_name}` };
}

export default function ApprovalCard({
  event,
  resolving,
  onApprove,
  onDeny,
  onApproveSession,
}: ApprovalCardProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const variant = detectVariant(event);
  const category = categorize(event.tool_name, variant);
  const { primary, description } = describe(event);

  return (
    <article
      className="card-enter overflow-hidden bg-[var(--bg-surface)] transition-all ease-in"
      style={{
        borderRadius: 6,
        border: "0.5px solid var(--border)",
        marginLeft: 8,
        marginRight: 8,
        marginTop: 6,
        marginBottom: 6,
        opacity: resolving ? 0 : 1,
        maxHeight: resolving ? 0 : 400,
        transitionDuration: "200ms",
      }}
    >
      {event.delegation_banner && (
        <div
          className="delegation-banner"
          role="note"
          style={{
            padding: "6px 12px",
            fontSize: 11,
            background: "var(--badge-permission-bg)",
            color: "var(--badge-permission-text)",
            borderBottom: "0.5px solid var(--border)",
          }}
        >
          {event.delegation_banner}
        </div>
      )}
      <div style={{ padding: "10px 12px" }}>
        <div className="flex items-center justify-between">
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
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: 11 }}>
            {formatAgo(event.timestamp, now)}
          </span>
        </div>

        <div
          className="mono text-[var(--text-primary)] mt-2 break-all"
          style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}
        >
          {primary}
        </div>

        <div className="text-[var(--text-secondary)] mt-1" style={{ fontSize: 12 }}>
          {description}
        </div>
      </div>

      <ActionButtons
        onApprove={onApprove}
        onDeny={onDeny}
        approveLabel={`Approve ${category.toLowerCase()}: ${primary}`}
        denyLabel={`Deny ${category.toLowerCase()}: ${primary}`}
        variant={variant === "permission" ? "permission" : "approval"}
        onApproveSession={onApproveSession}
      />
    </article>
  );
}
