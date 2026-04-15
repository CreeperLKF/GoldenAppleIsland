export type WorkingMode = "control" | "audit" | "observe" | "custom";

export interface CustomHookSet {
  pre_tool_use: boolean;
  permission_request: boolean;
  user_prompt_submit: boolean;
  post_tool_use: boolean;
  notification: boolean;
  stop: boolean;
  subagent_stop: boolean;
  pre_compact: boolean;
  session_start: boolean;
  session_end: boolean;
}

export interface HookTargetConfig {
  mode: WorkingMode;
  custom: CustomHookSet;
}

export const EMPTY_CUSTOM: CustomHookSet = {
  pre_tool_use: false,
  permission_request: false,
  user_prompt_submit: false,
  post_tool_use: false,
  notification: false,
  stop: false,
  subagent_stop: false,
  pre_compact: false,
  session_start: false,
  session_end: false,
};

export const DEFAULT_CONFIG: HookTargetConfig = {
  mode: "audit",
  custom: EMPTY_CUSTOM,
};
