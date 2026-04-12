use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::session_ctx::SessionContext;
use crate::ws::HookEvent;

pub const SESSION_RULE_CAP: usize = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PolicyKind {
    Manual,
    Auto,
}

impl Default for PolicyKind {
    fn default() -> Self {
        PolicyKind::Manual
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyRule {
    pub kind: PolicyKind,
    #[serde(default)]
    pub include_subdirectories: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRule {
    pub session_id: String,
    pub session_cwd: String, // normalized
    pub distro: String,
    pub kind: PolicyKind,
    pub created_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ApprovalPolicies {
    #[serde(default)]
    pub global: PolicyKind,
    #[serde(default)]
    pub per_distro: HashMap<String, PolicyRule>,
    #[serde(default)]
    pub per_folder: HashMap<String, PolicyRule>,
    #[serde(default)]
    pub per_session: Vec<SessionRule>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PolicyScope {
    Global,
    Distro,
    Folder,
    Session,
}

#[derive(Debug, Clone)]
pub struct Resolved {
    pub kind: PolicyKind,
    pub scope: PolicyScope,
}

pub fn resolve(
    event: &HookEvent,
    ctx: &SessionContext,
    policies: &ApprovalPolicies,
) -> Resolved {
    if let Some(rule) = policies
        .per_session
        .iter()
        .find(|r| r.session_id == event.session_id)
    {
        return Resolved {
            kind: rule.kind,
            scope: PolicyScope::Session,
        };
    }

    if let Some(rule) = match_folder_rule(&ctx.start_cwd_normalized, &policies.per_folder) {
        return Resolved {
            kind: rule.kind,
            scope: PolicyScope::Folder,
        };
    }

    if let Some(rule) = policies.per_distro.get(&ctx.distro) {
        return Resolved {
            kind: rule.kind,
            scope: PolicyScope::Distro,
        };
    }

    Resolved {
        kind: policies.global,
        scope: PolicyScope::Global,
    }
}

/// Insert a session rule at the front, evicting the oldest if over cap.
pub fn push_session_rule(policies: &mut ApprovalPolicies, rule: SessionRule) {
    policies
        .per_session
        .retain(|r| r.session_id != rule.session_id);
    policies.per_session.insert(0, rule);
    if policies.per_session.len() > SESSION_RULE_CAP {
        policies.per_session.truncate(SESSION_RULE_CAP);
    }
}

/// Normalize path then match folder rules with exact-or-prefix semantics.
pub fn match_folder_rule<'a>(
    start_cwd_normalized: &str,
    per_folder: &'a HashMap<String, PolicyRule>,
) -> Option<&'a PolicyRule> {
    if let Some(rule) = per_folder.get(start_cwd_normalized) {
        return Some(rule);
    }
    let mut best: Option<(&String, &PolicyRule)> = None;
    for (key, rule) in per_folder.iter() {
        if !rule.include_subdirectories {
            continue;
        }
        if is_subpath_of(start_cwd_normalized, key) {
            match best {
                Some((existing, _)) if existing.len() >= key.len() => {}
                _ => best = Some((key, rule)),
            }
        }
    }
    best.map(|(_, r)| r)
}

fn is_subpath_of(candidate: &str, parent: &str) -> bool {
    if !candidate.starts_with(parent) {
        return false;
    }
    let rest = &candidate[parent.len()..];
    rest.is_empty() || rest.starts_with('/') || rest.starts_with('\\')
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_event(session_id: &str, cwd: &str, distro: &str) -> HookEvent {
        HookEvent {
            r#type: "hook_event".into(),
            id: "evt_1".into(),
            session_id: session_id.into(),
            session_cwd: cwd.into(),
            source_distro: distro.into(),
            hook_type: "pre_tool_use".into(),
            tool_name: "Bash".into(),
            tool_input: serde_json::json!({}),
            timestamp: "2026-04-13T00:00:00Z".into(),
        }
    }

    fn mk_ctx(normalized: &str, distro: &str) -> SessionContext {
        SessionContext {
            start_cwd_normalized: normalized.into(),
            distro: distro.into(),
            last_seen_at_ms: 1,
        }
    }

    fn auto_rule() -> PolicyRule {
        PolicyRule {
            kind: PolicyKind::Auto,
            include_subdirectories: false,
            created_at: "2026-04-13T00:00:00Z".into(),
        }
    }

    fn manual_rule() -> PolicyRule {
        PolicyRule {
            kind: PolicyKind::Manual,
            include_subdirectories: false,
            created_at: "2026-04-13T00:00:00Z".into(),
        }
    }

    fn mk_session_rule(id: &str, kind: PolicyKind, ts: &str) -> SessionRule {
        SessionRule {
            session_id: id.into(),
            session_cwd: "wsl://Ubuntu/home/x".into(),
            distro: "Ubuntu".into(),
            kind,
            created_at: ts.into(),
        }
    }

    #[test]
    fn default_resolve_is_manual_global() {
        let policies = ApprovalPolicies::default();
        let ev = mk_event("s", "/home/x", "Ubuntu");
        let ctx = mk_ctx("wsl://Ubuntu/home/x", "Ubuntu");
        let r = resolve(&ev, &ctx, &policies);
        assert_eq!(r.kind, PolicyKind::Manual);
        assert_eq!(r.scope, PolicyScope::Global);
    }

    #[test]
    fn global_auto_applies() {
        let mut policies = ApprovalPolicies::default();
        policies.global = PolicyKind::Auto;
        let ev = mk_event("s", "/home/x", "Ubuntu");
        let ctx = mk_ctx("wsl://Ubuntu/home/x", "Ubuntu");
        assert_eq!(resolve(&ev, &ctx, &policies).kind, PolicyKind::Auto);
    }

    #[test]
    fn distro_overrides_global() {
        let mut policies = ApprovalPolicies::default();
        policies.global = PolicyKind::Auto;
        policies.per_distro.insert("Ubuntu".into(), manual_rule());
        let ev = mk_event("s", "/home/x", "Ubuntu");
        let ctx = mk_ctx("wsl://Ubuntu/home/x", "Ubuntu");
        let r = resolve(&ev, &ctx, &policies);
        assert_eq!(r.kind, PolicyKind::Manual);
        assert_eq!(r.scope, PolicyScope::Distro);
    }

    #[test]
    fn folder_exact_match_overrides_distro() {
        let mut policies = ApprovalPolicies::default();
        policies.per_distro.insert("Ubuntu".into(), manual_rule());
        policies.per_folder.insert("wsl://Ubuntu/home/x".into(), auto_rule());
        let ev = mk_event("s", "/home/x", "Ubuntu");
        let ctx = mk_ctx("wsl://Ubuntu/home/x", "Ubuntu");
        let r = resolve(&ev, &ctx, &policies);
        assert_eq!(r.kind, PolicyKind::Auto);
        assert_eq!(r.scope, PolicyScope::Folder);
    }

    #[test]
    fn folder_exact_does_not_match_subdir_without_flag() {
        let mut policies = ApprovalPolicies::default();
        policies.per_folder.insert("wsl://Ubuntu/home/x".into(), auto_rule());
        let ev = mk_event("s", "/home/x/sub", "Ubuntu");
        let ctx = mk_ctx("wsl://Ubuntu/home/x/sub", "Ubuntu");
        let r = resolve(&ev, &ctx, &policies);
        assert_eq!(r.kind, PolicyKind::Manual);
        assert_eq!(r.scope, PolicyScope::Global);
    }

    #[test]
    fn folder_prefix_matches_subdir_when_flag_set() {
        let mut policies = ApprovalPolicies::default();
        let mut r = auto_rule();
        r.include_subdirectories = true;
        policies.per_folder.insert("wsl://Ubuntu/home/x".into(), r);
        let ev = mk_event("s", "/home/x/sub/deeper", "Ubuntu");
        let ctx = mk_ctx("wsl://Ubuntu/home/x/sub/deeper", "Ubuntu");
        assert_eq!(resolve(&ev, &ctx, &policies).kind, PolicyKind::Auto);
    }

    #[test]
    fn session_overrides_everything() {
        let mut policies = ApprovalPolicies::default();
        policies.global = PolicyKind::Auto;
        policies.per_distro.insert("Ubuntu".into(), auto_rule());
        policies.per_folder.insert("wsl://Ubuntu/home/x".into(), auto_rule());
        policies.per_session.push(mk_session_rule("s", PolicyKind::Manual, "t"));
        let ev = mk_event("s", "/home/x", "Ubuntu");
        let ctx = mk_ctx("wsl://Ubuntu/home/x", "Ubuntu");
        let r = resolve(&ev, &ctx, &policies);
        assert_eq!(r.kind, PolicyKind::Manual);
        assert_eq!(r.scope, PolicyScope::Session);
    }

    #[test]
    fn push_session_rule_caps_at_five() {
        let mut policies = ApprovalPolicies::default();
        for i in 0..7 {
            push_session_rule(
                &mut policies,
                mk_session_rule(&format!("s{}", i), PolicyKind::Auto, &format!("t{}", i)),
            );
        }
        assert_eq!(policies.per_session.len(), SESSION_RULE_CAP);
        let ids: Vec<&str> = policies.per_session.iter().map(|r| r.session_id.as_str()).collect();
        assert_eq!(ids, vec!["s6", "s5", "s4", "s3", "s2"]);
    }
}
