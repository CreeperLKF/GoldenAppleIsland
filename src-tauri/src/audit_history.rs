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
/// Slices on a UTF-8 char boundary so multibyte characters never split.
pub fn truncate_tool_input(mut v: serde_json::Value) -> serde_json::Value {
    if let Some(obj) = v.as_object_mut() {
        for (_, val) in obj.iter_mut() {
            if let Some(s) = val.as_str() {
                if s.len() > MAX_FIELD_BYTES {
                    let mut cut = MAX_FIELD_BYTES;
                    while cut > 0 && !s.is_char_boundary(cut) {
                        cut -= 1;
                    }
                    let kept = &s[..cut];
                    let extra = s.len() - cut;
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
    Agent,
    External,
}

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::OnceLock;
use std::time::Duration;

use tokio::sync::Mutex;

struct Store {
    index: Mutex<AuditIndex>,
}

static STORE: OnceLock<Store> = OnceLock::new();

fn store() -> &'static Store {
    STORE.get_or_init(|| Store {
        index: Mutex::new(load_index()),
    })
}

fn load_index() -> AuditIndex {
    match fs::read_to_string(index_path()) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => AuditIndex::default(),
    }
}

fn save_index(index: &AuditIndex) -> std::io::Result<()> {
    let p = index_path();
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(index)?;
    let tmp = p.with_extension("json.tmp");
    fs::write(&tmp, json.as_bytes())?;
    fs::rename(&tmp, &p)?;
    Ok(())
}

/// Schedule a debounced flush of the index to disk. A 500 ms timer is reset
/// on every call so bursts coalesce into a single rewrite.
fn schedule_flush() {
    use std::sync::atomic::{AtomicU64, Ordering};
    static GEN: AtomicU64 = AtomicU64::new(0);
    let my_gen = GEN.fetch_add(1, Ordering::SeqCst) + 1;
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(500)).await;
        if GEN.load(Ordering::SeqCst) != my_gen {
            return; // a newer schedule superseded us
        }
        let guard = store().index.lock().await;
        if let Err(e) = save_index(&guard) {
            log::warn!("audit_history: failed to flush index: {}", e);
        }
    });
}

fn append_jsonl(folder: &str, session_id: &str, record: &EventRecord) -> std::io::Result<()> {
    let dir = folder_dir(folder);
    fs::create_dir_all(&dir)?;
    let path = session_path(folder, session_id);
    let mut f = OpenOptions::new().create(true).append(true).open(path)?;
    let line = serde_json::to_string(record)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    f.write_all(line.as_bytes())?;
    f.write_all(b"\n")?;
    Ok(())
}

fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

fn display_name_for(cwd: &str) -> String {
    std::path::Path::new(cwd)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| cwd.to_string())
}

impl Decision {
    fn as_str(self) -> &'static str {
        match self {
            Decision::Approve => "approve",
            Decision::Deny => "deny",
            Decision::Observed => "observed",
        }
    }
}

impl DecisionSource {
    fn as_str(self) -> &'static str {
        match self {
            DecisionSource::User => "user",
            DecisionSource::Policy => "policy",
            DecisionSource::Force => "force",
            DecisionSource::Auto => "auto",
            DecisionSource::Agent => "agent",
            DecisionSource::External => "external",
        }
    }
}

async fn record_inner(
    event: &HookEvent,
    decision: Decision,
    source: DecisionSource,
    answer: Option<String>,
) {
    let settings = crate::app_settings::get();
    if !settings.audit_history_enabled {
        return;
    }

    let folder = folder_hash(&event.session_cwd);
    let record = EventRecord {
        id: event.id.clone(),
        ts: event.timestamp.clone(),
        hook_type: event.hook_type.clone(),
        tool_name: event.tool_name.clone(),
        tool_input: truncate_tool_input(event.tool_input.clone()),
        decision: decision.as_str().to_string(),
        decision_source: source.as_str().to_string(),
        answer,
        session_mode: None,
    };

    if let Err(e) = append_jsonl(&folder, &event.session_id, &record) {
        log::warn!("audit_history: append jsonl failed: {}", e);
        return;
    }

    let cap = settings.max_dynamic_sessions;
    let now = now_iso();
    let display = display_name_for(&event.session_cwd);
    let cwd = event.session_cwd.clone();
    let session_id = event.session_id.clone();

    let mut guard = store().index.lock().await;

    let folder_meta = guard.folders.entry(folder.clone()).or_insert_with(|| FolderMeta {
        cwd,
        display_name: display,
        ..FolderMeta::default()
    });

    let is_new_session = !folder_meta.sessions.contains_key(&session_id);
    let session = folder_meta
        .sessions
        .entry(session_id.clone())
        .or_insert_with(|| SessionMeta {
            first_seen: now.clone(),
            last_activity: now.clone(),
            event_count: 0,
            pinned: false,
            fixed: false,
        });
    session.last_activity = now;
    session.event_count += 1;

    rebuild_fixed(&mut guard);

    if is_new_session {
        evict_if_needed(&mut guard, cap);
    }

    drop(guard);
    schedule_flush();
}

/// Evict oldest non-fixed sessions until we are under the cap. Deletes the
/// backing JSONL file for each evicted session.
fn evict_if_needed(index: &mut AuditIndex, cap: u32) {
    let count_dynamic = |idx: &AuditIndex| -> usize {
        idx.folders
            .values()
            .flat_map(|f| f.sessions.values())
            .filter(|s| !s.fixed)
            .count()
    };

    while count_dynamic(index) > cap as usize {
        // Find (folder, session) with oldest last_activity among non-fixed.
        let oldest = index
            .folders
            .iter()
            .flat_map(|(fh, f)| {
                f.sessions
                    .iter()
                    .filter(|(_, s)| !s.fixed)
                    .map(move |(sid, s)| (fh.clone(), sid.clone(), s.last_activity.clone()))
            })
            .min_by(|a, b| a.2.cmp(&b.2));
        let Some((fh, sid, _)) = oldest else { break };
        let _ = fs::remove_file(session_path(&fh, &sid));
        if let Some(folder) = index.folders.get_mut(&fh) {
            folder.sessions.remove(&sid);
        }
    }
}

pub async fn get_index() -> AuditIndex {
    store().index.lock().await.clone()
}

pub async fn set_folder_pinned(folder_hash: &str, pinned: bool) {
    let mut guard = store().index.lock().await;
    if let Some(f) = guard.folders.get_mut(folder_hash) {
        f.pinned = pinned;
    }
    rebuild_fixed(&mut guard);
    drop(guard);
    schedule_flush();
}

pub async fn set_session_pinned(folder_hash: &str, session_id: &str, pinned: bool) {
    let mut guard = store().index.lock().await;
    if let Some(f) = guard.folders.get_mut(folder_hash) {
        if let Some(s) = f.sessions.get_mut(session_id) {
            s.pinned = pinned;
        }
    }
    rebuild_fixed(&mut guard);
    drop(guard);
    schedule_flush();
}

pub async fn delete_session(folder_hash: &str, session_id: &str) {
    let _ = fs::remove_file(session_path(folder_hash, session_id));
    let mut guard = store().index.lock().await;
    if let Some(f) = guard.folders.get_mut(folder_hash) {
        f.sessions.remove(session_id);
    }
    drop(guard);
    schedule_flush();
}

pub async fn delete_folder(folder_hash: &str) {
    let _ = fs::remove_dir_all(folder_dir(folder_hash));
    let mut guard = store().index.lock().await;
    guard.folders.remove(folder_hash);
    drop(guard);
    schedule_flush();
}

pub async fn set_max_dynamic_sessions(cap: u32) {
    let mut guard = store().index.lock().await;
    guard.max_dynamic_sessions = cap;
    rebuild_fixed(&mut guard);
    evict_if_needed(&mut guard, cap);
    drop(guard);
    schedule_flush();
}

pub fn read_session_records(folder_hash: &str, session_id: &str) -> Vec<EventRecord> {
    let path = session_path(folder_hash, session_id);
    let Ok(content) = fs::read_to_string(path) else { return Vec::new() };
    content
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str::<EventRecord>(l).ok())
        .collect()
}

pub async fn record_blocking(
    event: &HookEvent,
    decision: Decision,
    source: DecisionSource,
    answer: Option<String>,
) {
    record_inner(event, decision, source, answer).await;
}

pub async fn record_observational(event: &HookEvent) {
    record_inner(event, Decision::Observed, DecisionSource::Auto, None).await;
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

    #[test]
    fn truncate_tool_input_respects_utf8_boundary() {
        // 64 KiB of two-byte characters (Cyrillic 'я' = 0xD1 0x8F) plus padding.
        // Cap is MAX_FIELD_BYTES = 65536. A naive byte-slice would land mid-char.
        let big = "я".repeat((MAX_FIELD_BYTES / 2) + 100);
        assert!(big.len() > MAX_FIELD_BYTES);
        let input = serde_json::json!({ "content": big });
        // Must not panic.
        let out = truncate_tool_input(input);
        let s = out.get("content").unwrap().as_str().unwrap();
        // The kept prefix must be valid UTF-8 (already guaranteed by `as_str`).
        assert!(s.contains("…[truncated"));
    }

    #[test]
    fn evict_drops_oldest_non_fixed_first() {
        let mut idx = AuditIndex::default();
        idx.max_dynamic_sessions = 2;
        let mut folder = FolderMeta::default();
        folder.cwd = "/tmp/a".into();
        folder.display_name = "a".into();
        folder.sessions.insert(
            "old".into(),
            SessionMeta {
                first_seen: "2020-01-01T00:00:00Z".into(),
                last_activity: "2020-01-01T00:00:00Z".into(),
                ..SessionMeta::default()
            },
        );
        folder.sessions.insert(
            "mid".into(),
            SessionMeta {
                first_seen: "2021-01-01T00:00:00Z".into(),
                last_activity: "2021-01-01T00:00:00Z".into(),
                pinned: true,
                ..SessionMeta::default()
            },
        );
        folder.sessions.insert(
            "new".into(),
            SessionMeta {
                first_seen: "2022-01-01T00:00:00Z".into(),
                last_activity: "2022-01-01T00:00:00Z".into(),
                ..SessionMeta::default()
            },
        );
        idx.folders.insert("fh".into(), folder);
        rebuild_fixed(&mut idx);
        // cap=1: two non-fixed sessions (old, new) exceeds the cap by one,
        // so the oldest non-fixed ("old") must be evicted.
        evict_if_needed(&mut idx, 1);
        let f = idx.folders.get("fh").unwrap();
        assert!(!f.sessions.contains_key("old"), "old should be evicted");
        assert!(f.sessions.contains_key("mid"), "pinned stays");
        assert!(f.sessions.contains_key("new"));
    }
}
