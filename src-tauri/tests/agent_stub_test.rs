//! End-to-end test for `agent_approve::run_agent_call` with a stub claude.exe.
//!
//! Windows-only: `run_agent_call` spawns literally `claude.exe`, so on Windows
//! we place a shim by that name first on PATH. On other OSes this test is a
//! no-op.

#![cfg(target_os = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use golden_apple_island_lib::agent_approve::{self, AgentCallError};
use golden_apple_island_lib::verdict::VerdictKind;
use tempfile::TempDir;

// Serializes mutation of global PATH + global AGENT_MUTEX across tests.
static TEST_LOCK: Mutex<()> = Mutex::new(());

/// Compile a tiny Rust stub into `<dir>/claude.exe` that prints a fixed JSON
/// blob (passed via the `GAI_STUB_ENVELOPE` env var at runtime) to stdout and
/// exits 0. This sidesteps the Windows `.cmd` vs `.exe` PATHEXT problem: the
/// production code spawns literally `claude.exe`, so the stub must also be an
/// actual `.exe`.
fn build_stub_exe(dir: &Path) -> PathBuf {
    let src_path = dir.join("claude_stub.rs");
    // The stub reads the envelope from an env var so a single compiled binary
    // can serve every test case.
    fs::write(
        &src_path,
        r#"fn main() {
    let env = std::env::var("GAI_STUB_ENVELOPE").unwrap_or_default();
    println!("{}", env);
}
"#,
    )
    .unwrap();

    let exe_path = dir.join("claude.exe");
    let status = std::process::Command::new("rustc")
        .arg(&src_path)
        .arg("-o")
        .arg(&exe_path)
        .arg("--edition=2021")
        .arg("-C")
        .arg("opt-level=0")
        .status()
        .expect("rustc failed to run");
    assert!(status.success(), "rustc failed to compile stub");
    exe_path
}

fn make_workspace(dir: &Path) -> PathBuf {
    let ws = dir.join("ws");
    agent_approve::write_default_workspace(&ws, "# test\n", "2026-04-16T00:00:00Z").unwrap();
    ws
}

/// Prepend `extra` to PATH for the scope of `f`, then restore.
/// The provided closure runs synchronously; caller owns any `.await` outside.
fn push_path(extra: &Path) -> (std::ffi::OsString, ()) {
    let original = std::env::var_os("PATH").unwrap_or_default();
    let mut parts: Vec<PathBuf> = vec![extra.to_path_buf()];
    parts.extend(std::env::split_paths(&original));
    let new = std::env::join_paths(parts).unwrap();
    std::env::set_var("PATH", &new);
    (original, ())
}

fn restore_path(original: std::ffi::OsString) {
    std::env::set_var("PATH", original);
}

#[tokio::test]
async fn approve_happy_path() {
    let _guard = TEST_LOCK.lock().unwrap();
    let tmp = TempDir::new().unwrap();
    let ws = make_workspace(tmp.path());
    build_stub_exe(tmp.path());

    // Envelope's `result` is itself a JSON string (stringified verdict).
    let envelope = serde_json::json!({
        "session_id": "sess_fresh",
        "result": "{\"verdict\":\"approve\",\"reason\":\"ok\"}",
    })
    .to_string();
    std::env::set_var("GAI_STUB_ENVELOPE", &envelope);

    agent_approve::clear_session();
    let (orig, _) = push_path(tmp.path());
    let result = agent_approve::run_agent_call("prompt", &ws, 30, 20).await;
    restore_path(orig);
    std::env::remove_var("GAI_STUB_ENVELOPE");

    let verdict = result.expect("run_agent_call should approve");
    assert_eq!(verdict.verdict, VerdictKind::Approve);

    let snap = agent_approve::snapshot_session().unwrap();
    assert_eq!(snap.session_id, "sess_fresh");
    assert_eq!(snap.turn_count, 1);
}

#[tokio::test]
async fn missing_claude_md_errors_before_spawn() {
    let _guard = TEST_LOCK.lock().unwrap();
    let tmp = TempDir::new().unwrap();
    let ws = tmp.path().join("empty-ws");
    fs::create_dir_all(&ws).unwrap();
    let result = agent_approve::run_agent_call("prompt", &ws, 10, 20).await;
    assert!(matches!(result, Err(AgentCallError::ClaudeMdMissing(_))));
}

#[tokio::test]
async fn malformed_verdict_surfaces_as_error() {
    let _guard = TEST_LOCK.lock().unwrap();
    let tmp = TempDir::new().unwrap();
    let ws = make_workspace(tmp.path());
    build_stub_exe(tmp.path());

    // Envelope OK but `result` is prose, not strict JSON.
    let envelope = serde_json::json!({
        "session_id": "sess_a",
        "result": "Sure! approve",
    })
    .to_string();
    std::env::set_var("GAI_STUB_ENVELOPE", &envelope);

    agent_approve::clear_session();
    let (orig, _) = push_path(tmp.path());
    let result = agent_approve::run_agent_call("prompt", &ws, 30, 20).await;
    restore_path(orig);
    std::env::remove_var("GAI_STUB_ENVELOPE");

    assert!(matches!(result, Err(AgentCallError::MalformedVerdict(_))));
}
