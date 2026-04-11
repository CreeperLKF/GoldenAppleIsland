export interface AppSettings {
  toast_enabled: boolean;
  sound_enabled: boolean;
}

export interface WslDistro {
  name: string;
  is_default: boolean;
  version: number;
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
