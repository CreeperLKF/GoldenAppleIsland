//! Glue between `ws::handle_connection` and the Agent/External approve modules.
//!
//! The `ws` module only knows "this event has PolicyKind::Agent or External";
//! this module owns validation (workspace configured? URL set?), spawning the
//! Tokio task, cancellation, and routing the verdict back through ws.

use std::path::PathBuf;
use std::time::SystemTime;

use serde_json::json;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

use crate::agent_approve;
use crate::delegation::{self, DelegationHandle, DelegationKind};
use crate::external_approve;
use crate::policy::PolicyKind;
use crate::verdict::{Verdict, VerdictKind};
use crate::ws::{self, HookEvent};

/// Called by `ws::handle_connection` when `resolved.kind` is Agent or External.
/// Validates config; falls through to Manual enqueue on failure.
pub async fn dispatch(app: AppHandle, event: HookEvent, kind: PolicyKind) {
    let policies = crate::app_settings::get().approval_policies;
    let delegation_kind = match kind {
        PolicyKind::Agent => DelegationKind::Agent,
        PolicyKind::External => DelegationKind::External,
        _ => unreachable!("dispatch called with non-delegating kind"),
    };

    match kind {
        PolicyKind::Agent => {
            let cfg = policies.agent_config.clone();
            let Some(ws_path) = cfg.workspace_path.clone() else {
                fallthrough_manual(&app, event, "Agent Approve is not configured").await;
                return;
            };
            if !ws_path.is_dir() || !agent_approve::workspace_has_claude_md(&ws_path) {
                fallthrough_manual(
                    &app,
                    event,
                    "Agent workspace or CLAUDE.md is missing",
                )
                .await;
                return;
            }
            spawn_agent(app, event, cfg, ws_path, delegation_kind).await;
        }
        PolicyKind::External => {
            let cfg = policies.external_config.clone();
            let Some(url) = cfg.endpoint_url.clone() else {
                fallthrough_manual(&app, event, "External Approve is not configured").await;
                return;
            };
            spawn_external(
                app,
                event,
                url,
                cfg.auth_header.clone(),
                cfg.call_timeout_secs,
                delegation_kind,
            )
            .await;
        }
        _ => unreachable!(),
    }
}

async fn spawn_agent(
    app: AppHandle,
    event: HookEvent,
    cfg: crate::policy::AgentApproveConfig,
    ws_path: PathBuf,
    kind: DelegationKind,
) {
    let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
    let handle = DelegationHandle {
        kind,
        cancel_tx,
        started_at: SystemTime::now(),
    };
    delegation::insert(event.id.clone(), handle);

    if let Err(e) = app.emit(
        "hook_event_delegated",
        json!({ "event": event, "kind": "agent", "scope": event.resolved_scope }),
    ) {
        log::warn!("emit hook_event_delegated failed: {}", e);
    }

    let app_task = app.clone();
    let ev_task = event.clone();
    tokio::spawn(async move {
        let prompt = agent_approve::build_prompt(&ev_task);
        let result = tokio::select! {
            _ = cancel_rx => {
                log::info!("agent call {} cancelled", ev_task.id);
                // caller (`take_over`) already handled UI transition
                return;
            }
            r = agent_approve::run_agent_call(
                &prompt,
                &ws_path,
                cfg.call_timeout_secs,
                cfg.turn_limit,
            ) => r,
        };
        handle_result(&app_task, ev_task, result.map_err(|e| e.to_string()), "agent").await;
    });
}

async fn spawn_external(
    app: AppHandle,
    event: HookEvent,
    url: String,
    auth_header: Option<String>,
    timeout_secs: u32,
    kind: DelegationKind,
) {
    let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
    let handle = DelegationHandle {
        kind,
        cancel_tx,
        started_at: SystemTime::now(),
    };
    delegation::insert(event.id.clone(), handle);

    if let Err(e) = app.emit(
        "hook_event_delegated",
        json!({ "event": event, "kind": "external", "scope": event.resolved_scope }),
    ) {
        log::warn!("emit hook_event_delegated failed: {}", e);
    }

    let app_task = app.clone();
    let ev_task = event.clone();
    tokio::spawn(async move {
        let result = tokio::select! {
            _ = cancel_rx => {
                log::info!("external call {} cancelled", ev_task.id);
                return;
            }
            r = external_approve::run_external_call(
                &url,
                auth_header.as_deref(),
                &ev_task,
                timeout_secs,
            ) => r,
        };
        handle_result(&app_task, ev_task, result.map_err(|e| e.to_string()), "external").await;
    });
}

async fn handle_result(
    app: &AppHandle,
    event: HookEvent,
    result: Result<Verdict, String>,
    source: &str,
) {
    let event_id = event.id.clone();
    match result {
        Ok(v) => match v.verdict {
            VerdictKind::Approve => {
                ws::send_response(event_id.clone(), "approve".to_string(), None, None).await;
                emit_resolved(app, &event_id, "approve", source, Some(&v.reason));
                crate::audit_history::record_blocking(
                    &event,
                    crate::audit_history::Decision::Approve,
                    audit_source(source),
                    Some(v.reason.clone()),
                )
                .await;
            }
            VerdictKind::Reject => {
                ws::send_response(event_id.clone(), "deny".to_string(), None, None).await;
                emit_resolved(app, &event_id, "deny", source, Some(&v.reason));
                crate::audit_history::record_blocking(
                    &event,
                    crate::audit_history::Decision::Deny,
                    audit_source(source),
                    Some(v.reason.clone()),
                )
                .await;
            }
            VerdictKind::Escalate => {
                let banner = format!("{} escalated: {}", capitalize(source), v.reason);
                escalate_to_manual(app, event, &banner).await;
                emit_resolved(app, &event_id, "escalated", source, Some(&v.reason));
            }
        },
        Err(msg) => {
            let banner = format!("{} call failed: {}", capitalize(source), short(&msg));
            escalate_to_manual(app, event, &banner).await;
            emit_resolved(app, &event_id, "failed", source, Some(&msg));
        }
    }
    delegation::remove(&event_id);
}

async fn fallthrough_manual(app: &AppHandle, event: HookEvent, reason: &str) {
    log::warn!("delegation fallthrough for {}: {}", event.id, reason);
    let _ = app.emit(
        "delegation_fallthrough_warning",
        json!({ "event_id": event.id, "reason": reason }),
    );
    // Re-drive the Manual path using the existing queue infrastructure.
    let mut enriched = event;
    enriched.resolved_kind = Some(PolicyKind::Manual);
    ws::enqueue_event_as_manual(app, enriched);
}

async fn escalate_to_manual(app: &AppHandle, event: HookEvent, banner: &str) {
    let mut enriched = event;
    enriched.resolved_kind = Some(PolicyKind::Manual);
    enriched.delegation_banner = Some(banner.to_string());
    ws::enqueue_event_as_manual(app, enriched);
}

fn emit_resolved(
    app: &AppHandle,
    event_id: &str,
    action: &str,
    source: &str,
    reason: Option<&str>,
) {
    if let Err(e) = app.emit(
        "delegation_resolved",
        json!({
            "event_id": event_id,
            "action": action,
            "source": source,
            "reason": reason,
        }),
    ) {
        log::warn!("emit delegation_resolved failed: {}", e);
    }
}

fn audit_source(source: &str) -> crate::audit_history::DecisionSource {
    match source {
        "agent" => crate::audit_history::DecisionSource::Agent,
        "external" => crate::audit_history::DecisionSource::External,
        _ => crate::audit_history::DecisionSource::Auto,
    }
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

fn short(s: &str) -> String {
    s.chars().take(160).collect()
}

/// Cancel an in-flight delegation and push the original event onto the manual
/// pending queue with a "Taken over" banner.
#[allow(dead_code)]
pub async fn take_over(app: AppHandle, event_id: String) -> Result<(), String> {
    let handle = delegation::remove(&event_id)
        .ok_or_else(|| format!("no delegation in flight for {}", event_id))?;

    // Drop the sender — the spawned task's select! arm fires, the task
    // returns, and the Drop guard on any spawned claude child kills it.
    drop(handle.cancel_tx);

    // We need the original event; fetch it from the ws queue snapshot.
    // ws::handle_connection inserted the event into queue() before calling
    // dispatch, so it is still present until send_response removes it.
    let snapshot = ws::snapshot_queue();
    let ev = snapshot
        .into_iter()
        .find(|e| e.id == event_id)
        .ok_or_else(|| format!("no queued event for {}", event_id))?;

    let (banner, source) = match handle.kind {
        DelegationKind::Agent => ("Taken over from Agent".to_string(), "agent"),
        DelegationKind::External => ("Taken over from External".to_string(), "external"),
    };

    let mut enriched = ev;
    enriched.resolved_kind = Some(PolicyKind::Manual);
    enriched.delegation_banner = Some(banner);
    ws::enqueue_event_as_manual(&app, enriched);

    emit_resolved(&app, &event_id, "takenover", source, None);
    Ok(())
}
