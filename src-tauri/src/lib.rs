mod app_settings;
mod commands;
mod ws;
mod wsl_admin;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();
    log::info!("Claude Hook Guard starting up");
    app_settings::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::respond,
            commands::get_pending_events,
            commands::set_pending_count,
            commands::show_popup,
            commands::hide_popup,
            commands::get_app_settings,
            commands::update_app_settings,
            commands::list_wsl_distros,
            commands::set_hook_enabled,
            commands::set_hook_enabled_all,
            commands::open_settings_window,
        ])
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let settings_item =
                MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &settings_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main")
                .tooltip("Claude Hook Guard")
                .icon(app.default_window_icon().cloned().unwrap())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "settings" => {
                        if let Err(e) = commands::open_settings_window(app.clone()) {
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
                            if visible {
                                let _ = win.hide();
                            } else {
                                position_window_at_cursor(&win, cursor);
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                ws::serve(app_handle).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn position_window_at_cursor(
    window: &tauri::WebviewWindow,
    cursor: Option<PhysicalPosition<f64>>,
) {
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

    let (anchor_x, anchor_y) = match cursor {
        Some(p) => (p.x as i32, p.y as i32),
        None => (
            mon_pos.x + mon_size.width as i32 - margin,
            mon_pos.y + mon_size.height as i32 - margin,
        ),
    };

    let mut x = anchor_x - win_size.width as i32 - margin;
    let mut y = anchor_y - win_size.height as i32 - margin;

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
