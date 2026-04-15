use std::collections::HashSet;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HookEventKind {
    PreToolUse,
    PermissionRequest,
    UserPromptSubmit,
    PostToolUse,
    Notification,
    Stop,
    SubagentStop,
    PreCompact,
    SessionStart,
    SessionEnd,
}

impl HookEventKind {
    /// Claude Code's canonical event name (used as the key in ~/.claude/settings.json `hooks`).
    pub fn claude_event_name(self) -> &'static str {
        match self {
            Self::PreToolUse => "PreToolUse",
            Self::PermissionRequest => "PermissionRequest",
            Self::UserPromptSubmit => "UserPromptSubmit",
            Self::PostToolUse => "PostToolUse",
            Self::Notification => "Notification",
            Self::Stop => "Stop",
            Self::SubagentStop => "SubagentStop",
            Self::PreCompact => "PreCompact",
            Self::SessionStart => "SessionStart",
            Self::SessionEnd => "SessionEnd",
        }
    }

    /// Script basename (no extension) — `pre-tool-use`, `permission-request`, etc.
    pub fn script_basename(self) -> &'static str {
        match self {
            Self::PreToolUse => "pre-tool-use",
            Self::PermissionRequest => "permission-request",
            Self::UserPromptSubmit => "user-prompt-submit",
            Self::PostToolUse => "post-tool-use",
            Self::Notification => "notification",
            Self::Stop => "stop",
            Self::SubagentStop => "subagent-stop",
            Self::PreCompact => "pre-compact",
            Self::SessionStart => "session-start",
            Self::SessionEnd => "session-end",
        }
    }

    /// Blocking events wait for the UI; observational events are fire-and-forget.
    pub fn is_blocking(self) -> bool {
        matches!(
            self,
            Self::PreToolUse | Self::PermissionRequest | Self::UserPromptSubmit
        )
    }

    pub const ALL: [HookEventKind; 10] = [
        Self::PreToolUse,
        Self::PermissionRequest,
        Self::UserPromptSubmit,
        Self::PostToolUse,
        Self::Notification,
        Self::Stop,
        Self::SubagentStop,
        Self::PreCompact,
        Self::SessionStart,
        Self::SessionEnd,
    ];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkingMode {
    Control,
    #[default]
    Audit,
    Observe,
    Custom,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct CustomHookSet {
    #[serde(default)]
    pub pre_tool_use: bool,
    #[serde(default)]
    pub permission_request: bool,
    #[serde(default)]
    pub user_prompt_submit: bool,
    #[serde(default)]
    pub post_tool_use: bool,
    #[serde(default)]
    pub notification: bool,
    #[serde(default)]
    pub stop: bool,
    #[serde(default)]
    pub subagent_stop: bool,
    #[serde(default)]
    pub pre_compact: bool,
    #[serde(default)]
    pub session_start: bool,
    #[serde(default)]
    pub session_end: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct HookTargetConfig {
    #[serde(default)]
    pub mode: WorkingMode,
    #[serde(default)]
    pub custom: CustomHookSet,
}

/// Compute the event set this config should register. Tests live in Task 2.
pub fn resolve(config: &HookTargetConfig) -> HashSet<HookEventKind> {
    let mut out = HashSet::new();
    match config.mode {
        WorkingMode::Control => {
            out.insert(HookEventKind::PermissionRequest);
        }
        WorkingMode::Audit => {
            out.insert(HookEventKind::PreToolUse);
            out.insert(HookEventKind::PermissionRequest);
        }
        WorkingMode::Observe => {
            for k in HookEventKind::ALL {
                out.insert(k);
            }
        }
        WorkingMode::Custom => {
            let c = &config.custom;
            if c.pre_tool_use { out.insert(HookEventKind::PreToolUse); }
            if c.permission_request { out.insert(HookEventKind::PermissionRequest); }
            if c.user_prompt_submit { out.insert(HookEventKind::UserPromptSubmit); }
            if c.post_tool_use { out.insert(HookEventKind::PostToolUse); }
            if c.notification { out.insert(HookEventKind::Notification); }
            if c.stop { out.insert(HookEventKind::Stop); }
            if c.subagent_stop { out.insert(HookEventKind::SubagentStop); }
            if c.pre_compact { out.insert(HookEventKind::PreCompact); }
            if c.session_start { out.insert(HookEventKind::SessionStart); }
            if c.session_end { out.insert(HookEventKind::SessionEnd); }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(mode: WorkingMode) -> HookTargetConfig {
        HookTargetConfig { mode, custom: CustomHookSet::default() }
    }

    #[test]
    fn control_is_permission_request_only() {
        let set = resolve(&cfg(WorkingMode::Control));
        assert_eq!(set.len(), 1);
        assert!(set.contains(&HookEventKind::PermissionRequest));
    }

    #[test]
    fn audit_adds_pre_tool_use_on_top_of_control() {
        let set = resolve(&cfg(WorkingMode::Audit));
        assert_eq!(set.len(), 2);
        assert!(set.contains(&HookEventKind::PreToolUse));
        assert!(set.contains(&HookEventKind::PermissionRequest));
    }

    #[test]
    fn observe_covers_all_ten_events() {
        let set = resolve(&cfg(WorkingMode::Observe));
        assert_eq!(set.len(), 10);
        for k in HookEventKind::ALL {
            assert!(set.contains(&k), "missing {:?}", k);
        }
    }

    #[test]
    fn control_is_subset_of_audit_subset_of_observe() {
        let c = resolve(&cfg(WorkingMode::Control));
        let a = resolve(&cfg(WorkingMode::Audit));
        let o = resolve(&cfg(WorkingMode::Observe));
        assert!(c.is_subset(&a));
        assert!(a.is_subset(&o));
    }

    #[test]
    fn custom_mode_honors_checked_fields_verbatim() {
        let mut custom = CustomHookSet::default();
        custom.user_prompt_submit = true;
        custom.stop = true;
        let set = resolve(&HookTargetConfig { mode: WorkingMode::Custom, custom });
        assert_eq!(set.len(), 2);
        assert!(set.contains(&HookEventKind::UserPromptSubmit));
        assert!(set.contains(&HookEventKind::Stop));
    }

    #[test]
    fn custom_mode_empty_produces_empty_set() {
        let set = resolve(&cfg(WorkingMode::Custom));
        assert!(set.is_empty());
    }

    #[test]
    fn blocking_classification() {
        assert!(HookEventKind::PreToolUse.is_blocking());
        assert!(HookEventKind::PermissionRequest.is_blocking());
        assert!(HookEventKind::UserPromptSubmit.is_blocking());
        assert!(!HookEventKind::PostToolUse.is_blocking());
        assert!(!HookEventKind::Notification.is_blocking());
        assert!(!HookEventKind::SessionEnd.is_blocking());
    }
}
