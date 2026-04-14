import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import log from "../lib/log";
import HotkeyCaptureInput from "./ui/HotkeyCaptureInput";
import type { AppSettings } from "../types/settings";

interface Props {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => Promise<void>;
}

export default function GlobalShortcutsSection({ settings, onChange }: Props) {
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  const setToggle = useCallback(
    async (accel: string) => {
      try {
        await invoke("set_hotkey", { slot: "toggle_window", accel });
        setToggleError(null);
        await onChange({ hotkey_toggle_window: accel });
      } catch (e) {
        const msg = String(e);
        log.error(`set_hotkey toggle_window failed: ${msg}`);
        setToggleError("Could not register — already in use");
      }
    },
    [onChange],
  );

  const setApprove = useCallback(
    async (accel: string) => {
      try {
        await invoke("set_hotkey", { slot: "approve_all", accel });
        setApproveError(null);
        await onChange({ hotkey_approve_all: accel });
      } catch (e) {
        const msg = String(e);
        log.error(`set_hotkey approve_all failed: ${msg}`);
        setApproveError("Could not register — already in use");
      }
    },
    [onChange],
  );

  return (
    <div className="flex flex-col" style={{ padding: "4px 16px 12px", gap: 10 }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            width: 160,
            flexShrink: 0,
          }}
        >
          Show / hide window
        </span>
        <div style={{ flex: "1 1 auto" }}>
          <HotkeyCaptureInput
            value={settings.hotkey_toggle_window}
            onChange={setToggle}
            ariaLabel="Show or hide window hotkey"
            error={toggleError}
          />
        </div>
      </div>
      <div className="flex items-center" style={{ gap: 12 }}>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            width: 160,
            flexShrink: 0,
          }}
        >
          Approve All
        </span>
        <div style={{ flex: "1 1 auto" }}>
          <HotkeyCaptureInput
            value={settings.hotkey_approve_all}
            onChange={setApprove}
            ariaLabel="Approve All hotkey"
            error={approveError}
          />
        </div>
      </div>
    </div>
  );
}
