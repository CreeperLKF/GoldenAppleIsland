use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Window};

use crate::app_settings::{self, AppSettings};
use crate::audit_history::{self, AuditIndex, EventRecord};
use crate::file_logger;
use crate::hook_modes::{HookTargetConfig, WorkingMode};
use crate::path_norm;
use crate::policy::{
    self, ApprovalPolicies, PolicyKind, PolicyRule, SessionRule, SESSION_RULE_CAP,
};
use crate::session_ctx;
use crate::ws;
use crate::wsl_admin::{self, BulkResult, HookStatus, WslDistroWithStatus};

#[tauri::command]
pub async fn respond(id: String, action: String, answer: Option<String>, session_mode: Option<String>) {
    ws::send_response(id, action, answer, session_mode).await;
}

#[tauri::command]
pub fn get_pending_events() -> Vec<ws::HookEvent> {
    let snap = ws::snapshot_queue();
    log::info!("get_pending_events called, returning {} events", snap.len());
    snap
}

#[tauri::command]
pub fn set_pending_count(count: u32, app: AppHandle) {
    let tooltip = if count == 0 {
        "Golden Apple Island".to_string()
    } else {
        format!("Golden Apple Island - {} pending", count)
    };
    update_tray_badge(&app, &tooltip, count);
}

#[tauri::command]
pub fn show_popup(window: Window) {
    let _ = window.show();
    let _ = window.set_focus();
    crate::sync_show_check(true);
}

#[tauri::command]
pub fn hide_popup(window: Window) {
    let _ = window.hide();
    crate::sync_show_check(false);
}

fn update_tray_badge(app: &AppHandle, tooltip: &str, _count: u32) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

#[tauri::command]
pub fn get_app_settings() -> AppSettings {
    app_settings::get()
}

#[tauri::command]
pub fn update_app_settings(patch: Value) -> AppSettings {
    let mut current = app_settings::get();
    if let Some(b) = patch.get("toast_enabled").and_then(|v| v.as_bool()) {
        current.toast_enabled = b;
    }
    if let Some(b) = patch.get("sound_enabled").and_then(|v| v.as_bool()) {
        current.sound_enabled = b;
    }
    if let Some(b) = patch.get("always_on_top").and_then(|v| v.as_bool()) {
        current.always_on_top = b;
    }
    if let Some(b) = patch.get("collapsed").and_then(|v| v.as_bool()) {
        current.collapsed = b;
    }
    if let Some(b) = patch.get("recent_collapsed").and_then(|v| v.as_bool()) {
        current.recent_collapsed = b;
    }
    if let Some(b) = patch.get("log_to_file").and_then(|v| v.as_bool()) {
        current.log_to_file = b;
    }
    if let Some(p) = patch.get("port").and_then(|v| v.as_u64()) {
        let new_port = p as u16;
        if new_port != current.port {
            for cache in current.wsl_status_cache.values_mut() {
                cache.registered = false;
            }
            if let Some(ref mut wc) = current.windows_hook_cache {
                wc.registered = false;
            }
            current.port = new_port;
        }
    }
    app_settings::set(current)
}

#[tauri::command]
pub fn update_popup_position(x: i32, y: i32, monitor_name: String) -> AppSettings {
    let mut current = app_settings::get();
    current.popup_position = Some(crate::app_settings::PopupPosition {
        x,
        y,
        monitor_name,
    });
    app_settings::set(current)
}

#[tauri::command]
pub async fn list_wsl_distros() -> Result<Vec<WslDistroWithStatus>, String> {
    wsl_admin::list_with_status().await
}

#[tauri::command]
pub async fn set_hook_enabled(distro: String, enabled: bool) -> Result<(), String> {
    if enabled {
        let settings = app_settings::get();
        let cfg = settings
            .wsl_hook_configs
            .get(&distro)
            .cloned()
            .unwrap_or_else(|| crate::hook_modes::HookTargetConfig {
                mode: settings.default_mode,
                custom: crate::hook_modes::CustomHookSet::default(),
            });
        wsl_admin::enable_hook(&distro, &cfg).await
    } else {
        wsl_admin::disable_hook(&distro).await
    }
}

#[tauri::command]
pub async fn set_hook_enabled_all(enabled: bool) -> Vec<BulkResult> {
    wsl_admin::set_hook_all(enabled).await
}

#[tauri::command]
pub async fn update_wsl_scripts() -> Vec<BulkResult> {
    wsl_admin::update_scripts_all().await
}

#[tauri::command]
pub async fn list_wsl_distros_smart() -> Result<Vec<WslDistroWithStatus>, String> {
    wsl_admin::list_distros_smart().await
}

#[tauri::command]
pub async fn check_wsl_distro_status(distro: String) -> Result<HookStatus, String> {
    wsl_admin::check_single_distro(&distro).await
}

pub fn build_settings_window(app: &AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("settings") {
        let _ = existing.show();
        let _ = existing.set_focus();
        let _ = existing.unminimize();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App("index.html#/settings".into()),
    )
    .title("Golden Apple Island — Settings")
    .inner_size(480.0, 640.0)
    .min_inner_size(420.0, 480.0)
    .resizable(true)
    .skip_taskbar(false)
    .always_on_top(false)
    .decorations(true)
    .visible(true)
    .build()
    .map_err(|e| format!("failed to open settings window: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    build_settings_window(&app)
}

#[tauri::command]
pub fn write_log(level: String, message: String) {
    file_logger::write_frontend_log(&level, &message);
}

#[tauri::command]
pub fn get_log_dir() -> String {
    app_settings::log_dir().to_string_lossy().into_owned()
}

#[tauri::command]
pub fn get_windows_hook_status() -> crate::wsl_admin::HookStatus {
    crate::windows_hook::get_status()
}

#[tauri::command]
pub fn set_windows_hook_enabled(enabled: bool) -> Result<(), String> {
    let config = app_settings::get().windows_hook_config;
    if enabled {
        crate::windows_hook::enable(&config)
    } else {
        crate::windows_hook::disable()
    }
}

fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

fn write_policies<F>(app: &AppHandle, mutate: F) -> Result<(), String>
where
    F: FnOnce(&mut ApprovalPolicies),
{
    let mut current = app_settings::get();
    mutate(&mut current.approval_policies);
    let updated = app_settings::set(current);
    let _ = app.emit("approval_policies_changed", &updated.approval_policies);
    Ok(())
}

#[tauri::command]
pub async fn get_approval_policies() -> ApprovalPolicies {
    app_settings::get().approval_policies
}

#[tauri::command]
pub async fn set_global_policy(kind: PolicyKind, app: AppHandle) -> Result<(), String> {
    write_policies(&app, |p| p.global = kind)
}

#[tauri::command]
pub async fn set_distro_policy(
    distro: String,
    kind: PolicyKind,
    app: AppHandle,
) -> Result<(), String> {
    write_policies(&app, |p| {
        p.per_distro.insert(
            distro,
            PolicyRule {
                kind,
                include_subdirectories: false,
                created_at: now_iso(),
            },
        );
    })
}

#[tauri::command]
pub async fn remove_distro_policy(distro: String, app: AppHandle) -> Result<(), String> {
    write_policies(&app, |p| {
        p.per_distro.remove(&distro);
    })
}

#[tauri::command]
pub async fn set_folder_policy(
    path: String,
    kind: PolicyKind,
    include_subdirectories: bool,
    app: AppHandle,
) -> Result<(), String> {
    let key = path_norm::normalize_user_path(&path);
    write_policies(&app, |p| {
        p.per_folder.insert(
            key,
            PolicyRule {
                kind,
                include_subdirectories,
                created_at: now_iso(),
            },
        );
    })
}

#[tauri::command]
pub async fn remove_folder_policy(path: String, app: AppHandle) -> Result<(), String> {
    let key = path_norm::normalize_user_path(&path);
    write_policies(&app, |p| {
        p.per_folder.remove(&key);
    })
}

#[tauri::command]
pub async fn set_session_policy(
    session_id: String,
    kind: PolicyKind,
    app: AppHandle,
) -> Result<(), String> {
    let ctx = session_ctx::get(&session_id)
        .ok_or_else(|| format!("unknown session_id: {}", session_id))?;
    write_policies(&app, |p| {
        policy::push_session_rule(
            p,
            SessionRule {
                session_id: session_id.clone(),
                session_cwd: ctx.start_cwd_normalized.clone(),
                distro: ctx.distro.clone(),
                kind,
                created_at: now_iso(),
            },
        );
    })
}

#[tauri::command]
pub async fn remove_session_policy(session_id: String, app: AppHandle) -> Result<(), String> {
    write_policies(&app, |p| {
        p.per_session.retain(|r| r.session_id != session_id);
    })
}

#[tauri::command]
pub async fn promote_session_to_folder(
    session_id: String,
    include_subdirectories: bool,
    app: AppHandle,
) -> Result<(), String> {
    let rule = {
        let current = app_settings::get();
        current
            .approval_policies
            .per_session
            .iter()
            .find(|r| r.session_id == session_id)
            .cloned()
            .ok_or_else(|| format!("no session rule for {}", session_id))?
    };
    write_policies(&app, |p| {
        p.per_folder.insert(
            rule.session_cwd.clone(),
            PolicyRule {
                kind: rule.kind,
                include_subdirectories,
                created_at: now_iso(),
            },
        );
        p.per_session.retain(|r| r.session_id != session_id);
    })
}

#[tauri::command]
pub async fn list_recent_sessions() -> Vec<RecentSession> {
    let policies = app_settings::get().approval_policies;
    session_ctx::recent(SESSION_RULE_CAP)
        .into_iter()
        .map(|s| {
            let rule_kind = policies
                .per_session
                .iter()
                .find(|r| r.session_id == s.session_id)
                .map(|r| r.kind);
            RecentSession {
                session_id: s.session_id,
                start_cwd_normalized: s.start_cwd_normalized,
                distro: s.distro,
                last_seen_at_ms: s.last_seen_at_ms,
                rule_kind,
            }
        })
        .collect()
}

#[derive(serde::Serialize)]
pub struct RecentSession {
    pub session_id: String,
    pub start_cwd_normalized: String,
    pub distro: String,
    pub last_seen_at_ms: u128,
    pub rule_kind: Option<PolicyKind>,
}

#[tauri::command]
pub fn set_hotkey(app: tauri::AppHandle, slot: String, accel: String) -> Result<(), String> {
    let slot_enum = crate::hotkeys::Slot::from_str_snake(&slot)
        .ok_or_else(|| format!("unknown hotkey slot '{}'", slot))?;

    crate::hotkeys::set(&app, slot_enum, &accel)?;

    let mut settings = crate::app_settings::get();
    match slot_enum {
        crate::hotkeys::Slot::ToggleWindow => settings.hotkey_toggle_window = accel,
        crate::hotkeys::Slot::ApproveAll => settings.hotkey_approve_all = accel,
    }
    crate::app_settings::set(settings);
    Ok(())
}

#[tauri::command]
pub fn set_default_mode(mode: WorkingMode) -> AppSettings {
    let mut current = app_settings::get();
    current.default_mode = mode;
    app_settings::set(current)
}

#[tauri::command]
pub async fn set_windows_hook_config(config: HookTargetConfig) -> Result<(), String> {
    let mut current = app_settings::get();
    current.windows_hook_config = config.clone();
    let enabled_now = current
        .windows_hook_cache
        .as_ref()
        .map(|c| c.registered)
        .unwrap_or(false);
    app_settings::set(current);
    if enabled_now {
        crate::windows_hook::apply_config(&config)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn set_wsl_hook_config(distro: String, config: HookTargetConfig) -> Result<(), String> {
    let mut current = app_settings::get();
    current.wsl_hook_configs.insert(distro.clone(), config.clone());
    let was_enabled = current
        .wsl_status_cache
        .get(&distro)
        .map(|c| c.registered)
        .unwrap_or(false);
    app_settings::set(current);
    if was_enabled {
        wsl_admin::apply_config(&distro, &config).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn audit_list() -> AuditIndex {
    audit_history::get_index().await
}

#[tauri::command]
pub fn audit_read_session(folder_hash: String, session_id: String) -> Vec<EventRecord> {
    audit_history::read_session_records(&folder_hash, &session_id)
}

#[tauri::command]
pub async fn audit_pin_folder(folder_hash: String) {
    audit_history::set_folder_pinned(&folder_hash, true).await;
}

#[tauri::command]
pub async fn audit_unpin_folder(folder_hash: String) {
    audit_history::set_folder_pinned(&folder_hash, false).await;
}

#[tauri::command]
pub async fn audit_pin_session(folder_hash: String, session_id: String) {
    audit_history::set_session_pinned(&folder_hash, &session_id, true).await;
}

#[tauri::command]
pub async fn audit_unpin_session(folder_hash: String, session_id: String) {
    audit_history::set_session_pinned(&folder_hash, &session_id, false).await;
}

#[tauri::command]
pub async fn audit_delete_session(folder_hash: String, session_id: String) {
    audit_history::delete_session(&folder_hash, &session_id).await;
}

#[tauri::command]
pub async fn audit_delete_folder(folder_hash: String) {
    audit_history::delete_folder(&folder_hash).await;
}

#[tauri::command]
pub fn set_audit_enabled(enabled: bool) -> AppSettings {
    let mut current = app_settings::get();
    current.audit_history_enabled = enabled;
    app_settings::set(current)
}

#[tauri::command]
pub async fn set_max_dynamic_sessions(cap: u32) -> AppSettings {
    let mut current = app_settings::get();
    current.max_dynamic_sessions = cap;
    let updated = app_settings::set(current);
    audit_history::set_max_dynamic_sessions(cap).await;
    updated
}

#[tauri::command]
pub fn set_audit_skip_unpinned_delete_confirm(value: bool) -> AppSettings {
    let mut current = app_settings::get();
    current.audit_skip_unpinned_delete_confirm = value;
    app_settings::set(current)
}
