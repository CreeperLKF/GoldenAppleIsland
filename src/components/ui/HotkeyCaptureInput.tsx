import { useState, useCallback, useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (accel: string) => Promise<void>;
  ariaLabel: string;
  error?: string | null;
}

// Map a keyboard event to a Tauri v2 accelerator string, e.g. "Super+Shift+KeyA".
// Returns null when the user only pressed modifier keys.
function eventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Super");

  const code = e.code;
  const isModifierOnly =
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "ControlLeft" ||
    code === "ControlRight" ||
    code === "AltLeft" ||
    code === "AltRight" ||
    code === "MetaLeft" ||
    code === "MetaRight" ||
    code === "OSLeft" ||
    code === "OSRight";
  if (isModifierOnly) return null;

  parts.push(code);
  return parts.join("+");
}

function humanize(accel: string): string {
  if (!accel) return "";
  return accel
    .split("+")
    .map((p) => (p.startsWith("Key") ? p.slice(3) : p))
    .join(" + ");
}

export default function HotkeyCaptureInput({
  value,
  onChange,
  ariaLabel,
  error,
}: Props) {
  const [capturing, setCapturing] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(false);
        return;
      }
      const accel = eventToAccelerator(e);
      if (accel === null) return;
      setCapturing(false);
      void onChange(accel);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, onChange]);

  const startCapture = useCallback(() => {
    setCapturing(true);
    ref.current?.focus();
  }, []);

  const clear = useCallback(() => {
    void onChange("");
  }, [onChange]);

  const display = capturing ? "Press a key combo…" : humanize(value) || "Click to bind";

  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      <div className="flex items-center" style={{ gap: 6 }}>
        <button
          ref={ref}
          type="button"
          onClick={startCapture}
          aria-label={ariaLabel}
          className="rounded bg-[var(--bg-elevated)] hover:brightness-95"
          style={{
            flex: "1 1 auto",
            height: 24,
            fontSize: 12,
            padding: "0 8px",
            textAlign: "left",
            border: "0.5px solid var(--border)",
            color: capturing
              ? "var(--text-tertiary)"
              : value
                ? "var(--text-primary)"
                : "var(--text-tertiary)",
          }}
        >
          {display}
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={!value && !capturing}
          className="rounded hover:brightness-95 disabled:opacity-40"
          style={{
            height: 24,
            fontSize: 11,
            padding: "0 8px",
            border: "0.5px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
          }}
        >
          Clear
        </button>
      </div>
      {error && (
        <span style={{ fontSize: 11, color: "var(--deny-text)" }}>{error}</span>
      )}
    </div>
  );
}
