use std::collections::HashSet;
use std::process::Stdio;

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Value};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::app_settings::{self, CachedHookStatus};
use crate::hook_modes::{HookEventKind, HookTargetConfig};
use crate::hook_reconcile::{apply_desired_set, HookTarget};

const BRIDGE_MJS: &str = include_str!("../../wsl/bridge.mjs");

struct WslScriptAsset {
    basename: &'static str,
    content: &'static str,
}

const WSL_SCRIPTS: &[WslScriptAsset] = &[
    WslScriptAsset { basename: "pre-tool-use",       content: include_str!("../../wsl/pre-tool-use.sh") },
    WslScriptAsset { basename: "permission-request", content: include_str!("../../wsl/permission-request.sh") },
    WslScriptAsset { basename: "user-prompt-submit", content: include_str!("../../wsl/user-prompt-submit.sh") },
    WslScriptAsset { basename: "post-tool-use",      content: include_str!("../../wsl/post-tool-use.sh") },
    WslScriptAsset { basename: "notification",       content: include_str!("../../wsl/notification.sh") },
    WslScriptAsset { basename: "stop",               content: include_str!("../../wsl/stop.sh") },
    WslScriptAsset { basename: "subagent-stop",      content: include_str!("../../wsl/subagent-stop.sh") },
    WslScriptAsset { basename: "pre-compact",        content: include_str!("../../wsl/pre-compact.sh") },
    WslScriptAsset { basename: "session-start",      content: include_str!("../../wsl/session-start.sh") },
    WslScriptAsset { basename: "session-end",        content: include_str!("../../wsl/session-end.sh") },
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WslDistro {
    pub name: String,
    pub is_default: bool,
    pub version: u8,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookStatus {
    pub scripts_installed: bool,
    pub registered: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WslDistroWithStatus {
    #[serde(flatten)]
    pub distro: WslDistro,
    pub status: HookStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkResult {
    pub distro: String,
    pub ok: bool,
    pub error: Option<String>,
}

fn decode_wsl_output(bytes: &[u8]) -> String {
    // WSL_UTF8=1 env var makes wsl.exe emit UTF-8 on recent versions,
    // but older versions still emit UTF-16LE with a BOM. Detect and decode.
    if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE {
        let u16s: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        String::from_utf16_lossy(&u16s)
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    }
}

fn wsl_cmd() -> Command {
    let mut cmd = Command::new("wsl.exe");
    cmd.env("WSL_UTF8", "1");
    #[cfg(windows)]
    {
        // Prevent a console window from flashing when the Tauri GUI spawns wsl.exe.
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

pub async fn list_distros() -> Result<Vec<WslDistro>, String> {
    let out = wsl_cmd()
        .args(["--list", "--verbose"])
        .output()
        .await
        .map_err(|e| format!("wsl.exe --list failed: {}", e))?;

    if !out.status.success() {
        return Err(format!(
            "wsl.exe --list exited {}: {}",
            out.status,
            decode_wsl_output(&out.stderr)
        ));
    }

    let text = decode_wsl_output(&out.stdout);
    let mut distros = Vec::new();
    for line in text.lines().skip(1) {
        // Skip header row "  NAME ... STATE ... VERSION"
        let trimmed = line.trim_end_matches('\r');
        if trimmed.trim().is_empty() {
            continue;
        }
        let is_default = trimmed.trim_start().starts_with('*');
        let rest: String = trimmed
            .trim_start()
            .trim_start_matches('*')
            .trim_start()
            .to_string();
        let mut parts = rest.split_whitespace();
        let Some(name) = parts.next() else {
            continue;
        };
        let state = parts.next().unwrap_or("Stopped").to_string();
        let version: u8 = parts
            .next()
            .and_then(|v| v.parse().ok())
            .unwrap_or(2);
        distros.push(WslDistro {
            name: name.to_string(),
            is_default,
            version,
            state,
        });
    }
    Ok(distros)
}

async fn run_in_distro(distro: &str, script: &str) -> Result<(i32, String, String), String> {
    let out = wsl_cmd()
        .args(["-d", distro, "--", "bash", "-c", script])
        .output()
        .await
        .map_err(|e| format!("wsl -d {} failed: {}", distro, e))?;
    let code = out.status.code().unwrap_or(-1);
    let stdout = decode_wsl_output(&out.stdout);
    let stderr = decode_wsl_output(&out.stderr);
    Ok((code, stdout, stderr))
}

async fn write_file_in_distro(
    distro: &str,
    target_path: &str,
    content: &str,
) -> Result<(), String> {
    // Use a PID-suffixed temp path to avoid clobbering if two calls race.
    let tmp = format!("{}.tmp.$$", target_path);
    let script = format!(
        "mkdir -p \"$(dirname {target})\" && cat > {tmp} && mv {tmp} {target}",
        target = target_path,
        tmp = tmp,
    );
    let mut child = wsl_cmd()
        .args(["-d", distro, "--", "bash", "-c", &script])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn wsl -d {}: {}", distro, e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(content.as_bytes())
            .await
            .map_err(|e| format!("stdin write failed: {}", e))?;
        stdin
            .shutdown()
            .await
            .map_err(|e| format!("stdin shutdown failed: {}", e))?;
    }

    let out = child
        .wait_with_output()
        .await
        .map_err(|e| format!("wait failed: {}", e))?;
    if !out.status.success() {
        return Err(format!(
            "write {} in {} failed ({}): {}",
            target_path,
            distro,
            out.status,
            decode_wsl_output(&out.stderr)
        ));
    }
    Ok(())
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
                    if cmd.starts_with("~/.claude/hooks/") && cmd.ends_with(".sh") {
                        return true;
                    }
                }
            }
        }
    }
    false
}

pub async fn get_hook_status(distro: &str) -> Result<HookStatus, String> {
    let (test_code, _, _) =
        run_in_distro(distro, "test -f ~/.claude/hooks/pre-tool-use.sh && test -f ~/.claude/hooks/permission-request.sh").await?;
    let scripts_installed = test_code == 0;

    let (_, stdout, _) = run_in_distro(
        distro,
        "cat ~/.claude/settings.json 2>/dev/null || echo '{}'",
    )
    .await?;

    let registered = match serde_json::from_str::<Value>(stdout.trim()) {
        Ok(v) => any_managed_hook_present(&v),
        Err(_) => false,
    };

    Ok(HookStatus {
        scripts_installed,
        registered,
    })
}

async fn read_settings(distro: &str) -> Result<Value, String> {
    let (code, stdout, _stderr) = run_in_distro(
        distro,
        "if [ -f ~/.claude/settings.json ]; then cat ~/.claude/settings.json; else echo '{}'; fi",
    )
    .await?;
    if code != 0 {
        return Ok(serde_json::json!({}));
    }
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Ok(serde_json::json!({}));
    }
    match serde_json::from_str::<Value>(trimmed) {
        Ok(v) if v.is_object() => Ok(v),
        Ok(_) => Err(format!(
            "{}: ~/.claude/settings.json root is not an object; refusing to overwrite",
            distro
        )),
        Err(e) => Err(format!(
            "{}: ~/.claude/settings.json is not valid JSON ({}); refusing to overwrite",
            distro, e
        )),
    }
}

async fn write_settings(distro: &str, settings: &Value) -> Result<(), String> {
    let mut body = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("serialize settings: {}", e))?;
    body.push('\n');
    write_file_in_distro(distro, "~/.claude/settings.json", &body).await
}

async fn ensure_scripts(distro: &str) -> Result<(), String> {
    for s in WSL_SCRIPTS {
        let path = format!("~/.claude/hooks/{}.sh", s.basename);
        write_file_in_distro(distro, &path, s.content).await?;
    }
    write_file_in_distro(distro, "~/.claude/hooks/bridge.mjs", BRIDGE_MJS).await?;
    let chmod_list: Vec<String> = WSL_SCRIPTS
        .iter()
        .map(|s| format!("~/.claude/hooks/{}.sh", s.basename))
        .collect();
    let chmod_cmd = format!("chmod +x {}", chmod_list.join(" "));
    let (code, _, stderr) = run_in_distro(distro, &chmod_cmd).await?;
    if code != 0 {
        return Err(format!("chmod failed in {}: {}", distro, stderr));
    }
    Ok(())
}

pub async fn update_scripts(distro: &str) -> Result<(), String> {
    ensure_scripts(distro).await
}

pub async fn update_scripts_all() -> Vec<BulkResult> {
    let distros = match list_distros().await {
        Ok(d) => d,
        Err(e) => {
            return vec![BulkResult {
                distro: String::from("<list>"),
                ok: false,
                error: Some(e),
            }]
        }
    };
    let mut out = Vec::with_capacity(distros.len());
    for d in distros {
        let res = ensure_scripts(&d.name).await;
        let (ok, error) = match res {
            Ok(_) => (true, None),
            Err(e) => (false, Some(e)),
        };
        out.push(BulkResult {
            distro: d.name,
            ok,
            error,
        });
    }
    out
}

pub async fn enable_hook(distro: &str, config: &HookTargetConfig) -> Result<(), String> {
    ensure_scripts(distro).await?;
    let desired = crate::hook_modes::resolve(config);
    let mut settings = read_settings(distro).await?;
    apply_desired_set(&mut settings, HookTarget::Wsl, &desired);
    write_settings(distro, &settings).await
}

pub async fn disable_hook(distro: &str) -> Result<(), String> {
    let mut settings = match read_settings(distro).await {
        Ok(v) => v,
        Err(e) => {
            log::info!("{}: settings.json unreadable ({}); treating as already disabled", distro, e);
            return Ok(());
        }
    };
    let empty: HashSet<HookEventKind> = HashSet::new();
    apply_desired_set(&mut settings, HookTarget::Wsl, &empty);
    write_settings(distro, &settings).await
}

pub async fn apply_config(distro: &str, config: &HookTargetConfig) -> Result<(), String> {
    ensure_scripts(distro).await?;
    let desired = crate::hook_modes::resolve(config);
    let mut settings = read_settings(distro).await?;
    apply_desired_set(&mut settings, HookTarget::Wsl, &desired);
    write_settings(distro, &settings).await
}

pub async fn set_hook_all(enabled: bool) -> Vec<BulkResult> {
    let distros = match list_distros().await {
        Ok(d) => d,
        Err(e) => return vec![BulkResult { distro: String::from("<list>"), ok: false, error: Some(e) }],
    };
    let settings = app_settings::get();
    let default_cfg = HookTargetConfig {
        mode: settings.default_mode,
        custom: crate::hook_modes::CustomHookSet::default(),
    };
    let mut out = Vec::with_capacity(distros.len());
    for d in distros {
        let res = if enabled {
            let cfg = settings
                .wsl_hook_configs
                .get(&d.name)
                .cloned()
                .unwrap_or_else(|| default_cfg.clone());
            enable_hook(&d.name, &cfg).await
        } else {
            disable_hook(&d.name).await
        };
        let (ok, error) = match res {
            Ok(_) => (true, None),
            Err(e) => (false, Some(e)),
        };
        out.push(BulkResult { distro: d.name, ok, error });
    }
    out
}

pub async fn list_with_status() -> Result<Vec<WslDistroWithStatus>, String> {
    let distros = list_distros().await?;
    let mut out = Vec::with_capacity(distros.len());
    for d in distros {
        let status = get_hook_status(&d.name).await.unwrap_or(HookStatus {
            scripts_installed: false,
            registered: false,
        });
        out.push(WslDistroWithStatus { distro: d, status });
    }
    Ok(out)
}

pub async fn read_script_port(distro: &str) -> Result<Option<u16>, String> {
    let (code, stdout, _) = run_in_distro(
        distro,
        "cat ~/.claude/hooks/bridge.mjs 2>/dev/null || echo ''",
    )
    .await?;
    if code != 0 || stdout.trim().is_empty() {
        return Ok(None);
    }
    let re = Regex::new(r"(?m)^const WS_PORT\s*=\s*(\d+);").unwrap();
    Ok(re
        .captures(&stdout)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<u16>().ok()))
}

pub async fn update_script_port(distro: &str, new_port: u16) -> Result<(), String> {
    let (code, stdout, _) = run_in_distro(distro, "cat ~/.claude/hooks/bridge.mjs 2>/dev/null")
        .await?;
    if code != 0 {
        return Err(format!("{}: bridge.mjs not found", distro));
    }
    let re = Regex::new(r"(?m)^const WS_PORT\s*=\s*\d+;").unwrap();
    let updated = re
        .replace(&stdout, format!("const WS_PORT = {};", new_port).as_str())
        .to_string();
    write_file_in_distro(distro, "~/.claude/hooks/bridge.mjs", &updated).await
}

pub async fn list_distros_smart() -> Result<Vec<WslDistroWithStatus>, String> {
    let distros = list_distros().await?;
    let settings = app_settings::get();
    let cache = &settings.wsl_status_cache;
    let configured_port = settings.port;

    let mut out = Vec::with_capacity(distros.len());
    for d in distros {
        let status = if d.state == "Running" {
            let live = get_hook_status(&d.name).await.unwrap_or(HookStatus {
                scripts_installed: false,
                registered: false,
            });
            update_wsl_cache(&d.name, &live, configured_port);
            live
        } else {
            match cache.get(&d.name) {
                Some(cached) => HookStatus {
                    scripts_installed: cached.scripts_installed,
                    registered: cached.registered && cached.port == configured_port,
                },
                None => HookStatus {
                    scripts_installed: false,
                    registered: false,
                },
            }
        };
        out.push(WslDistroWithStatus { distro: d, status });
    }
    Ok(out)
}

pub async fn check_single_distro(distro_name: &str) -> Result<HookStatus, String> {
    let settings = app_settings::get();
    let configured_port = settings.port;

    let live = get_hook_status(distro_name).await?;

    if live.scripts_installed && live.registered {
        if let Ok(Some(script_port)) = read_script_port(distro_name).await {
            if script_port != configured_port {
                update_script_port(distro_name, configured_port).await?;
            }
        }
    }

    update_wsl_cache(distro_name, &live, configured_port);
    Ok(live)
}

fn update_wsl_cache(distro_name: &str, status: &HookStatus, port: u16) {
    let mut settings = app_settings::get();
    settings.wsl_status_cache.insert(
        distro_name.to_string(),
        CachedHookStatus {
            scripts_installed: status.scripts_installed,
            registered: status.registered,
            port,
        },
    );
    app_settings::set(settings);
}
