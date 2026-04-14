use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{OnceLock, RwLock};

use serde::{Deserialize, Serialize};
use crate::policy::ApprovalPolicies;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedHookStatus {
    #[serde(default)]
    pub scripts_installed: bool,
    #[serde(default)]
    pub registered: bool,
    #[serde(default = "default_port")]
    pub port: u16,
}

fn default_port() -> u16 {
    19876
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default = "default_true")]
    pub toast_enabled: bool,
    #[serde(default = "default_true")]
    pub sound_enabled: bool,
    #[serde(default = "default_true")]
    pub always_on_top: bool,
    #[serde(default)]
    pub collapsed: bool,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default)]
    pub log_to_file: bool,
    #[serde(default)]
    pub wsl_status_cache: HashMap<String, CachedHookStatus>,
    #[serde(default)]
    pub windows_hook_cache: Option<CachedHookStatus>,
    #[serde(default)]
    pub approval_policies: ApprovalPolicies,
    #[serde(default)]
    pub settings_last_tab: Option<String>,
}

fn default_true() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            toast_enabled: true,
            sound_enabled: true,
            always_on_top: true,
            collapsed: false,
            port: 19876,
            log_to_file: false,
            wsl_status_cache: HashMap::new(),
            windows_hook_cache: None,
            approval_policies: ApprovalPolicies::default(),
            settings_last_tab: None,
        }
    }
}

static SETTINGS: OnceLock<RwLock<AppSettings>> = OnceLock::new();

fn cell() -> &'static RwLock<AppSettings> {
    SETTINGS.get_or_init(|| RwLock::new(load()))
}

pub fn path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("golden-apple-island").join("settings.json")
}

pub fn log_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("golden-apple-island").join("logs")
}

/// Rotate log files: delete .prev, rename current → .prev, return path for new log.
pub fn rotate_logs() -> std::io::Result<PathBuf> {
    let dir = log_dir();
    fs::create_dir_all(&dir)?;
    let current = dir.join("guard.log");
    let prev = dir.join("guard.log.prev");
    if prev.exists() {
        fs::remove_file(&prev)?;
    }
    if current.exists() {
        fs::rename(&current, &prev)?;
    }
    Ok(current)
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
