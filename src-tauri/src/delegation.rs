//! In-flight delegation table.
//!
//! Every Agent or External approval call that is currently running has an
//! entry keyed by the originating hook event id. The entry owns the
//! cancellation channel for the spawned Tokio task so that `take_over`
//! can force the call to unwind and hand the event back to the manual
//! queue.

use std::sync::{Arc, OnceLock};
use std::time::SystemTime;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DelegationKind {
    Agent,
    External,
}

pub struct DelegationHandle {
    pub kind: DelegationKind,
    pub cancel_tx: oneshot::Sender<()>,
    pub started_at: SystemTime,
}

#[derive(Debug, Clone, Serialize)]
pub struct DelegatedSummary {
    pub event_id: String,
    pub kind: DelegationKind,
    pub started_at_ms: u128,
}

type Map = Arc<DashMap<String, DelegationHandle>>;
static DELEGATED: OnceLock<Map> = OnceLock::new();

fn cell() -> &'static Map {
    DELEGATED.get_or_init(|| Arc::new(DashMap::new()))
}

pub fn insert(event_id: String, handle: DelegationHandle) {
    cell().insert(event_id, handle);
}

pub fn remove(event_id: &str) -> Option<DelegationHandle> {
    cell().remove(event_id).map(|(_, v)| v)
}

#[allow(dead_code)]
pub fn snapshot() -> Vec<DelegatedSummary> {
    cell()
        .iter()
        .map(|e| DelegatedSummary {
            event_id: e.key().clone(),
            kind: e.value().kind,
            started_at_ms: e
                .value()
                .started_at
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0),
        })
        .collect()
}
