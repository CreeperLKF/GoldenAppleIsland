import { useEffect, useState } from "react";
import type { HookEvent } from "../types/events";
import { categorize, detectVariant } from "../types/events";
import ActionButtons from "./ActionButtons";
import CategoryTag, { categoryVeinColor } from "./ui/CategoryTag";
import { formatAgo, middleEllipsis } from "../lib/format";

interface ApprovalCardProps {
  event: HookEvent;
  resolving: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onApproveSession?: () => void;
}

function describe(event: HookEvent): { primary: string; meta: string } {
  const category = categorize(event.tool_name);
  const input = event.tool_input;
  const cwd = middleEllipsis(event.session_cwd ?? "", 36);
  const distro = event.source_distro;

  if (category === "Shell command") {
    const command = typeof input.command === "string" ? input.command : String(input.command ?? "");
    return { primary: command, meta: `${cwd} · ${distro}` };
  }
  if (category === "File write") {
    const path = typeof input.file_path === "string" ? input.file_path : String(input.file_path ?? input.path ?? "");
    return { primary: path, meta: `write · ${distro}` };
  }
  if (category === "File read") {
    const path = typeof input.file_path === "string" ? input.file_path : String(input.file_path ?? "");
    return { primary: path, meta: `read · ${distro}` };
  }
  if (category === "File search") {
    const pattern = typeof input.pattern === "string" ? input.pattern : String(input.pattern ?? "");
    return { primary: pattern, meta: `${cwd} · ${distro}` };
  }
  return { primary: event.tool_name, meta: `${cwd} · ${distro}` };
}

export default function ApprovalCard({
  event, resolving, onApprove, onDeny, onApproveSession,
}: ApprovalCardProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const variant = detectVariant(event);
  const category = categorize(event.tool_name, variant);
  const { primary, meta } = describe(event);
  const veinColor = categoryVeinColor(category);

  return (
    <article
      className="card-enter"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border)",
        borderRadius: "var(--radius-md)",
        borderLeft: `3px solid ${veinColor}`,
        marginLeft: 10,
        marginRight: 10,
        marginTop: 8,
        marginBottom: 0,
        overflow: "hidden",
        opacity: resolving ? 0 : 1,
        maxHeight: resolving ? 0 : 500,
        transform: resolving ? "translateX(8px)" : "translateX(0)",
        transition: "opacity 160ms ease-out, max-height 160ms ease-out, transform 160ms ease-out",
      }}
    >
      {event.delegation_banner && (
        <div
          role="note"
          style={{
            padding: "6px 12px",
            fontSize: "var(--fs-small)",
            color: "var(--sem-warn)",
            background: "rgba(245, 158, 11, 0.08)",
            borderBottom: "0.5px solid var(--border)",
            fontFamily: "var(--font-ui)",
          }}
        >
          {event.delegation_banner}
        </div>
      )}

      <div style={{ padding: "10px 12px" }}>
        {/* Top row: category + tool name · time */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8, marginBottom: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <CategoryTag category={category} />
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-mono-xs)",
              color: "var(--text-tertiary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {event.tool_name}
            </span>
          </div>
          <span
            className="tabular"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-mono-xs)",
              color: "var(--text-tertiary)",
              flexShrink: 0,
            }}
          >
            {formatAgo(event.timestamp, now)}
          </span>
        </div>

        {/* Primary body */}
        <div
          className="mono"
          style={{
            fontSize: "var(--fs-mono)",
            lineHeight: "var(--lh-mono)",
            color: "var(--text-primary)",
            wordBreak: "break-all",
            overflowWrap: "anywhere",
          }}
        >
          {primary}
        </div>

        {/* Metadata */}
        <div
          className="mono"
          style={{
            marginTop: 6,
            fontSize: "var(--fs-mono-sm)",
            lineHeight: "var(--lh-mono-sm)",
            color: "var(--text-tertiary)",
          }}
        >
          {meta}
        </div>
      </div>

      <ActionButtons
        onApprove={onApprove}
        onDeny={onDeny}
        approveLabel={`Approve ${category.toLowerCase()}`}
        denyLabel={`Deny ${category.toLowerCase()}`}
        variant={variant === "permission" ? "permission" : "approval"}
        onApproveSession={onApproveSession}
      />
    </article>
  );
}
