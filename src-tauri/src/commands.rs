use serde_json::Value;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Window};

use crate::app_settings::{self, AppSettings};
use crate::ws;
use crate::wsl_admin::{self, BulkResult, HookStatus, WslDistroWithStatus};

#[tauri::command]
pub async fn respond(id: String, action: String) {
    ws::send_response(id, action).await;
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
        "Claude Hook Guard".to_string()
    } else {
        format!("Claude Hook Guard - {} pending", count)
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
pub async fn list_wsl_distros() -> Result<Vec<WslDistroWithStatus>, String> {
    wsl_admin::list_with_status().await
}

#[tauri::command]
pub async fn set_hook_enabled(distro: String, enabled: bool) -> Result<(), String> {
    if enabled {
        wsl_admin::enable_hook(&distro).await
    } else {
        wsl_admin::disable_hook(&distro).await
    }
}

#[tauri::command]
pub async fn set_hook_enabled_all(enabled: bool) -> Vec<BulkResult> {
    wsl_admin::set_hook_all(enabled).await
}

#[tauri::command]
pub async fn list_wsl_distros_smart() -> Result<Vec<WslDistroWithStatus>, String> {
    wsl_admin::list_distros_smart().await
}

#[tauri::command]
pub async fn check_wsl_distro_status(distro: String) -> Result<HookStatus, String> {
    wsl_admin::check_single_distro(&distro).await
}

#[tauri::command]
pub fn open_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("settings") {
        let _ = existing.show();
        let _ = existing.set_focus();
        let _ = existing.unminimize();
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("index.html#/settings".into()))
        .title("Claude Hook Guard — Settings")
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
pub fn get_windows_hook_status() -> crate::wsl_admin::HookStatus {
    crate::windows_hook::get_status()
}

#[tauri::command]
pub fn set_windows_hook_enabled(enabled: bool) -> Result<(), String> {
    if enabled {
        crate::windows_hook::enable()
    } else {
        crate::windows_hook::disable()
    }
}
