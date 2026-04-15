use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

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

use crate::ws::HookEvent;

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
    out.push_str("  tool_input:\n");
    render_tool_input(&mut out, &event.tool_input, 4);
    out.push_str(&format!("  timestamp: {}\n", event.timestamp));
    out
}

fn render_tool_input(out: &mut String, value: &serde_json::Value, indent: usize) {
    let pad = " ".repeat(indent);
    match value {
        serde_json::Value::Object(map) => {
            for (k, v) in map {
                match v {
                    serde_json::Value::String(s) if s.contains('\n') || s.len() > 20 => {
                        out.push_str(&format!("{}{}: |\n", pad, k));
                        for line in s.lines() {
                            out.push_str(&format!("{}  {}\n", pad, line));
                        }
                    }
                    serde_json::Value::String(s) => {
                        out.push_str(&format!("{}{}: {}\n", pad, k, s));
                    }
                    other => {
                        out.push_str(&format!("{}{}: {}\n", pad, k, other));
                    }
                }
            }
        }
        other => {
            out.push_str(&format!("{}{}\n", pad, other));
        }
    }
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
        };
        let prompt = build_prompt(&event);
        assert!(prompt.contains("session_id: sess_def456"));
        assert!(prompt.contains("source_distro: Ubuntu"));
        assert!(prompt.contains("tool_name: bash"));
        assert!(prompt.contains("rm -rf ./dist"));
        // Literal block scalar for commands
        assert!(prompt.contains("command: |"));
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
        };
        let prompt = build_prompt(&event);
        assert!(prompt.contains("tool_name: write"));
        assert!(prompt.contains("file_path: src/x.ts"));
        assert!(prompt.contains("content: |"));
        assert!(prompt.contains("line1"));
    }
}
