use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

use regex::Regex;
use serde_json::{json, Value};

use crate::app_settings::{self, CachedHookStatus};
use crate::hook_modes::{HookEventKind, HookTargetConfig};
use crate::hook_reconcile::{apply_desired_set, command_for, HookTarget};
use crate::wsl_admin::HookStatus;

const BRIDGE_MJS: &str = include_str!("../../wsl/bridge.mjs");

struct ScriptAsset {
    basename: &'static str,
    content: &'static str,
}

/// Every `.cmd` wrapper, keyed to its event basename. Installed unconditionally
/// on `enable()` so that mode changes never need to touch disk scripts again.
const WINDOWS_SCRIPTS: &[ScriptAsset] = &[
    ScriptAsset { basename: "pre-tool-use",       content: include_str!("../../wsl/pre-tool-use.cmd") },
    ScriptAsset { basename: "permission-request", content: include_str!("../../wsl/permission-request.cmd") },
    ScriptAsset { basename: "user-prompt-submit", content: include_str!("../../wsl/user-prompt-submit.cmd") },
    ScriptAsset { basename: "post-tool-use",      content: include_str!("../../wsl/post-tool-use.cmd") },
    ScriptAsset { basename: "notification",       content: include_str!("../../wsl/notification.cmd") },
    ScriptAsset { basename: "stop",               content: include_str!("../../wsl/stop.cmd") },
    ScriptAsset { basename: "subagent-stop",      content: include_str!("../../wsl/subagent-stop.cmd") },
    ScriptAsset { basename: "pre-compact",        content: include_str!("../../wsl/pre-compact.cmd") },
    ScriptAsset { basename: "session-start",      content: include_str!("../../wsl/session-start.cmd") },
    ScriptAsset { basename: "session-end",        content: include_str!("../../wsl/session-end.cmd") },
];

fn hooks_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("hooks"))
}

fn settings_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("settings.json"))
}

pub fn get_status() -> HookStatus {
    let Some(dir) = hooks_dir() else {
        return HookStatus { scripts_installed: false, registered: false };
    };
    let scripts_installed = WINDOWS_SCRIPTS
        .iter()
        .all(|s| dir.join(format!("{}.cmd", s.basename)).exists())
        && dir.join("bridge.mjs").exists();

    let registered = match settings_path().and_then(|p| fs::read_to_string(p).ok()) {
        Some(s) => match serde_json::from_str::<Value>(&s) {
            Ok(v) => any_managed_hook_present(&v),
            Err(_) => false,
        },
        None => false,
    };

    HookStatus { scripts_installed, registered }
}

fn any_managed_hook_present(settings: &Value) -> bool {
    let Some(hooks) = settings.get("hooks").and_then(|h| h.as_object()) else {
        return false;
    };
    for arr in hooks.values() {
        let Some(arr) = arr.as_array() else { continue };
        for group in arr {
            let Some(inner) = group.get("hooks").and_then(|v| v.as_array()) else { continue };
            for hook in inner {
                if let Some(cmd) = hook.get("command").and_then(|c| c.as_str()) {
                    if cmd.starts_with("~/.claude/hooks/") && cmd.ends_with(".cmd") {
                        return true;
                    }
                }
            }
        }
    }
    false
}

pub fn enable(config: &HookTargetConfig) -> Result<(), String> {
    install_scripts()?;
    let desired = crate::hook_modes::resolve(config);
    reconcile_settings_json(&desired)?;
    update_cache(&get_status());
    Ok(())
}

pub fn disable() -> Result<(), String> {
    let desired: HashSet<HookEventKind> = HashSet::new();
    reconcile_settings_json(&desired)?;
    update_cache(&get_status());
    Ok(())
}

pub fn apply_config(config: &HookTargetConfig) -> Result<(), String> {
    // Called when the user changes mode on an already-enabled target. Make
    // sure scripts are installed (cheap / idempotent) and re-reconcile.
    install_scripts()?;
    let desired = crate::hook_modes::resolve(config);
    reconcile_settings_json(&desired)?;
    update_cache(&get_status());
    Ok(())
}

fn install_scripts() -> Result<(), String> {
    let dir = hooks_dir().ok_or("cannot determine home directory")?;
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir hooks: {}", e))?;
    for s in WINDOWS_SCRIPTS {
        fs::write(dir.join(format!("{}.cmd", s.basename)), s.content)
            .map_err(|e| format!("write {}.cmd: {}", s.basename, e))?;
    }
    fs::write(dir.join("bridge.mjs"), BRIDGE_MJS)
        .map_err(|e| format!("write bridge.mjs: {}", e))?;
    let configured_port = app_settings::get().port;
    update_script_port(configured_port)?;
    Ok(())
}

fn reconcile_settings_json(desired: &HashSet<HookEventKind>) -> Result<(), String> {
    let settings_file = settings_path().ok_or("cannot determine home directory")?;
    let mut settings = if let Ok(s) = fs::read_to_string(&settings_file) {
        serde_json::from_str::<Value>(&s).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    };
    apply_desired_set(&mut settings, HookTarget::Windows, desired);
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("serialize: {}", e))?;
    if let Some(parent) = settings_file.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir settings: {}", e))?;
    }
    fs::write(&settings_file, json).map_err(|e| format!("write settings: {}", e))?;
    Ok(())
}

pub fn read_script_port() -> Option<u16> {
    let dir = hooks_dir()?;
    let content = fs::read_to_string(dir.join("bridge.mjs")).ok()?;
    let re = Regex::new(r"(?m)^const WS_PORT\s*=\s*(\d+);").ok()?;
    re.captures(&content)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<u16>().ok())
}

pub fn update_script_port(new_port: u16) -> Result<(), String> {
    let dir = hooks_dir().ok_or("cannot determine home directory")?;
    let path = dir.join("bridge.mjs");
    let content = fs::read_to_string(&path).map_err(|e| format!("read bridge.mjs: {}", e))?;
    let re = Regex::new(r"(?m)^const WS_PORT\s*=\s*\d+;").unwrap();
    let updated = re
        .replace(&content, format!("const WS_PORT = {};", new_port).as_str())
        .to_string();
    fs::write(&path, updated).map_err(|e| format!("write bridge.mjs: {}", e))?;
    Ok(())
}

fn update_cache(status: &HookStatus) {
    let mut settings = app_settings::get();
    let port = settings.port;
    settings.windows_hook_cache = Some(CachedHookStatus {
        scripts_installed: status.scripts_installed,
        registered: status.registered,
        port,
    });
    app_settings::set(settings);
}

// `command_for` is re-exported for tests that want the canonical command
// string; silences unused-import warning if no call site in this module.
#[allow(dead_code)]
fn _refer_command_for(t: HookTarget, k: HookEventKind) -> String {
    command_for(t, k)
}
