export type HookType = "pre_tool_use" | "permission_request";

export interface HookEvent {
  type: "hook_event";
  id: string;
  session_id: string;
  session_cwd: string;
  hook_type: HookType;
  tool_name: string;
  tool_input: Record<string, unknown>;
  timestamp: string;
}

export interface HookResponse {
  id: string;
  action: "approve" | "deny";
  answer?: string;
  session_mode?: string;
}

export type EventVariant = "approval" | "question" | "permission";

export function detectVariant(event: HookEvent): EventVariant {
  if (event.hook_type === "permission_request") return "permission";
  const name = event.tool_name.toLowerCase();
  if (name === "askuserquestion" || name === "askfollowupquestion") return "question";
  return "approval";
}

export type ToolCategory =
  | "Shell command"
  | "File write"
  | "File read"
  | "File search"
  | "Question"
  | "Permission"
  | "Tool call";

export function categorize(toolName: string, variant?: EventVariant): ToolCategory {
  if (variant === "question") return "Question";
  if (variant === "permission") return "Permission";
  const name = toolName.toLowerCase();
  if (name === "bash" || name === "shell") return "Shell command";
  if (name === "write" || name === "edit" || name === "multiedit") return "File write";
  if (name === "read") return "File read";
  if (name === "glob" || name === "grep") return "File search";
  return "Tool call";
}

export function badgeClass(category: ToolCategory): string {
  switch (category) {
    case "Shell command":
      return "bg-[var(--badge-shell-bg)] text-[var(--badge-shell-text)]";
    case "File write":
      return "bg-[var(--badge-write-bg)] text-[var(--badge-write-text)]";
    case "File read":
      return "bg-[var(--badge-read-bg)] text-[var(--badge-read-text)]";
    case "File search":
      return "bg-[var(--badge-read-bg)] text-[var(--badge-read-text)]";
    case "Question":
      return "bg-[var(--badge-question-bg)] text-[var(--badge-question-text)]";
    case "Permission":
      return "bg-[var(--badge-permission-bg)] text-[var(--badge-permission-text)]";
    case "Tool call":
    default:
      return "bg-[var(--badge-tool-bg)] text-[var(--badge-tool-text)]";
  }
}
