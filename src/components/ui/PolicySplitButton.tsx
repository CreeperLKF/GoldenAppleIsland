import { useEffect, useRef, useState } from "react";
import type { PolicyKind } from "../../types/events";

export type SplitAction = "default" | "auto" | "manual";

const LABELS: Record<SplitAction, string> = {
  default: "use session default",
  auto: "set auto approve",
  manual: "set manual approve",
};

interface Props {
  onCommit: (kind: PolicyKind | null) => void;
  disabled?: boolean;
  initialAction?: SplitAction;
}

function actionToKind(action: SplitAction): PolicyKind | null {
  if (action === "default") return null;
  return action;
}

export default function PolicySplitButton({
  onCommit,
  disabled = false,
  initialAction = "auto",
}: Props) {
  const [staged, setStaged] = useState<SplitAction>(initialAction);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const commit = () => {
    if (disabled) return;
    onCommit(actionToKind(staged));
    setPulsing(true);
    window.setTimeout(() => setPulsing(false), 200);
  };

  const pick = (next: SplitAction) => {
    setStaged(next);
    setMenuOpen(false);
  };

  return (
    <div
      ref={rootRef}
      style={{ position: "relative", display: "inline-flex", height: 24 }}
    >
      <button
        type="button"
        onClick={commit}
        disabled={disabled}
        aria-label={`Commit: ${LABELS[staged]}`}
        className="rounded-l bg-[var(--bg-surface)] text-[var(--text-primary)] hover:brightness-95 disabled:opacity-40"
        style={{
          height: 24,
          minWidth: 140,
          padding: "0 12px",
          fontSize: 12,
          whiteSpace: "nowrap",
          borderWidth: "0.5px",
          borderStyle: "solid",
          borderColor: "var(--border)",
          borderRight: "none",
          filter: pulsing ? "brightness(1.15)" : undefined,
          transition: "filter 180ms ease-out",
        }}
      >
        {LABELS[staged]}
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Open policy menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="rounded-r bg-[var(--bg-surface)] text-[var(--text-primary)] hover:brightness-95"
        style={{
          height: 24,
          width: 20,
          fontSize: 10,
          borderWidth: "0.5px",
          borderStyle: "solid",
          borderColor: "var(--border)",
        }}
      >
        ▼
      </button>
      {menuOpen && (
        <div
          role="menu"
          style={{
            position: "absolute",
            bottom: 26,
            right: 0,
            minWidth: 160,
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border)",
            borderRadius: 4,
            boxShadow: "0 -4px 12px rgba(0,0,0,0.18)",
            zIndex: 10,
            padding: 2,
          }}
        >
          {(Object.keys(LABELS) as SplitAction[]).map((a) => (
            <button
              key={a}
              type="button"
              role="menuitem"
              onClick={() => pick(a)}
              className="w-full text-left hover:bg-[var(--bg-base)]"
              style={{
                display: "block",
                padding: "4px 8px",
                fontSize: 12,
                color:
                  a === staged
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                background: "transparent",
                border: "none",
                borderRadius: 3,
              }}
            >
              {LABELS[a]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
