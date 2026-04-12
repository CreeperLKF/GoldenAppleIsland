use std::fs::File;
use std::io::Write;
use std::sync::Mutex;

use log::{Level, LevelFilter, Log, Metadata, Record};

use crate::app_settings;

static LOG_FILE: std::sync::OnceLock<Mutex<File>> = std::sync::OnceLock::new();

struct DualLogger;

impl Log for DualLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= Level::Info
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let line = format!(
            "{} [{}] {} - {}\n",
            now,
            record.level(),
            record.target(),
            record.args()
        );

        // Always write to stderr
        let _ = eprint!("{}", line);

        // Write to file if available
        if let Some(mtx) = LOG_FILE.get() {
            if let Ok(mut f) = mtx.lock() {
                let _ = f.write_all(line.as_bytes());
                let _ = f.flush();
            }
        }
    }

    fn flush(&self) {
        if let Some(mtx) = LOG_FILE.get() {
            if let Ok(mut f) = mtx.lock() {
                let _ = f.flush();
            }
        }
    }
}

static LOGGER: DualLogger = DualLogger;

pub fn init_with_file() {
    match app_settings::rotate_logs() {
        Ok(log_path) => {
            match File::create(&log_path) {
                Ok(file) => {
                    let _ = LOG_FILE.set(Mutex::new(file));
                    eprintln!("[file_logger] logging to {}", log_path.display());
                }
                Err(e) => {
                    eprintln!("[file_logger] failed to create {}: {}", log_path.display(), e);
                }
            }
        }
        Err(e) => {
            eprintln!("[file_logger] rotate_logs failed: {}", e);
        }
    }

    log::set_logger(&LOGGER).expect("failed to set logger");
    log::set_max_level(LevelFilter::Info);
}

/// Write a log line from the frontend. Called via Tauri command.
pub fn write_frontend_log(level: &str, message: &str) {
    let lvl = match level {
        "error" => Level::Error,
        "warn" => Level::Warn,
        "info" => Level::Info,
        _ => Level::Info,
    };
    log::log!(target: "frontend", lvl, "{}", message);
}
