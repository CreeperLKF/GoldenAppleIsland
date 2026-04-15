use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use std::sync::OnceLock;

use crate::policy::{PolicyKind, PolicyScope};

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

fn default_distro() -> String {
    "unknown".to_string()
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct HookEvent {
    pub r#type: String,
    pub id: String,
    pub session_id: String,
    pub session_cwd: String,
    #[serde(default = "default_distro")]
    pub source_distro: String,
    pub hook_type: String,
    pub tool_name: String,
    pub tool_input: serde_json::Value,
    pub timestamp: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_kind: Option<PolicyKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_scope: Option<PolicyScope>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delegation_banner: Option<String>,
}

pub(crate) fn enqueue_event_as_manual(app: &AppHandle, event: HookEvent) {
    queue().insert(event.id.clone(), event.clone());
    if let Err(e) = app.emit("hook_event", event) {
        log::warn!("emit hook_event failed: {}", e);
    }
}

fn enqueue_manual(app: &AppHandle, event: HookEvent, tx: mpsc::Sender<HookResponse>) {
    pending().insert(event.id.clone(), tx);
    queue().insert(event.id.clone(), event.clone());
    if let Err(e) = app.emit("hook_event", event) {
        log::warn!("emit hook_event failed: {}", e);
    }
}

async fn resolve_auto(
    app: &AppHandle,
    event: HookEvent,
    scope: PolicyScope,
    tx: mpsc::Sender<HookResponse>,
) {
    let resp = HookResponse {
        r#type: "hook_response".to_string(),
        id: event.id.clone(),
        action: "approve".to_string(),
        answer: None,
        session_mode: None,
    };
    // Deliver directly to the receiver kept in handle_connection; no pending
    // slot needed because no frontend interaction happens for Auto.
    let _ = tx.send(resp).await;
    if let Err(e) = app.emit(
        "hook_event_auto_resolved",
        serde_json::json!({
            "event": event,
            "scope": scope,
            "source": "policy",
        }),
    ) {
        log::warn!("emit hook_event_auto_resolved failed: {}", e);
    }
    let ev_for_audit = event.clone();
    tokio::spawn(async move {
        crate::audit_history::record_blocking(
            &ev_for_audit,
            crate::audit_history::Decision::Approve,
            crate::audit_history::DecisionSource::Auto,
            None,
        )
        .await;
    });
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HookResponse {
    pub r#type: String,
    pub id: String,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub answer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_mode: Option<String>,
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

pub async fn send_response(id: String, action: String, answer: Option<String>, session_mode: Option<String>) {
    queue().remove(&id);
    let Some((_, tx)) = pending().remove(&id) else {
        log::warn!("send_response: no pending entry for id {}", id);
        return;
    };
    let resp = HookResponse {
        r#type: "hook_response".to_string(),
        id,
        action,
        answer,
        session_mode,
    };
    if let Err(e) = tx.send(resp).await {
        log::warn!("send_response: failed to forward response: {}", e);
    }
}

pub async fn serve(app: AppHandle) {
    emit_connection_count(&app, 0);

    let port = crate::app_settings::get().port;
    let bind_addr = format!("127.0.0.1:{}", port);

    let listener = match TcpListener::bind(&bind_addr).await {
        Ok(l) => l,
        Err(e) => {
            log::error!("failed to bind {}: {}", bind_addr, e);
            return;
        }
    };
    log::info!("Golden Apple Island WS listening on {}", bind_addr);

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

        let hook_kind = parse_hook_kind(&event.hook_type);

        if let Some(kind) = hook_kind {
            if !kind.is_blocking() {
                // Observational: never queue for approval, emit the dedicated
                // Tauri frontend event, and we are done with this message.
                if let Err(e) = app.emit("hook_event_observational", event.clone()) {
                    log::warn!("emit hook_event_observational failed: {}", e);
                }
                let ev_for_audit = event.clone();
                tokio::spawn(async move {
                    crate::audit_history::record_observational(&ev_for_audit).await;
                });
                continue;
            }
        } else {
            log::warn!("unknown hook_type: {}", event.hook_type);
        }

        let (tx, mut rx) = mpsc::channel::<HookResponse>(1);

        // Run policy resolution before queueing.
        let normalized_cwd =
            crate::path_norm::normalize_event_cwd(&event.session_cwd, &event.source_distro);
        crate::session_ctx::touch(&event.session_id, &normalized_cwd, &event.source_distro);

        let ctx = crate::session_ctx::get(&event.session_id).expect("just touched");
        let policies = crate::app_settings::get().approval_policies;
        let resolved = crate::policy::resolve(&event, &ctx, &policies);
        log::info!(
            "received hook_event id={} tool={} resolved={:?}/{:?}",
            event.id,
            event.tool_name,
            resolved.kind,
            resolved.scope
        );

        match resolved.kind {
            PolicyKind::Auto => {
                resolve_auto(&app, event.clone(), resolved.scope, tx).await;
            }
            PolicyKind::Manual => {
                let mut enriched = event.clone();
                enriched.resolved_kind = Some(resolved.kind);
                enriched.resolved_scope = Some(resolved.scope);
                enqueue_manual(&app, enriched, tx);
            }
            PolicyKind::Agent | PolicyKind::External => {
                pending().insert(event.id.clone(), tx);
                let mut enriched = event.clone();
                enriched.resolved_kind = Some(resolved.kind);
                enriched.resolved_scope = Some(resolved.scope);
                queue().insert(event.id.clone(), enriched.clone());
                crate::delegation_dispatch::dispatch(app.clone(), enriched, resolved.kind).await;
            }
        }

        let prefs = crate::app_settings::get();
        if prefs.toast_enabled && resolved.kind == PolicyKind::Manual {
            let body = format_notification_body(&event);
            let mut builder = app
                .notification()
                .builder()
                .title("Golden Apple Island — approval needed")
                .body(body);
            if !prefs.sound_enabled {
                // Tauri v2 notification builder: empty/silent sound maps to
                // Windows Toast `silent="true"`. Passing "Silent" is the
                // closest cross-version hint.
                builder = builder.sound("Silent");
            }
            if let Err(e) = builder.show() {
                log::warn!("notification failed: {}", e);
            }
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
                        r#type: "hook_response".to_string(),
                        id: event_id.clone(),
                        action: "deny".to_string(),
                        answer: None,
                        session_mode: None,
                    }
                }
                Err(_) => {
                    log::info!("timeout for {}, auto-deny", event_id);
                    pending().remove(&event_id);
                    queue().remove(&event_id);
                    HookResponse {
                        r#type: "hook_response".to_string(),
                        id: event_id.clone(),
                        action: "deny".to_string(),
                        answer: None,
                        session_mode: None,
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

fn parse_hook_kind(s: &str) -> Option<crate::hook_modes::HookEventKind> {
    use crate::hook_modes::HookEventKind as K;
    Some(match s {
        "pre_tool_use" => K::PreToolUse,
        "permission_request" => K::PermissionRequest,
        "user_prompt_submit" => K::UserPromptSubmit,
        "post_tool_use" => K::PostToolUse,
        "notification" => K::Notification,
        "stop" => K::Stop,
        "subagent_stop" => K::SubagentStop,
        "pre_compact" => K::PreCompact,
        "session_start" => K::SessionStart,
        "session_end" => K::SessionEnd,
        _ => return None,
    })
}
