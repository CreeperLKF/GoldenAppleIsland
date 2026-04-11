use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use std::sync::OnceLock;

use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use tokio::net::TcpListener;
use tokio::sync::{mpsc, Mutex};
use tokio::time::timeout;
use tokio_tungstenite::tungstenite::Message;

const BIND_ADDR: &str = "127.0.0.1:9876";
const RESPONSE_TIMEOUT_SECS: u64 = 300;

static CLIENT_COUNT: AtomicUsize = AtomicUsize::new(0);

struct ClientGuard {
    app: AppHandle,
}

impl ClientGuard {
    fn new(app: AppHandle) -> Self {
        let n = CLIENT_COUNT.fetch_add(1, Ordering::SeqCst) + 1;
        emit_connection_count(&app, n);
        Self { app }
    }
}

impl Drop for ClientGuard {
    fn drop(&mut self) {
        let n = CLIENT_COUNT.fetch_sub(1, Ordering::SeqCst).saturating_sub(1);
        emit_connection_count(&self.app, n);
    }
}

fn emit_connection_count(app: &AppHandle, count: usize) {
    if let Err(e) = app.emit("connection_changed", json!({ "count": count })) {
        log::warn!("emit connection_changed failed: {}", e);
    }
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct HookEvent {
    pub r#type: String,
    pub id: String,
    pub session_id: String,
    pub session_cwd: String,
    pub hook_type: String,
    pub tool_name: String,
    pub tool_input: serde_json::Value,
    pub timestamp: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct HookResponse {
    pub r#type: &'static str,
    pub id: String,
    pub action: String,
}

type PendingMap = Arc<DashMap<String, mpsc::Sender<HookResponse>>>;
type QueueMap = Arc<DashMap<String, HookEvent>>;

static PENDING: OnceLock<PendingMap> = OnceLock::new();
static QUEUE: OnceLock<QueueMap> = OnceLock::new();

fn pending() -> &'static PendingMap {
    PENDING.get_or_init(|| Arc::new(DashMap::new()))
}

fn queue() -> &'static QueueMap {
    QUEUE.get_or_init(|| Arc::new(DashMap::new()))
}

pub fn snapshot_queue() -> Vec<HookEvent> {
    queue().iter().map(|e| e.value().clone()).collect()
}

pub async fn send_response(id: String, action: String) {
    queue().remove(&id);
    let Some((_, tx)) = pending().remove(&id) else {
        log::warn!("send_response: no pending entry for id {}", id);
        return;
    };
    let resp = HookResponse {
        r#type: "hook_response",
        id,
        action,
    };
    if let Err(e) = tx.send(resp).await {
        log::warn!("send_response: failed to forward response: {}", e);
    }
}

pub async fn serve(app: AppHandle) {
    emit_connection_count(&app, 0);

    let listener = match TcpListener::bind(BIND_ADDR).await {
        Ok(l) => l,
        Err(e) => {
            log::error!("failed to bind {}: {}", BIND_ADDR, e);
            return;
        }
    };
    log::info!("Claude Hook Guard WS listening on {}", BIND_ADDR);

    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                log::info!("client connected: {}", addr);
                let app = app.clone();
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(stream, app).await {
                        log::warn!("connection ended with error: {}", e);
                    }
                });
            }
            Err(e) => {
                log::warn!("accept error: {}", e);
            }
        }
    }
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    app: AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _guard = ClientGuard::new(app.clone());

    let ws_stream = tokio_tungstenite::accept_async(stream).await?;
    let (write, mut read) = ws_stream.split();
    let write = Arc::new(Mutex::new(write));

    while let Some(msg) = read.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                log::warn!("ws read error: {}", e);
                continue;
            }
        };

        let text = match msg {
            Message::Text(t) => t,
            Message::Binary(b) => match String::from_utf8(b) {
                Ok(s) => s,
                Err(_) => {
                    log::warn!("non-utf8 binary frame, ignoring");
                    continue;
                }
            },
            Message::Close(_) => break,
            Message::Ping(_) | Message::Pong(_) | Message::Frame(_) => continue,
        };

        let event: HookEvent = match serde_json::from_str(&text) {
            Ok(e) => e,
            Err(e) => {
                log::warn!("failed to parse hook_event: {}", e);
                continue;
            }
        };

        if event.r#type != "hook_event" {
            log::warn!("unexpected message type: {}", event.r#type);
            continue;
        }

        let (tx, mut rx) = mpsc::channel::<HookResponse>(1);
        pending().insert(event.id.clone(), tx);
        queue().insert(event.id.clone(), event.clone());
        log::info!(
            "received hook_event id={} tool={} queue_len={}",
            event.id,
            event.tool_name,
            queue().len()
        );

        match app.emit("hook_event", event.clone()) {
            Ok(_) => log::info!("emitted hook_event id={} to frontend", event.id),
            Err(e) => log::warn!("emit hook_event failed: {}", e),
        }

        let body = format_notification_body(&event);
        if let Err(e) = app
            .notification()
            .builder()
            .title("Claude Code needs approval")
            .body(body)
            .show()
        {
            log::warn!("notification failed: {}", e);
        }

        let write_clone = write.clone();
        let event_id = event.id.clone();
        tokio::spawn(async move {
            let response = match timeout(Duration::from_secs(RESPONSE_TIMEOUT_SECS), rx.recv()).await {
                Ok(Some(resp)) => resp,
                Ok(None) => {
                    log::warn!("sender dropped for {}, denying", event_id);
                    pending().remove(&event_id);
                    queue().remove(&event_id);
                    HookResponse {
                        r#type: "hook_response",
                        id: event_id.clone(),
                        action: "deny".to_string(),
                    }
                }
                Err(_) => {
                    log::info!("timeout for {}, auto-deny", event_id);
                    pending().remove(&event_id);
                    queue().remove(&event_id);
                    HookResponse {
                        r#type: "hook_response",
                        id: event_id.clone(),
                        action: "deny".to_string(),
                    }
                }
            };

            let payload = match serde_json::to_string(&response) {
                Ok(p) => p,
                Err(e) => {
                    log::error!("serialize hook_response failed: {}", e);
                    return;
                }
            };

            let mut guard = write_clone.lock().await;
            if let Err(e) = guard.send(Message::Text(payload)).await {
                log::warn!("failed to send hook_response: {}", e);
            }
        });
    }

    Ok(())
}

fn format_notification_body(event: &HookEvent) -> String {
    let input_str = event.tool_input.to_string();
    let truncated: String = input_str.chars().take(120).collect();
    let suffix = if input_str.chars().count() > 120 { "..." } else { "" };
    format!("{}: {}{}", event.tool_name, truncated, suffix)
}
