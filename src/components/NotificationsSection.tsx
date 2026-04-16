import Toggle from "./ui/Toggle";
import type { AppSettings } from "../types/settings";

interface NotificationsSectionProps {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}

export default function NotificationsSection({
  settings,
  onChange,
}: NotificationsSectionProps) {
  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col" style={{ gap: 2 }}>
          <span
            className="text-[var(--text-primary)]"
            style={{ fontSize: "var(--fs-body)", fontWeight: 500 }}
          >
            Show Windows toast on new event
          </span>
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: "var(--fs-small)" }}>
            Popup cards still appear regardless of this setting.
          </span>
        </div>
        <Toggle
          checked={settings.toast_enabled}
          onChange={(v) => onChange({ toast_enabled: v })}
          ariaLabel="Toggle Windows toast notifications"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col" style={{ gap: 2 }}>
          <span
            className="text-[var(--text-primary)]"
            style={{
              fontSize: "var(--fs-body)",
              fontWeight: 500,
              opacity: settings.toast_enabled ? 1 : 0.5,
            }}
          >
            Play sound with toast
          </span>
          <span
            className="text-[var(--text-tertiary)]"
            style={{ fontSize: "var(--fs-small)", opacity: settings.toast_enabled ? 1 : 0.5 }}
          >
            Uses the default Windows notification chime.
          </span>
        </div>
        <Toggle
          checked={settings.sound_enabled}
          onChange={(v) => onChange({ sound_enabled: v })}
          disabled={!settings.toast_enabled}
          ariaLabel="Toggle notification sound"
        />
      </div>
    </div>
  );
}
