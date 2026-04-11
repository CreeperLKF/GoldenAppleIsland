use tauri::{AppHandle, Window};

use crate::ws;

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
}

#[tauri::command]
pub fn hide_popup(window: Window) {
    let _ = window.hide();
}

fn update_tray_badge(app: &AppHandle, tooltip: &str, _count: u32) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(tooltip));
    }
}
