use std::collections::HashSet;

use serde_json::{json, Value};

use crate::hook_modes::HookEventKind;

#[derive(Debug, Clone, Copy)]
pub enum HookTarget {
    Windows,
    Wsl,
}

impl HookTarget {
    fn extension(self) -> &'static str {
        match self {
            Self::Windows => "cmd",
            Self::Wsl => "sh",
        }
    }
}

/// Returns the command path our reconciler writes (and recognizes) for a
/// given event on a given target. Example: `~/.claude/hooks/stop.cmd`.
pub fn command_for(target: HookTarget, kind: HookEventKind) -> String {
    format!(
        "~/.claude/hooks/{}.{}",
        kind.script_basename(),
        target.extension()
    )
}

/// True when a given `command` string looks like one of our managed scripts
/// for the specified target. A Windows reconciler recognises only `.cmd`
/// entries; a WSL reconciler recognises only `.sh` entries. Cross-target
/// entries are treated as unrelated user hooks and left untouched.
fn is_managed_command(target: HookTarget, command: &str) -> bool {
    let ext = target.extension();
    command.starts_with("~/.claude/hooks/") && command.ends_with(&format!(".{}", ext))
}

/// Rewrite `settings` in place so that its `hooks` tree registers exactly
/// the events in `desired`, using commands produced by `command_for`. Any
/// existing hook entries that point at managed commands but are not in
/// `desired` are removed. Unmanaged hook entries (e.g. other tools a user
/// may have registered) are preserved.
pub fn apply_desired_set(
    settings: &mut Value,
    target: HookTarget,
    desired: &HashSet<HookEventKind>,
) {
    if !settings.is_object() {
        *settings = json!({});
    }
    let obj = settings.as_object_mut().unwrap();
    let hooks_entry = obj.entry("hooks").or_insert_with(|| json!({}));
    if !hooks_entry.is_object() {
        *hooks_entry = json!({});
    }
    let hooks = hooks_entry.as_object_mut().unwrap();

    // Pass 1: for every hook event group currently present, strip managed
    // commands that don't correspond to `desired`, then prune empty groups.
    let existing_event_names: Vec<String> = hooks.keys().cloned().collect();
    for event_name in existing_event_names {
        let keep = desired
            .iter()
            .find(|k| k.claude_event_name() == event_name)
            .copied();
        let Some(arr) = hooks.get_mut(&event_name).and_then(|v| v.as_array_mut()) else {
            continue;
        };
        let managed_expected = keep.map(|k| command_for(target, k));
        for group in arr.iter_mut() {
            if let Some(inner) = group.get_mut("hooks").and_then(|v| v.as_array_mut()) {
                inner.retain(|hook| {
                    let cmd = hook.get("command").and_then(|c| c.as_str()).unwrap_or("");
                    if !is_managed_command(target, cmd) {
                        return true; // leave unrelated commands alone
                    }
                    Some(cmd) == managed_expected.as_deref()
                });
            }
        }
        arr.retain(|group| {
            group
                .get("hooks")
                .and_then(|v| v.as_array())
                .map(|a| !a.is_empty())
                .unwrap_or(false)
        });
        if arr.is_empty() {
            hooks.remove(&event_name);
        }
    }

    // Pass 2: for each desired event, add our entry if not already present.
    for &kind in desired {
        let event_name = kind.claude_event_name().to_string();
        let command = command_for(target, kind);
        let entry = hooks
            .entry(event_name)
            .or_insert_with(|| Value::Array(vec![]));
        if !entry.is_array() {
            *entry = Value::Array(vec![]);
        }
        let arr = entry.as_array_mut().unwrap();

        let already = arr.iter().any(|group| {
            group
                .get("hooks")
                .and_then(|v| v.as_array())
                .map(|inner| {
                    inner.iter().any(|h| {
                        h.get("command").and_then(|c| c.as_str()) == Some(command.as_str())
                    })
                })
                .unwrap_or(false)
        });
        if already {
            continue;
        }

        // PermissionRequest gets a 24h timeout to mirror the old behavior;
        // everything else omits the field (Claude Code uses its default).
        let mut hook_obj = json!({ "type": "command", "command": command });
        if matches!(kind, HookEventKind::PermissionRequest) {
            hook_obj
                .as_object_mut()
                .unwrap()
                .insert("timeout".to_string(), json!(86400));
        }
        arr.push(json!({ "matcher": "*", "hooks": [hook_obj] }));
    }

    // If the whole hooks map is now empty, remove it so we don't leave
    // `"hooks": {}` clutter in settings.json.
    if hooks.is_empty() {
        obj.remove("hooks");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hook_modes::HookEventKind as K;

    fn set(ks: &[K]) -> HashSet<K> {
        ks.iter().copied().collect()
    }

    #[test]
    fn empty_desired_removes_all_managed_entries() {
        let mut v = json!({
            "hooks": {
                "PreToolUse": [{
                    "matcher": "*",
                    "hooks": [{ "type": "command", "command": "~/.claude/hooks/pre-tool-use.cmd" }]
                }],
                "PermissionRequest": [{
                    "matcher": "*",
                    "hooks": [{ "type": "command", "command": "~/.claude/hooks/permission-request.cmd", "timeout": 86400 }]
                }]
            }
        });
        apply_desired_set(&mut v, HookTarget::Windows, &set(&[]));
        assert!(v.get("hooks").is_none(), "got {}", v);
    }

    #[test]
    fn unmanaged_user_hooks_are_preserved() {
        let mut v = json!({
            "hooks": {
                "PreToolUse": [{
                    "matcher": "*",
                    "hooks": [
                        { "type": "command", "command": "~/.claude/hooks/pre-tool-use.sh" },
                        { "type": "command", "command": "/usr/local/bin/my-own-hook" }
                    ]
                }]
            }
        });
        apply_desired_set(&mut v, HookTarget::Wsl, &set(&[]));
        let inner = v
            .pointer("/hooks/PreToolUse/0/hooks")
            .unwrap()
            .as_array()
            .unwrap();
        assert_eq!(inner.len(), 1);
        assert_eq!(
            inner[0].get("command").unwrap().as_str().unwrap(),
            "/usr/local/bin/my-own-hook"
        );
    }

    #[test]
    fn cross_target_entries_are_left_alone() {
        // A stray .cmd entry sitting in a settings.json that the WSL
        // reconciler is operating on must be treated like any unrelated
        // user hook — left alone, never overwritten.
        let mut v = json!({
            "hooks": {
                "PreToolUse": [{
                    "matcher": "*",
                    "hooks": [{ "type": "command", "command": "~/.claude/hooks/pre-tool-use.cmd" }]
                }]
            }
        });
        apply_desired_set(&mut v, HookTarget::Wsl, &set(&[K::PreToolUse]));
        let inner = v
            .pointer("/hooks/PreToolUse/0/hooks")
            .unwrap()
            .as_array()
            .unwrap();
        // The original .cmd entry survives, AND a new .sh entry is added.
        assert_eq!(inner.len(), 1, "cmd survives in its own group");
        assert_eq!(
            inner[0].get("command").unwrap().as_str().unwrap(),
            "~/.claude/hooks/pre-tool-use.cmd"
        );
        // The .sh entry should appear in a *separate* group (apply_desired_set
        // adds a fresh group for newly desired managed entries).
        let groups = v
            .pointer("/hooks/PreToolUse")
            .unwrap()
            .as_array()
            .unwrap();
        assert_eq!(groups.len(), 2, "should have two groups now");
        let second_group_inner = groups[1]
            .get("hooks")
            .unwrap()
            .as_array()
            .unwrap();
        assert_eq!(
            second_group_inner[0].get("command").unwrap().as_str().unwrap(),
            "~/.claude/hooks/pre-tool-use.sh"
        );
    }

    #[test]
    fn observe_mode_adds_all_ten_event_entries() {
        let mut v = json!({});
        apply_desired_set(&mut v, HookTarget::Wsl, &set(&K::ALL));
        let hooks = v.get("hooks").unwrap().as_object().unwrap();
        assert_eq!(hooks.len(), 10);
        for k in K::ALL {
            assert!(hooks.contains_key(k.claude_event_name()), "missing {}", k.claude_event_name());
        }
    }

    #[test]
    fn permission_request_entry_has_timeout_field() {
        let mut v = json!({});
        apply_desired_set(&mut v, HookTarget::Windows, &set(&[K::PermissionRequest]));
        let inner = v
            .pointer("/hooks/PermissionRequest/0/hooks/0")
            .unwrap();
        assert_eq!(inner.get("timeout").unwrap().as_u64().unwrap(), 86400);
    }

    #[test]
    fn idempotent_when_applied_twice() {
        let desired = set(&[K::PreToolUse, K::PermissionRequest]);
        let mut v = json!({});
        apply_desired_set(&mut v, HookTarget::Windows, &desired);
        let after_first = v.clone();
        apply_desired_set(&mut v, HookTarget::Windows, &desired);
        assert_eq!(v, after_first);
    }

    #[test]
    fn audit_to_observe_transition_adds_new_entries_leaves_existing() {
        let mut v = json!({});
        apply_desired_set(&mut v, HookTarget::Wsl, &set(&[K::PreToolUse, K::PermissionRequest]));
        apply_desired_set(&mut v, HookTarget::Wsl, &set(&K::ALL));
        let hooks = v.get("hooks").unwrap().as_object().unwrap();
        assert_eq!(hooks.len(), 10);
    }

    #[test]
    fn observe_to_control_removes_all_but_permission_request() {
        let mut v = json!({});
        apply_desired_set(&mut v, HookTarget::Wsl, &set(&K::ALL));
        apply_desired_set(&mut v, HookTarget::Wsl, &set(&[K::PermissionRequest]));
        let hooks = v.get("hooks").unwrap().as_object().unwrap();
        assert_eq!(hooks.len(), 1);
        assert!(hooks.contains_key("PermissionRequest"));
    }
}
