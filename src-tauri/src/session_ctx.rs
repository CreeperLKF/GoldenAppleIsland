use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

const CAPACITY: usize = 64;

#[derive(Clone, Debug)]
pub struct SessionContext {
    pub start_cwd_normalized: String,
    pub distro: String,
    /// Milliseconds since UNIX epoch, monotonically increasing on each touch.
    pub last_seen_at_ms: u128,
}

#[derive(Clone, Debug)]
pub struct SessionSummary {
    pub session_id: String,
    pub start_cwd_normalized: String,
    pub distro: String,
    pub last_seen_at_ms: u128,
}

static TABLE: OnceLock<RwLock<HashMap<String, SessionContext>>> = OnceLock::new();

fn table() -> &'static RwLock<HashMap<String, SessionContext>> {
    TABLE.get_or_init(|| RwLock::new(HashMap::new()))
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Insert a new session if absent, or refresh `last_seen_at_ms` if present.
/// Never overwrites `start_cwd_normalized` / `distro` once they're set.
pub fn touch(session_id: &str, start_cwd_normalized: &str, distro: &str) {
    let mut map = table().write().expect("session_ctx poisoned");

    if let Some(existing) = map.get_mut(session_id) {
        existing.last_seen_at_ms = now_ms();
        return;
    }

    if map.len() >= CAPACITY {
        if let Some(oldest_key) = map
            .iter()
            .min_by_key(|(_, v)| v.last_seen_at_ms)
            .map(|(k, _)| k.clone())
        {
            map.remove(&oldest_key);
        }
    }

    map.insert(
        session_id.to_string(),
        SessionContext {
            start_cwd_normalized: start_cwd_normalized.to_string(),
            distro: distro.to_string(),
            last_seen_at_ms: now_ms(),
        },
    );
}

pub fn get(session_id: &str) -> Option<SessionContext> {
    table()
        .read()
        .expect("session_ctx poisoned")
        .get(session_id)
        .cloned()
}

/// Return up to `limit` sessions sorted by `last_seen_at_ms` desc.
pub fn recent(limit: usize) -> Vec<SessionSummary> {
    let map = table().read().expect("session_ctx poisoned");
    let mut rows: Vec<SessionSummary> = map
        .iter()
        .map(|(k, v)| SessionSummary {
            session_id: k.clone(),
            start_cwd_normalized: v.start_cwd_normalized.clone(),
            distro: v.distro.clone(),
            last_seen_at_ms: v.last_seen_at_ms,
        })
        .collect();
    rows.sort_by(|a, b| b.last_seen_at_ms.cmp(&a.last_seen_at_ms));
    rows.truncate(limit);
    rows
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Serialize tests because they share the global TABLE.
    fn lock() -> std::sync::MutexGuard<'static, ()> {
        static L: OnceLock<Mutex<()>> = OnceLock::new();
        L.get_or_init(|| Mutex::new(())).lock().unwrap()
    }

    fn reset() {
        table().write().unwrap().clear();
    }

    #[test]
    fn touch_inserts_new_session() {
        let _g = lock();
        reset();
        touch("sess_a", "c:\\work", "windows");
        let ctx = get("sess_a").expect("should exist");
        assert_eq!(ctx.start_cwd_normalized, "c:\\work");
        assert_eq!(ctx.distro, "windows");
        assert!(ctx.last_seen_at_ms > 0);
    }

    #[test]
    fn touch_does_not_overwrite_start_cwd() {
        let _g = lock();
        reset();
        touch("sess_a", "c:\\work\\proj", "windows");
        touch("sess_a", "c:\\work\\proj\\sub", "windows");
        let ctx = get("sess_a").unwrap();
        assert_eq!(ctx.start_cwd_normalized, "c:\\work\\proj");
    }

    #[test]
    fn touch_refreshes_last_seen() {
        let _g = lock();
        reset();
        touch("sess_a", "c:\\x", "windows");
        let first = get("sess_a").unwrap().last_seen_at_ms;
        std::thread::sleep(std::time::Duration::from_millis(5));
        touch("sess_a", "c:\\x", "windows");
        let second = get("sess_a").unwrap().last_seen_at_ms;
        assert!(second >= first);
    }

    #[test]
    fn lru_evicts_oldest_over_capacity() {
        let _g = lock();
        reset();
        for i in 0..(CAPACITY + 5) {
            touch(&format!("sess_{}", i), "c:\\x", "windows");
            std::thread::sleep(std::time::Duration::from_millis(1));
        }
        assert_eq!(table().read().unwrap().len(), CAPACITY);
        for i in 0..5 {
            assert!(get(&format!("sess_{}", i)).is_none(), "expected sess_{} evicted", i);
        }
        assert!(get(&format!("sess_{}", CAPACITY + 4)).is_some());
    }

    #[test]
    fn recent_returns_newest_first_capped() {
        let _g = lock();
        reset();
        touch("a", "c:\\a", "windows");
        std::thread::sleep(std::time::Duration::from_millis(2));
        touch("b", "c:\\b", "windows");
        std::thread::sleep(std::time::Duration::from_millis(2));
        touch("c", "c:\\c", "windows");

        let out = recent(2);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].session_id, "c");
        assert_eq!(out[1].session_id, "b");
    }
}
