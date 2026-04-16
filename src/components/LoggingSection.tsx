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
    <div className="flex flex-col" style={{ gap: 12 }}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col" style={{ gap: 2 }}>
          <span
            className="text-[var(--text-primary)]"
            style={{ fontSize: "var(--fs-body)", fontWeight: 500 }}
          >
            Write logs to file
          </span>
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: "var(--fs-small)" }}>
            Saves frontend and backend logs. Keeps last 2 launches.
          </span>
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: "var(--fs-small)" }}>
            Restart required to take effect.
          </span>
          {logDir && (
            <span
              className="text-[var(--text-tertiary)]"
              style={{ fontSize: "var(--fs-mono-xs)", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}
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
    </div>
  );
}
