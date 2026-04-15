// --- imports ---
// std
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

// external crates
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use tokio::sync::Mutex as AsyncMutex;

// crate-internal
use crate::verdict::{self, Verdict, VerdictParseError};
use crate::ws::HookEvent;

pub const ALICE_URL: &str =
    "https://raw.githubusercontent.com/CreeperLKF/ALICE/main/examples/all-is-well.md";
pub const MARKER_FILENAME: &str = ".gai-workspace-marker";

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceMarker {
    pub source: String,
    pub downloaded_at: String,
    pub alice_url: String,
}

pub fn default_workspace_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("golden-apple-island")
        .join("agent-workspaces")
        .join("default")
}

pub fn is_default_gai_workspace(path: &Path) -> bool {
    let marker = path.join(MARKER_FILENAME);
    let Ok(text) = fs::read_to_string(&marker) else {
        return false;
    };
    let Ok(parsed) = serde_json::from_str::<WorkspaceMarker>(&text) else {
        return false;
    };
    parsed.source == "gai-default"
}

pub fn workspace_has_claude_md(path: &Path) -> bool {
    path.join("CLAUDE.md").is_file()
}

/// Create the default workspace directory layout and write a marker file.
/// The `claude_md_contents` argument is injected by the caller so this
/// function stays synchronous and testable.
pub fn write_default_workspace(
    dir: &Path,
    claude_md_contents: &str,
    now_iso: &str,
) -> std::io::Result<()> {
    fs::create_dir_all(dir)?;
    fs::write(dir.join("CLAUDE.md"), claude_md_contents)?;

    let settings_dir = dir.join(".claude");
    fs::create_dir_all(&settings_dir)?;
    fs::write(settings_dir.join("settings.json"), "{}\n")?;

    let marker = WorkspaceMarker {
        source: "gai-default".to_string(),
        downloaded_at: now_iso.to_string(),
        alice_url: ALICE_URL.to_string(),
    };
    fs::write(
        dir.join(MARKER_FILENAME),
        serde_json::to_string_pretty(&marker).unwrap(),
    )?;
    Ok(())
}

/// Recursively delete a directory if and only if it holds a gai-default marker.
pub fn nuke_default_workspace(dir: &Path) -> std::io::Result<()> {
    if !is_default_gai_workspace(dir) {
        return Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "refusing to delete a non-default workspace",
        ));
    }
    fs::remove_dir_all(dir)?;
    Ok(())
}

/// Render the hook event as a neutral YAML-ish prompt block fed to `claude -p`.
pub fn build_prompt(event: &HookEvent) -> String {
    let mut out = String::new();
    out.push_str(
        "A Claude Code session needs approval for the following operation. \
Review it according to CLAUDE.md in this workspace and respond with the \
required JSON verdict.\n\n",
    );
    out.push_str("operation:\n");
    out.push_str(&format!("  session_id: {}\n", event.session_id));
    out.push_str(&format!("  session_cwd: {}\n", event.session_cwd));
    out.push_str(&format!("  source_distro: {}\n", event.source_distro));
    out.push_str(&format!("  tool_name: {}\n", event.tool_name));
    out.push_str("  tool_input: |\n");
    let pretty =
        serde_json::to_string_pretty(&event.tool_input).unwrap_or_else(|_| "{}".to_string());
    for line in pretty.lines() {
        out.push_str(&format!("    {}\n", line));
    }
    out.push_str(&format!("  timestamp: {}\n", event.timestamp));
    out
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSessionSnapshot {
    pub session_id: String,
    pub turn_count: u32,
    pub workspace_path: PathBuf,
}

#[derive(Debug, Clone)]
struct AgentSessionState {
    session_id: String,
    turn_count: u32,
    workspace_path: PathBuf,
}

/// Singleton agent session. Must only be mutated while holding `agent_mutex()`.
/// `snapshot_session` reads are safe without the mutex, but any pair of
/// operations that rely on consistent state (e.g. check-then-clear) must
/// hold the mutex.
static SESSION: OnceLock<Mutex<Option<AgentSessionState>>> = OnceLock::new();

fn cell() -> &'static Mutex<Option<AgentSessionState>> {
    SESSION.get_or_init(|| Mutex::new(None))
}

pub fn snapshot_session() -> Option<AgentSessionSnapshot> {
    let guard = match cell().lock() {
        Ok(g) => g,
        Err(_poisoned) => {
            log::error!("agent SESSION mutex poisoned; treating as empty");
            return None;
        }
    };
    guard.as_ref().map(|s| AgentSessionSnapshot {
        session_id: s.session_id.clone(),
        turn_count: s.turn_count,
        workspace_path: s.workspace_path.clone(),
    })
}

pub(crate) fn clear_session() {
    let mut guard = match cell().lock() {
        Ok(g) => g,
        Err(poisoned) => {
            log::error!("agent SESSION mutex poisoned; recovering in clear_session");
            let mut inner = poisoned.into_inner();
            *inner = None;
            return;
        }
    };
    *guard = None;
}

/// Returns true if the next call must start fresh (omit `--resume`) because
/// the current session has already reached `turn_limit`.
pub fn should_rollover_before_next_call(turn_limit: u32) -> bool {
    let guard = match cell().lock() {
        Ok(g) => g,
        Err(_poisoned) => {
            log::error!("agent SESSION mutex poisoned; treating as empty");
            return false;
        }
    };
    match guard.as_ref() {
        None => false,
        Some(s) => s.turn_count >= turn_limit,
    }
}

/// Record a completed call. Called by the caller after `run_agent_call` parses
/// a verdict successfully. Starts a new session if `session_id` differs from
/// the current one, otherwise increments turn count.
pub(crate) fn record_turn_with_workspace(session_id: &str, workspace_path: PathBuf) {
    let mut guard = match cell().lock() {
        Ok(g) => g,
        Err(poisoned) => {
            log::error!("agent SESSION mutex poisoned; recovering in record_turn_with_workspace");
            let mut inner = poisoned.into_inner();
            *inner = None;
            inner
        }
    };
    match guard.as_mut() {
        Some(s) if s.session_id == session_id => {
            s.turn_count += 1;
            s.workspace_path = workspace_path;
        }
        _ => {
            *guard = Some(AgentSessionState {
                session_id: session_id.to_string(),
                turn_count: 1,
                workspace_path,
            });
        }
    }
}

/// Global mutex serializing every agent call. Required because `--resume`
/// cannot tolerate concurrent writers on the same session_id.
static AGENT_MUTEX: OnceLock<AsyncMutex<()>> = OnceLock::new();
fn agent_mutex() -> &'static AsyncMutex<()> {
    AGENT_MUTEX.get_or_init(|| AsyncMutex::new(()))
}

#[derive(Debug, thiserror::Error)]
pub enum AgentCallError {
    #[error("agent workspace is not configured")]
    NotConfigured,
    #[error("workspace directory missing: {0}")]
    WorkspaceMissing(String),
    #[error("CLAUDE.md missing at {0}")]
    ClaudeMdMissing(String),
    #[error("failed to spawn claude binary: {0}")]
    SpawnFailed(String),
    #[error("claude binary exited with status {0}: {1}")]
    NonZeroExit(i32, String),
    #[error("agent call timed out after {0}s")]
    Timeout(u32),
    #[error("claude returned malformed envelope JSON: {0}")]
    MalformedEnvelope(String),
    #[error("malformed verdict: {0}")]
    MalformedVerdict(String),
}

/// Shape of `claude -p --output-format json` output.
#[derive(Debug, Deserialize)]
struct ClaudeEnvelope {
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    result: Option<String>,
    #[serde(default)]
    is_error: bool,
    #[serde(default)]
    error: Option<String>,
}

fn resolve_claude_binary() -> Result<std::path::PathBuf, AgentCallError> {
    // Windows CreateProcess does not honor PATHEXT, so we must resolve
    // claude.cmd / claude.exe / claude.bat ourselves before spawning.
    which::which("claude").map_err(|e| {
        AgentCallError::SpawnFailed(format!(
            "claude binary not found on PATH (looked for claude.exe/.cmd/.bat): {}",
            e
        ))
    })
}

/// Spawn the resolved `claude` binary with the stored session_id (or start fresh),
/// parse the envelope, extract the verdict. Caller holds no locks on the agent mutex.
pub async fn run_agent_call(
    prompt: &str,
    workspace: &Path,
    call_timeout_secs: u32,
    turn_limit: u32,
) -> Result<Verdict, AgentCallError> {
    // Validate workspace up front
    if !workspace.is_dir() {
        return Err(AgentCallError::WorkspaceMissing(
            workspace.display().to_string(),
        ));
    }
    if !workspace_has_claude_md(workspace) {
        return Err(AgentCallError::ClaudeMdMissing(
            workspace.display().to_string(),
        ));
    }

    let _permit = agent_mutex().lock().await;

    // Rollover: if already at/over the limit, clear so --resume is omitted.
    if should_rollover_before_next_call(turn_limit) {
        clear_session();
    }
    let resume_id = snapshot_session().map(|s| s.session_id);

    let claude_path = resolve_claude_binary()?;
    let mut cmd = Command::new(&claude_path);
    cmd.arg("-p")
        .arg(prompt)
        .arg("--output-format")
        .arg("json")
        .current_dir(workspace);
    if let Some(id) = resume_id.as_ref() {
        cmd.arg("--resume").arg(id);
    }
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);

    let child_future = cmd.output();
    let output = tokio::time::timeout(Duration::from_secs(call_timeout_secs as u64), child_future)
        .await
        .map_err(|_| AgentCallError::Timeout(call_timeout_secs))?
        .map_err(|e| {
            AgentCallError::SpawnFailed(format!(
                "failed to spawn resolved claude binary at {}: {}",
                claude_path.display(),
                e
            ))
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        log::warn!("agent call non-zero exit: {}", stderr);
        // Post-spawn failure: a broken session shouldn't stick to future --resume.
        clear_session();
        return Err(AgentCallError::NonZeroExit(
            output.status.code().unwrap_or(-1),
            stderr.chars().take(2000).collect::<String>(),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let envelope: ClaudeEnvelope = match serde_json::from_str::<ClaudeEnvelope>(&stdout) {
        Ok(e) => e,
        Err(e) => {
            clear_session();
            return Err(AgentCallError::MalformedEnvelope(e.to_string()));
        }
    };
    if envelope.is_error {
        clear_session();
        return Err(AgentCallError::MalformedEnvelope(
            envelope.error.unwrap_or_else(|| "is_error=true".to_string()),
        ));
    }
    let result_text = match envelope.result {
        Some(r) => r,
        None => {
            clear_session();
            return Err(AgentCallError::MalformedEnvelope(
                "missing 'result' field".into(),
            ));
        }
    };

    let parsed = match verdict::parse_strict(&result_text) {
        Ok(v) => v,
        Err(e) => {
            clear_session();
            return Err(match e {
                VerdictParseError::NotStrictJson => {
                    AgentCallError::MalformedVerdict("not strict JSON".into())
                }
                VerdictParseError::MalformedJson(m) | VerdictParseError::UnknownKind(m) => {
                    AgentCallError::MalformedVerdict(m)
                }
                VerdictParseError::Empty => AgentCallError::MalformedVerdict("empty".into()),
            });
        }
    };

    if let Some(sid) = envelope.session_id {
        record_turn_with_workspace(&sid, workspace.to_path_buf());
    }

    Ok(parsed)
}

/// Download CLAUDE.md from the ALICE repo. Returns the text body on 2xx, error otherwise.
pub async fn download_alice_claude_md() -> Result<String, String> {
    let resp = reqwest::Client::builder()
        .user_agent("golden-apple-island")
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?
        .get(ALICE_URL)
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.text().await.map_err(|e| e.to_string())
}

/// High-level: create (or recreate) the default workspace with a fresh download.
pub async fn install_default_workspace() -> Result<PathBuf, String> {
    let dir = default_workspace_dir();
    if dir.exists() {
        if !is_default_gai_workspace(&dir) {
            return Err(format!(
                "refusing to overwrite {}: not a gai-default workspace",
                dir.display()
            ));
        }
        nuke_default_workspace(&dir).map_err(|e| e.to_string())?;
    }
    let body = download_alice_claude_md().await?;
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
    write_default_workspace(&dir, &body, &now).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[cfg(test)]
pub(crate) fn record_turn(session_id: &str) {
    record_turn_with_workspace(session_id, PathBuf::from("."));
}

#[cfg(test)]
pub(crate) fn reset_session_for_test() {
    clear_session();
}

/// Test-only helper exposed for integration tests (separate crate).
/// Not intended for production use — prefer letting `run_agent_call`
/// manage session state.
#[doc(hidden)]
pub fn clear_session_for_test() {
    clear_session();
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn write_default_workspace_creates_layout() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().join("agent-workspace");
        write_default_workspace(&dir, "# CLAUDE.md\n", "2026-04-16T00:00:00Z").unwrap();
        assert!(dir.join("CLAUDE.md").is_file());
        assert!(dir.join(".claude/settings.json").is_file());
        assert!(dir.join(MARKER_FILENAME).is_file());
        assert!(is_default_gai_workspace(&dir));
        assert!(workspace_has_claude_md(&dir));
    }

    #[test]
    fn is_default_gai_workspace_rejects_missing_marker() {
        let tmp = TempDir::new().unwrap();
        assert!(!is_default_gai_workspace(tmp.path()));
    }

    #[test]
    fn is_default_gai_workspace_rejects_wrong_source() {
        let tmp = TempDir::new().unwrap();
        fs::write(
            tmp.path().join(MARKER_FILENAME),
            r#"{"source":"user","downloaded_at":"x","alice_url":""}"#,
        )
        .unwrap();
        assert!(!is_default_gai_workspace(tmp.path()));
    }

    #[test]
    fn nuke_default_workspace_refuses_non_default() {
        let tmp = TempDir::new().unwrap();
        // No marker → non-default → must error
        let err = nuke_default_workspace(tmp.path()).unwrap_err();
        assert_eq!(err.kind(), std::io::ErrorKind::PermissionDenied);
    }

    #[test]
    fn nuke_default_workspace_removes_marked_dir() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().join("agent-workspace");
        write_default_workspace(&dir, "# x\n", "2026-04-16T00:00:00Z").unwrap();
        nuke_default_workspace(&dir).unwrap();
        assert!(!dir.exists());
    }

    #[test]
    fn build_prompt_renders_bash_event_yaml_ish() {
        use crate::ws::HookEvent;
        let event = HookEvent {
            r#type: "hook_event".into(),
            id: "evt_1".into(),
            session_id: "sess_def456".into(),
            session_cwd: "/home/linearkf/projects/my-app".into(),
            source_distro: "Ubuntu".into(),
            hook_type: "pre_tool_use".into(),
            tool_name: "bash".into(),
            tool_input: serde_json::json!({ "command": "rm -rf ./dist && npm run build" }),
            timestamp: "2026-04-16T10:30:00Z".into(),
            resolved_kind: None,
            resolved_scope: None,
            delegation_banner: None,
        };
        let prompt = build_prompt(&event);
        assert!(prompt.contains("session_id: sess_def456"));
        assert!(prompt.contains("source_distro: Ubuntu"));
        assert!(prompt.contains("tool_name: bash"));
        assert!(prompt.contains("tool_input: |"));
        assert!(prompt.contains("\"command\""));
        assert!(prompt.contains("rm -rf ./dist"));
    }

    #[test]
    fn build_prompt_handles_write_event_with_content() {
        use crate::ws::HookEvent;
        let event = HookEvent {
            r#type: "hook_event".into(),
            id: "evt_2".into(),
            session_id: "s".into(),
            session_cwd: "/w".into(),
            source_distro: "windows".into(),
            hook_type: "pre_tool_use".into(),
            tool_name: "write".into(),
            tool_input: serde_json::json!({
                "file_path": "src/x.ts",
                "content": "line1\nline2\n",
            }),
            timestamp: "2026-04-16T00:00:00Z".into(),
            resolved_kind: None,
            resolved_scope: None,
            delegation_banner: None,
        };
        let prompt = build_prompt(&event);
        assert!(prompt.contains("tool_name: write"));
        assert!(prompt.contains("tool_input: |"));
        assert!(prompt.contains("\"file_path\""));
        assert!(prompt.contains("\"src/x.ts\""));
        assert!(prompt.contains("\"content\""));
        assert!(prompt.contains("line1\\nline2\\n"));
    }

    #[test]
    fn build_prompt_handles_nested_tool_input() {
        use crate::ws::HookEvent;
        let event = HookEvent {
            r#type: "hook_event".into(),
            id: "evt_nested".into(),
            session_id: "s".into(),
            session_cwd: "/w".into(),
            source_distro: "Ubuntu".into(),
            hook_type: "pre_tool_use".into(),
            tool_name: "multi_edit".into(),
            tool_input: serde_json::json!({
                "file_path": "src/x.ts",
                "edits": [
                    { "old_string": "first\nline", "new_string": "replaced" },
                    { "old_string": "other", "new_string": "also" }
                ]
            }),
            timestamp: "2026-04-16T00:00:00Z".into(),
            resolved_kind: None,
            resolved_scope: None,
            delegation_banner: None,
        };
        let prompt = build_prompt(&event);
        assert!(prompt.contains("tool_input: |"));
        assert!(prompt.contains("\"edits\""));
        assert!(prompt.contains("\"old_string\""));
        // Pretty JSON indentation preserved under the block scalar
        assert!(prompt.contains("    {\n"));
    }

    #[test]
    fn agent_session_cycles_at_turn_limit() {
        reset_session_for_test();
        record_turn("sess_aaa");
        record_turn("sess_aaa");
        record_turn("sess_aaa");
        let snap = snapshot_session().unwrap();
        assert_eq!(snap.session_id, "sess_aaa");
        assert_eq!(snap.turn_count, 3);

        // turn limit 3 → next recorded turn means "rolled over"
        assert!(should_rollover_before_next_call(3));
        // turn limit 10 → not yet
        assert!(!should_rollover_before_next_call(10));
    }

    #[test]
    fn reset_session_clears_state() {
        reset_session_for_test();
        record_turn("sess_x");
        clear_session();
        assert!(snapshot_session().is_none());
    }
}
