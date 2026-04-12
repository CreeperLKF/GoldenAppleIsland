use std::fs;
use std::path::PathBuf;

use regex::Regex;
use serde_json::{json, Value};

use crate::app_settings::{self, CachedHookStatus};
use crate::wsl_admin::HookStatus;

const WIN_HOOK_COMMAND: &str = "~/.claude/hooks/pre-tool-use.cmd";
const PRE_TOOL_USE_CMD: &str = include_str!("../../wsl/pre-tool-use.cmd");
const BRIDGE_MJS: &str = include_str!("../../wsl/bridge.mjs");

fn hooks_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("hooks"))
}

fn settings_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("settings.json"))
}

pub fn get_status() -> HookStatus {
    let Some(dir) = hooks_dir() else {
        return HookStatus {
            scripts_installed: false,
            registered: false,
        };
    };
    let scripts_installed = dir.join("pre-tool-use.cmd").exists() && dir.join("bridge.mjs").exists();

    let registered = match settings_path().and_then(|p| fs::read_to_string(p).ok()) {
        Some(s) => match serde_json::from_str::<Value>(&s) {
            Ok(v) => has_hook_entry(&v),
            Err(_) => false,
        },
        None => false,
    };

    HookStatus {
        scripts_installed,
        registered,
    }
}

pub fn enable() -> Result<(), String> {
    let dir = hooks_dir().ok_or("cannot determine home directory")?;
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir hooks: {}", e))?;

    fs::write(dir.join("pre-tool-use.cmd"), PRE_TOOL_USE_CMD)
        .map_err(|e| format!("write pre-tool-use.cmd: {}", e))?;
    fs::write(dir.join("bridge.mjs"), BRIDGE_MJS)
        .map_err(|e| format!("write bridge.mjs: {}", e))?;

    let configured_port = app_settings::get().port;
    update_script_port(configured_port)?;

    let settings_file = settings_path().ok_or("cannot determine home directory")?;
    let mut settings = if let Ok(s) = fs::read_to_string(&settings_file) {
        serde_json::from_str::<Value>(&s).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    };

    add_hook_entry(&mut settings);

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("serialize: {}", e))?;
    if let Some(parent) = settings_file.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir settings: {}", e))?;
    }
    fs::write(&settings_file, json).map_err(|e| format!("write settings: {}", e))?;

    update_cache(&get_status());
    Ok(())
}

pub fn disable() -> Result<(), String> {
    let settings_file = match settings_path() {
        Some(p) if p.exists() => p,
        _ => return Ok(()),
    };

    let content = fs::read_to_string(&settings_file)
        .map_err(|e| format!("read settings: {}", e))?;
    let mut settings: Value =
        serde_json::from_str(&content).map_err(|e| format!("parse settings: {}", e))?;

    remove_hook_entry(&mut settings);

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("serialize: {}", e))?;
    fs::write(&settings_file, json).map_err(|e| format!("write settings: {}", e))?;

    update_cache(&get_status());
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

fn has_hook_entry(settings: &Value) -> bool {
    let Some(groups) = settings
        .get("hooks")
        .and_then(|h| h.get("PreToolUse"))
        .and_then(|v| v.as_array())
    else {
        return false;
    };
    for group in groups {
        let Some(hooks) = group.get("hooks").and_then(|v| v.as_array()) else {
            continue;
        };
        for hook in hooks {
            if hook.get("command").and_then(|c| c.as_str()) == Some(WIN_HOOK_COMMAND) {
                return true;
            }
        }
    }
    false
}

fn add_hook_entry(settings: &mut Value) {
    if !settings.is_object() {
        *settings = json!({});
    }
    let obj = settings.as_object_mut().unwrap();
    let hooks_entry = obj.entry("hooks").or_insert_with(|| json!({}));
    if !hooks_entry.is_object() {
        *hooks_entry = json!({});
    }
    let hooks = hooks_entry.as_object_mut().unwrap();
    let pre_entry = hooks
        .entry("PreToolUse")
        .or_insert_with(|| Value::Array(vec![]));
    if !pre_entry.is_array() {
        *pre_entry = Value::Array(vec![]);
    }
    let arr = pre_entry.as_array_mut().unwrap();

    for group in arr.iter() {
        if let Some(inner) = group.get("hooks").and_then(|v| v.as_array()) {
            for hook in inner {
                if hook.get("command").and_then(|c| c.as_str()) == Some(WIN_HOOK_COMMAND) {
                    return;
                }
            }
        }
    }

    arr.push(json!({
        "matcher": "*",
        "hooks": [
            { "type": "command", "command": WIN_HOOK_COMMAND }
        ]
    }));
}

fn remove_hook_entry(settings: &mut Value) {
    let Some(arr) = settings
        .get_mut("hooks")
        .and_then(|h| h.get_mut("PreToolUse"))
        .and_then(|v| v.as_array_mut())
    else {
        return;
    };

    for group in arr.iter_mut() {
        if let Some(inner) = group.get_mut("hooks").and_then(|v| v.as_array_mut()) {
            inner.retain(|hook| {
                hook.get("command").and_then(|c| c.as_str()) != Some(WIN_HOOK_COMMAND)
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
}
