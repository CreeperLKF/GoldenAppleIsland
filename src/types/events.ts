export interface HookEvent {
  type: "hook_event";
  id: string;
  session_id: string;
  session_cwd: string;
  hook_type: "pre_tool_use";
  tool_name: string;
  tool_input: Record<string, unknown>;
  timestamp: string;
}

export interface HookResponse {
  id: string;
  action: "approve" | "deny";
}

export type ToolCategory =
  | "Shell command"
  | "File write"
  | "File read"
  | "File search"
  | "Tool call";

export function categorize(toolName: string): ToolCategory {
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
    case "Tool call":
    default:
      return "bg-[var(--badge-tool-bg)] text-[var(--badge-tool-text)]";
  }
}
