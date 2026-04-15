export interface EventRecord {
  id: string;
  ts: string;
  hook_type: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  decision: "approve" | "deny" | "observed";
  decision_source: "user" | "policy" | "force" | "auto";
  answer?: string | null;
  session_mode?: string | null;
}

export interface SessionMeta {
  first_seen: string;
  last_activity: string;
  event_count: number;
  pinned: boolean;
  fixed: boolean;
}

export interface FolderMeta {
  cwd: string;
  display_name: string;
  pinned: boolean;
  sessions: Record<string, SessionMeta>;
}

export interface AuditIndex {
  version: number;
  max_dynamic_sessions: number;
  folders: Record<string, FolderMeta>;
}
