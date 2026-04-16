import log from "../lib/log";
import type { AppSettings, ThemePref } from "../types/settings";

interface Props {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => Promise<void>;
}

const OPTIONS: { value: ThemePref; label: string; desc: string }[] = [
  { value: "system", label: "System", desc: "Follow Windows app mode" },
  { value: "light",  label: "Light",  desc: "Always light" },
  { value: "dark",   label: "Dark",   desc: "Always dark" },
];

export default function AppearanceSection({ settings, onChange }: Props) {
  const current = settings.theme ?? "system";

  const pick = (next: ThemePref) => {
    onChange({ theme: next }).catch(log.error);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        role="radiogroup"
        aria-label="Theme"
        style={{
          display: "inline-flex",
          background: "var(--bg-subtle)",
          border: "0.5px solid var(--border-strong)",
          borderRadius: "var(--radius-sm)",
          padding: 2,
          width: "fit-content",
        }}
      >
        {OPTIONS.map((o) => {
          const active = o.value === current;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(o.value)}
              style={{
                height: 24,
                padding: "0 12px",
                background: active ? "var(--bg-surface)" : "transparent",
                border: "none",
                borderRadius: 4,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                fontFamily: "var(--font-ui)",
                fontSize: "var(--fs-small)",
                fontWeight: active ? 500 : 400,
                cursor: "pointer",
                boxShadow: active ? "0 0.5px 1px rgba(0,0,0,0.3)" : "none",
                transition: "background-color 120ms, color 120ms",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: "var(--fs-small)", color: "var(--text-tertiary)" }}>
        {OPTIONS.find((o) => o.value === current)?.desc}
      </div>
    </div>
  );
}
