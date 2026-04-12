import { useCallback, useState } from "react";
import type { AppSettings } from "../types/settings";

interface PortSectionProps {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => Promise<void>;
}

export default function PortSection({ settings, onChange }: PortSectionProps) {
  const [draft, setDraft] = useState(String(settings.port));
  const [saved, setSaved] = useState(false);

  const currentPort = settings.port;
  const draftNum = Number.parseInt(draft, 10);
  const valid = !Number.isNaN(draftNum) && draftNum >= 1024 && draftNum <= 65535;
  const changed = valid && draftNum !== currentPort;

  const save = useCallback(async () => {
    if (!changed) return;
    await onChange({ port: draftNum });
    setSaved(true);
  }, [changed, draftNum, onChange]);

  return (
    <section className="flex flex-col" style={{ padding: "12px 16px", gap: 8 }}>
      <h2
        className="font-semibold text-[var(--text-primary)]"
        style={{ fontSize: 13, margin: 0 }}
      >
        WebSocket Port
      </h2>
      <div className="flex items-center" style={{ gap: 8 }}>
        <input
          type="number"
          min={1024}
          max={65535}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          className="rounded border bg-[var(--bg-surface)] text-[var(--text-primary)]"
          style={{
            fontSize: 13,
            height: 28,
            width: 100,
            padding: "0 8px",
            borderColor: "var(--border)",
          }}
        />
        <button
          type="button"
          onClick={save}
          disabled={!changed}
          className="rounded border hover:brightness-95 disabled:opacity-40"
          style={{
            fontSize: 12,
            height: 28,
            padding: "0 12px",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            background: "var(--bg-elevated)",
          }}
        >
          Save
        </button>
        {!valid && draft.length > 0 && (
          <span className="text-[var(--deny-text)]" style={{ fontSize: 11 }}>
            Port must be 1024–65535
          </span>
        )}
      </div>
      {saved && (
        <div
          className="rounded"
          style={{
            fontSize: 11,
            padding: "6px 10px",
            background: "var(--badge-shell-bg)",
            color: "var(--badge-shell-text)",
            border: "0.5px solid var(--border)",
          }}
        >
          Port updated. Restart the app to apply the new port. Hook registrations will be updated on next check.
        </div>
      )}
    </section>
  );
}
