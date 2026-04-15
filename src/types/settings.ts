import type { HookTargetConfig, WorkingMode } from "./modes";

export type SettingsTabId = "general" | "approval" | "hooks" | "audit";

export interface PopupPosition {
  x: number;
  y: number;
  monitor_name: string;
}

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
