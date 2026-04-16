import { useCallback, useState } from "react";
import Button from "./ui/Button";
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
    <div className="flex flex-col" style={{ gap: 8 }}>
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
            fontSize: "var(--fs-body)",
            height: 28,
            width: 100,
            padding: "0 8px",
            borderColor: "var(--border)",
          }}
        />
        <Button variant="primary" size="sm" onClick={save} disabled={!changed}>
          Save
        </Button>
        {!valid && draft.length > 0 && (
          <span style={{ fontSize: "var(--fs-small)", color: "var(--sem-deny)" }}>
            Port must be 1024–65535
          </span>
        )}
      </div>
      {saved && (
        <div
          className="rounded"
          style={{
            fontSize: "var(--fs-small)",
            padding: "6px 10px",
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            border: "0.5px solid var(--border)",
          }}
        >
          Port updated. Restart the app to apply the new port. Hook registrations will be updated on next check.
        </div>
      )}
    </div>
  );
}
