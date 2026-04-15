use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};

use crate::ws::HookEvent;

pub const MAX_FIELD_BYTES: usize = 64 * 1024;
pub const DEFAULT_MAX_DYNAMIC_SESSIONS: u32 = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventRecord {
    pub id: String,
    pub ts: String,
    pub hook_type: String,
    pub tool_name: String,
    pub tool_input: serde_json::Value,
    pub decision: String,         // approve | deny | observed
    pub decision_source: String,  // user | policy | force | auto
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_mode: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SessionMeta {
    pub first_seen: String,
    pub last_activity: String,
    pub event_count: u64,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub fixed: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FolderMeta {
    pub cwd: String,
    pub display_name: String,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub sessions: BTreeMap<String, SessionMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditIndex {
    pub version: u32,
    pub max_dynamic_sessions: u32,
    #[serde(default)]
    pub folders: BTreeMap<String, FolderMeta>,
}

impl Default for AuditIndex {
    fn default() -> Self {
        Self {
            version: 1,
            max_dynamic_sessions: DEFAULT_MAX_DYNAMIC_SESSIONS,
            folders: BTreeMap::new(),
        }
    }
}

pub fn folder_hash(cwd: &str) -> String {
    let mut h = Sha1::new();
    h.update(cwd.as_bytes());
    let digest = h.finalize();
    let hex: String = digest.iter().map(|b| format!("{:02x}", b)).collect();
    hex.chars().take(16).collect()
}

pub fn base_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("golden-apple-island").join("audit_history")
}

pub fn folder_dir(folder_hash: &str) -> PathBuf {
    base_dir().join(folder_hash)
}

pub fn session_path(folder_hash: &str, session_id: &str) -> PathBuf {
    folder_dir(folder_hash).join(format!("{}.jsonl", session_id))
}

pub fn index_path() -> PathBuf {
    base_dir().join("index.json")
}

/// Truncate any top-level string field of `tool_input` that exceeds 64 KiB.
pub fn truncate_tool_input(mut v: serde_json::Value) -> serde_json::Value {
    if let Some(obj) = v.as_object_mut() {
        for (_, val) in obj.iter_mut() {
            if let Some(s) = val.as_str() {
                if s.len() > MAX_FIELD_BYTES {
                    let kept = &s[..MAX_FIELD_BYTES];
                    let extra = s.len() - MAX_FIELD_BYTES;
                    *val = serde_json::Value::String(format!("{} …[truncated {} bytes]", kept, extra));
                }
            }
        }
    }
    v
}

/// Derive the `fixed` flag for every session based on current pin state.
pub fn rebuild_fixed(index: &mut AuditIndex) {
    for (_, f) in index.folders.iter_mut() {
        let folder_pinned = f.pinned;
        for (_, s) in f.sessions.iter_mut() {
            s.fixed = folder_pinned || s.pinned;
        }
    }
}

// ============================================================
// Task 10 stubs — preserved verbatim so ws.rs continues to compile.
// Task 12 replaces these with real implementations.
// ============================================================

#[derive(Debug, Clone, Copy)]
pub enum Decision {
    Approve,
    Deny,
    Observed,
}

#[derive(Debug, Clone, Copy)]
pub enum DecisionSource {
    User,
    Policy,
    Force,
    Auto,
}

pub async fn record_blocking(
    _event: &HookEvent,
    _decision: Decision,
    _source: DecisionSource,
    _answer: Option<String>,
) {
    // Stub — real implementation lands in Task 12.
}

pub async fn record_observational(_event: &HookEvent) {
    // Stub — real implementation lands in Task 12.
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn folder_hash_is_stable_and_16_chars() {
        let a = folder_hash("/home/me/project");
        let b = folder_hash("/home/me/project");
        assert_eq!(a, b);
        assert_eq!(a.len(), 16);
        assert_ne!(folder_hash("/home/me/other"), a);
    }

    #[test]
    fn truncate_tool_input_caps_large_string_fields() {
        let big = "x".repeat(MAX_FIELD_BYTES + 100);
        let input = json!({ "content": big, "other": "small" });
        let out = truncate_tool_input(input);
        let s = out.get("content").unwrap().as_str().unwrap();
        assert!(s.len() < MAX_FIELD_BYTES + 200);
        assert!(s.contains("…[truncated 100 bytes]"));
        assert_eq!(out.get("other").unwrap().as_str().unwrap(), "small");
    }

    #[test]
    fn rebuild_fixed_cascades_folder_pin_to_sessions() {
        let mut idx = AuditIndex::default();
        let mut folder = FolderMeta::default();
        folder.pinned = true;
        folder.sessions.insert("s1".into(), SessionMeta::default());
        folder.sessions.insert(
            "s2".into(),
            SessionMeta { pinned: true, ..SessionMeta::default() },
        );
        idx.folders.insert("fh".into(), folder);
        rebuild_fixed(&mut idx);
        let f = idx.folders.get("fh").unwrap();
        assert!(f.sessions.get("s1").unwrap().fixed);
        assert!(f.sessions.get("s2").unwrap().fixed);
    }

    #[test]
    fn rebuild_fixed_respects_session_pin_only() {
        let mut idx = AuditIndex::default();
        let mut folder = FolderMeta::default();
        folder.pinned = false;
        folder.sessions.insert("s1".into(), SessionMeta::default());
        folder.sessions.insert(
            "s2".into(),
            SessionMeta { pinned: true, ..SessionMeta::default() },
        );
        idx.folders.insert("fh".into(), folder);
        rebuild_fixed(&mut idx);
        let f = idx.folders.get("fh").unwrap();
        assert!(!f.sessions.get("s1").unwrap().fixed);
        assert!(f.sessions.get("s2").unwrap().fixed);
    }
}
