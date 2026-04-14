use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Slot {
    ToggleWindow,
    ApproveAll,
}

impl Slot {
    pub fn from_str_snake(s: &str) -> Option<Self> {
        match s {
            "toggle_window" => Some(Slot::ToggleWindow),
            "approve_all" => Some(Slot::ApproveAll),
            _ => None,
        }
    }
}

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use crate::app_settings;

pub fn register_all(app: &AppHandle) -> Result<(), String> {
    let settings = app_settings::get();
    set_impl(app, Slot::ToggleWindow, &settings.hotkey_toggle_window)?;
    set_impl(app, Slot::ApproveAll, &settings.hotkey_approve_all)?;
    Ok(())
}

pub fn set(app: &AppHandle, slot: Slot, accel: &str) -> Result<(), String> {
    set_impl(app, slot, accel)
}

fn set_impl(app: &AppHandle, slot: Slot, accel: &str) -> Result<(), String> {
    let gs = app.global_shortcut();

    // Always unregister any previous binding for this slot first.
    let old = match slot {
        Slot::ToggleWindow => app_settings::get().hotkey_toggle_window,
        Slot::ApproveAll => app_settings::get().hotkey_approve_all,
    };
    if !old.is_empty() {
        let _ = gs.unregister(old.as_str());
    }

    if accel.is_empty() {
        return Ok(());
    }

    gs.on_shortcut(accel, move |app, _sc, _event| {
        dispatch(app, slot);
    })
    .map_err(|e| format!("register '{}' failed: {}", accel, e))?;

    Ok(())
}

fn dispatch(app: &AppHandle, slot: Slot) {
    match slot {
        Slot::ToggleWindow => toggle_window(app),
        Slot::ApproveAll => {
            if let Some(win) = app.get_webview_window("main") {
                if let Err(e) = win.emit("hotkey_approve_all", ()) {
                    log::warn!("emit hotkey_approve_all failed: {}", e);
                }
            }
        }
    }
}

fn toggle_window(app: &AppHandle) {
    let Some(win) = app.get_webview_window("main") else {
        return;
    };
    let visible = win.is_visible().unwrap_or(false);
    if visible {
        let _ = win.hide();
        crate::sync_show_check(false);
    } else {
        let _ = win.show();
        let _ = win.set_focus();
        crate::sync_show_check(true);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slot_round_trips_through_snake_case() {
        assert_eq!(Slot::from_str_snake("toggle_window"), Some(Slot::ToggleWindow));
        assert_eq!(Slot::from_str_snake("approve_all"), Some(Slot::ApproveAll));
        assert_eq!(Slot::from_str_snake("bogus"), None);
    }

    #[test]
    fn slot_serde_snake_case() {
        let json = serde_json::to_string(&Slot::ToggleWindow).unwrap();
        assert_eq!(json, "\"toggle_window\"");
        let parsed: Slot = serde_json::from_str("\"approve_all\"").unwrap();
        assert_eq!(parsed, Slot::ApproveAll);
    }
}
