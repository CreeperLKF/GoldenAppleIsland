import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { initLog } from "../lib/log";
import type { AppSettings } from "../types/settings";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logInitialized = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await invoke<AppSettings>("get_app_settings");
        if (!cancelled) {
          setSettings(result);
          if (!logInitialized.current) {
            initLog(result.log_to_file);
            logInitialized.current = true;
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    try {
      const result = await invoke<AppSettings>("update_app_settings", { patch });
      setSettings(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return { settings, loading, error, update };
}
