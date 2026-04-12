import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Toggle from "./ui/Toggle";
import type { AppSettings } from "../types/settings";

interface LoggingSectionProps {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}

export default function LoggingSection({
  settings,
  onChange,
}: LoggingSectionProps) {
  const [logDir, setLogDir] = useState<string | null>(null);

  useEffect(() => {
    invoke<string>("get_log_dir").then(setLogDir).catch(() => {});
  }, []);

  return (
    <section className="flex flex-col" style={{ padding: "12px 16px", gap: 12 }}>
      <h2
        className="font-semibold text-[var(--text-primary)]"
        style={{ fontSize: 13, margin: 0 }}
      >
        Debug Logging
      </h2>

      <div className="flex items-center justify-between">
        <div className="flex flex-col" style={{ gap: 2 }}>
          <span
            className="text-[var(--text-primary)]"
            style={{ fontSize: 12, fontWeight: 500 }}
          >
            Write logs to file
          </span>
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: 11 }}>
            Saves frontend and backend logs. Keeps last 2 launches.
          </span>
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: 11 }}>
            Restart required to take effect.
          </span>
          {logDir && (
            <span
              className="text-[var(--text-tertiary)]"
              style={{ fontSize: 10, fontFamily: "monospace", wordBreak: "break-all" }}
            >
              {logDir}
            </span>
          )}
        </div>
        <Toggle
          checked={settings.log_to_file}
          onChange={(v) => onChange({ log_to_file: v })}
          ariaLabel="Toggle debug logging to file"
        />
      </div>
    </section>
  );
}
