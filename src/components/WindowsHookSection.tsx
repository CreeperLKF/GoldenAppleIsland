import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Toggle from "./ui/Toggle";
import type { HookStatus } from "../types/settings";
import HookModeDropdown from "./HookModeDropdown";
import { DEFAULT_CONFIG } from "../types/modes";
import { useAppSettings } from "../hooks/useAppSettings";

export default function WindowsHookSection() {
  const [status, setStatus] = useState<HookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings, update: updateSettings } = useAppSettings();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await invoke<HookStatus>("get_windows_hook_status");
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (enabled: boolean) => {
      setBusy(true);
      setError(null);
      try {
        await invoke("set_windows_hook_enabled", { enabled });
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const enabled = status?.registered ?? false;
  const statusLabel = status
    ? enabled
      ? status.scripts_installed
        ? "Registered"
        : "Registered (scripts missing)"
      : "Not registered"
    : "";

  const statusColor = enabled ? "var(--approve-text)" : "var(--text-tertiary)";

  return (
    <section className="flex flex-col" style={{ padding: "12px 16px", gap: 10 }}>
      <h2
        className="font-semibold text-[var(--text-primary)]"
        style={{ fontSize: 13, margin: 0 }}
      >
        Windows Hook
      </h2>

      {loading && (
        <div className="text-[var(--text-tertiary)]" style={{ fontSize: 12 }}>
          Checking…
        </div>
      )}

      {error && (
        <div
          className="rounded"
          style={{
            fontSize: 12,
            padding: "8px 10px",
            background: "var(--deny-bg)",
            color: "var(--deny-text)",
            border: "0.5px solid var(--deny-text)",
          }}
        >
          {error}
        </div>
      )}

      {!loading && status && (
        <div
          className="flex items-center justify-between bg-[var(--bg-surface)]"
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "0.5px solid var(--border)",
          }}
        >
          <div className="flex flex-col" style={{ gap: 2 }}>
            <span
              className="text-[var(--text-primary)]"
              style={{ fontSize: 13, fontWeight: 500 }}
            >
              Claude Code (Windows)
            </span>
            <span style={{ fontSize: 11, color: statusColor }}>{statusLabel}</span>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <HookModeDropdown
              config={settings?.windows_hook_config ?? DEFAULT_CONFIG}
              onChange={async (next) => {
                await invoke("set_windows_hook_config", { config: next });
                await updateSettings({});
              }}
              disabled={busy}
            />
            {busy && (
              <span className="text-[var(--text-tertiary)]" style={{ fontSize: 11 }}>
                …
              </span>
            )}
            <Toggle
              checked={enabled}
              onChange={toggle}
              disabled={busy}
              ariaLabel={enabled ? "Disable Windows hook" : "Enable Windows hook"}
            />
          </div>
        </div>
      )}
    </section>
  );
}
