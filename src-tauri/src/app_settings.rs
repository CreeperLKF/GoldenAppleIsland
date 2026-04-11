use std::fs;
use std::path::PathBuf;
use std::sync::{OnceLock, RwLock};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default = "default_true")]
    pub toast_enabled: bool,
    #[serde(default = "default_true")]
    pub sound_enabled: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            toast_enabled: true,
            sound_enabled: true,
        }
    }
}

static SETTINGS: OnceLock<RwLock<AppSettings>> = OnceLock::new();

fn cell() -> &'static RwLock<AppSettings> {
    SETTINGS.get_or_init(|| RwLock::new(load()))
}

pub fn path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("claude-hook-guard").join("settings.json")
}

fn load() -> AppSettings {
    let p = path();
    match fs::read_to_string(&p) {
        Ok(s) => match serde_json::from_str::<AppSettings>(&s) {
            Ok(v) => v,
            Err(e) => {
                log::warn!(
                    "app_settings: {} is not valid JSON ({}); using defaults",
                    p.display(),
                    e
                );
                AppSettings::default()
            }
        },
        Err(_) => AppSettings::default(),
    }
}

pub fn init() {
    let _ = cell();
    log::info!(
        "app_settings loaded from {} ({:?})",
        path().display(),
        get()
    );
}

pub fn get() -> AppSettings {
    cell().read().expect("settings lock poisoned").clone()
}

pub fn set(next: AppSettings) -> AppSettings {
    {
        let mut guard = cell().write().expect("settings lock poisoned");
        *guard = next.clone();
    }
    if let Err(e) = save(&next) {
        log::warn!("app_settings: failed to persist: {}", e);
    }
    next
}

fn save(settings: &AppSettings) -> std::io::Result<()> {
    let p = path();
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    let tmp = p.with_extension("json.tmp");
    fs::write(&tmp, json.as_bytes())?;
    fs::rename(&tmp, &p)?;
    Ok(())
}
