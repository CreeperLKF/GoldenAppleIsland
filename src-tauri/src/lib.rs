mod agent_approve;
mod app_settings;
mod audit_history;
mod commands;
mod file_logger;
mod path_norm;
mod policy;
mod session_ctx;
mod verdict;
mod ws;
mod wsl_admin;
mod windows_hook;
mod hook_modes;
mod hook_reconcile;
mod hotkeys;

use std::sync::OnceLock;

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition, Wry,
};

static SHOW_CHECK: OnceLock<CheckMenuItem<Wry>> = OnceLock::new();

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load settings early (before logger) so we know whether to log to file.
    app_settings::init();
    let prefs = app_settings::get();

    if prefs.log_to_file {
        file_logger::init_with_file();
    } else {
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
            .format_timestamp_millis()
            .init();
    }
    log::info!("Golden Apple Island starting up (log_to_file={})", prefs.log_to_file);

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::respond,
            commands::get_pending_events,
            commands::set_pending_count,
            commands::show_popup,
            commands::hide_popup,
            commands::get_app_settings,
            commands::update_app_settings,
            commands::set_default_mode,
            commands::set_windows_hook_config,
            commands::set_wsl_hook_config,
            commands::update_popup_position,
            commands::list_wsl_distros,
            commands::list_wsl_distros_smart,
            commands::check_wsl_distro_status,
            commands::set_hook_enabled,
            commands::set_hook_enabled_all,
            commands::update_wsl_scripts,
            commands::write_log,
            commands::get_log_dir,
            commands::open_settings_window,
            commands::get_windows_hook_status,
            commands::set_windows_hook_enabled,
            commands::get_approval_policies,
            commands::set_global_policy,
            commands::set_distro_policy,
            commands::remove_distro_policy,
            commands::set_folder_policy,
            commands::remove_folder_policy,
            commands::set_session_policy,
            commands::remove_session_policy,
            commands::promote_session_to_folder,
            commands::list_recent_sessions,
            commands::set_hotkey,
            commands::audit_list,
            commands::audit_read_session,
            commands::audit_pin_folder,
            commands::audit_unpin_folder,
            commands::audit_pin_session,
            commands::audit_unpin_session,
            commands::audit_delete_session,
            commands::audit_delete_folder,
            commands::set_audit_enabled,
            commands::set_max_dynamic_sessions,
            commands::set_audit_skip_unpinned_delete_confirm,
        ])
        .setup(|app| {
            let show_item = CheckMenuItem::with_id(app, "show", "Show", true, false, None::<&str>)?;
            let _ = SHOW_CHECK.set(show_item.clone());
            let settings_item =
                MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &settings_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main")
                .tooltip("Golden Apple Island")
                .icon(app.default_window_icon().cloned().unwrap())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            // CheckMenuItem auto-toggles before this callback fires.
                            let checked = SHOW_CHECK
                                .get()
                                .and_then(|c| c.is_checked().ok())
                                .unwrap_or(false);
                            if checked {
                                let _ = win.show();
                                let _ = win.set_focus();
                            } else {
                                let _ = win.hide();
                            }
                        }
                    }
                    "settings" => {
                        if let Err(e) = commands::build_settings_window(app) {
                            log::warn!("open_settings_window: {}", e);
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        let cursor = app.cursor_position().ok();
                        if let Some(win) = app.get_webview_window("main") {
                            let visible = win.is_visible().unwrap_or(false);
                            let next_visible = !visible;
                            if next_visible {
                                position_window_at_cursor(&win, cursor);
                                let _ = win.show();
                                let _ = win.set_focus();
                            } else {
                                let _ = win.hide();
                            }
                            sync_show_check(next_visible);
                        }
                    }
                })
                .build(app)?;

            // Apply always_on_top from persisted settings
            if let Some(win) = app.get_webview_window("main") {
                let prefs = app_settings::get();
                if prefs.always_on_top {
                    let _ = win.set_always_on_top(true);
                }
            }

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                ws::serve(app_handle).await;
            });

            if let Err(e) = hotkeys::register_all(app.handle()) {
                log::warn!("register_all hotkeys: {}", e);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn sync_show_check(checked: bool) {
    if let Some(item) = SHOW_CHECK.get() {
        let _ = item.set_checked(checked);
    }
}

/// Try to restore the popup's last persisted position. Returns true if the
/// saved position passed all validations (monitor matched by name, saved rect
/// fully inside that monitor) and was applied. Returns false otherwise —
/// callers should fall back to the cursor/tray anchor path.
fn try_restore_popup_position(window: &tauri::WebviewWindow) -> bool {
    let saved = match app_settings::get().popup_position {
        Some(p) => p,
        None => return false,
    };

    let Ok(monitors) = window.available_monitors() else {
        return false;
    };

    let monitor = monitors
        .into_iter()
        .find(|m| m.name().map(|n| n.as_str()) == Some(saved.monitor_name.as_str()));

    let Some(monitor) = monitor else {
        log::info!(
            "restore_popup_position: saved monitor '{}' not found, falling back",
            saved.monitor_name
        );
        return false;
    };

    let mon_pos = monitor.position();
    let mon_size = monitor.size();
    let win_size = match window.outer_size() {
        Ok(s) => s,
        Err(_) => return false,
    };

    let min_x = mon_pos.x;
    let min_y = mon_pos.y;
    let max_x = mon_pos.x + mon_size.width as i32 - win_size.width as i32;
    let max_y = mon_pos.y + mon_size.height as i32 - win_size.height as i32;

    if saved.x < min_x || saved.y < min_y || saved.x > max_x || saved.y > max_y {
        log::info!(
            "restore_popup_position: saved position {:?} outside monitor rect, falling back",
            (saved.x, saved.y)
        );
        return false;
    }

    let _ = window.set_position(tauri::PhysicalPosition {
        x: saved.x,
        y: saved.y,
    });
    true
}

fn position_window_at_cursor(
    window: &tauri::WebviewWindow,
    cursor: Option<PhysicalPosition<f64>>,
) {
    if try_restore_popup_position(window) {
        return;
    }
    let Ok(Some(monitor)) = window.primary_monitor() else {
        return;
    };
    let mon_size = monitor.size();
    let mon_pos = monitor.position();
    let scale = monitor.scale_factor();
    let win_size = window.outer_size().unwrap_or(tauri::PhysicalSize {
        width: (400.0 * scale) as u32,
        height: (600.0 * scale) as u32,
    });
    let margin = (8.0 * scale) as i32;

    // No persisted position yet → center on the primary monitor. Predictable
    // first-run behavior; once the user drags the popup, that position is
    // saved and try_restore_popup_position takes over on subsequent shows.
    let _ = cursor;
    let mut x = mon_pos.x + (mon_size.width as i32 - win_size.width as i32) / 2;
    let mut y = mon_pos.y + (mon_size.height as i32 - win_size.height as i32) / 2;

    let min_x = mon_pos.x + margin;
    let min_y = mon_pos.y + margin;
    let max_x = mon_pos.x + mon_size.width as i32 - win_size.width as i32 - margin;
    let max_y = mon_pos.y + mon_size.height as i32 - win_size.height as i32 - margin;
    if x < min_x {
        x = min_x;
    }
    if y < min_y {
        y = min_y;
    }
    if x > max_x {
        x = max_x;
    }
    if y > max_y {
        y = max_y;
    }

    let _ = window.set_position(tauri::PhysicalPosition { x, y });
}
