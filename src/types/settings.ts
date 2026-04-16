import type { HookTargetConfig, WorkingMode } from "./modes";

export type SettingsTabId = "general" | "approval" | "hooks" | "audit";

export interface PopupPosition {
  x: number;
  y: number;
  monitor_name: string;
}

export type ThemePref = "system" | "light" | "dark";

export interface AppSettings {
  toast_enabled: boolean;
  sound_enabled: boolean;
  always_on_top: boolean;
  collapsed: boolean;
  port: number;
  log_to_file: boolean;
  wsl_status_cache: Record<string, CachedHookStatus>;
  windows_hook_cache: CachedHookStatus | null;
  settings_last_tab?: SettingsTabId;
  popup_position?: PopupPosition | null;
  recent_collapsed: boolean;
  hotkey_toggle_window: string;
  hotkey_approve_all: string;
  default_mode: WorkingMode;
  windows_hook_config: HookTargetConfig;
  wsl_hook_configs: Record<string, HookTargetConfig>;
  audit_history_enabled: boolean;
  max_dynamic_sessions: number;
  audit_skip_unpinned_delete_confirm: boolean;
  theme: ThemePref;
}

export interface CachedHookStatus {
  scripts_installed: boolean;
  registered: boolean;
  port: number;
}

export interface WslDistro {
  name: string;
  is_default: boolean;
  version: number;
  state: string;
}

export interface HookStatus {
  scripts_installed: boolean;
  registered: boolean;
}

export interface WslDistroWithStatus extends WslDistro {
  status: HookStatus;
}

export interface BulkResult {
  distro: string;
  ok: boolean;
  error: string | null;
}

export interface AgentApproveConfig {
  workspace_path: string | null;
  is_default_workspace: boolean;
  turn_limit: number;
  call_timeout_secs: number;
}

export interface ExternalApproveConfig {
  endpoint_url: string | null;
  auth_header: string | null;
  call_timeout_secs: number;
}

export interface AgentSessionSnapshot {
  session_id: string;
  turn_count: number;
  workspace_path: string;
}
