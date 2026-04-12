import { invoke } from "@tauri-apps/api/core";

let enabled = false;

export function initLog(logToFile: boolean) {
  enabled = logToFile;
}

function send(level: "info" | "warn" | "error", ...args: unknown[]) {
  if (!enabled) return;
  const message = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  invoke("write_log", { level, message }).catch(() => {});
}

const log = {
  info: (...args: unknown[]) => send("info", ...args),
  warn: (...args: unknown[]) => send("warn", ...args),
  error: (...args: unknown[]) => send("error", ...args),
};

export default log;
