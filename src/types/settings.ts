export interface AppSettings {
  toast_enabled: boolean;
  sound_enabled: boolean;
  always_on_top: boolean;
  collapsed: boolean;
  port: number;
  wsl_status_cache: Record<string, CachedHookStatus>;
  windows_hook_cache: CachedHookStatus | null;
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
