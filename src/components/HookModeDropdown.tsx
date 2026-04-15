import { useState } from "react";
import CustomModePopover from "./CustomModePopover";
import type { HookTargetConfig, WorkingMode, CustomHookSet } from "../types/modes";
import { EMPTY_CUSTOM } from "../types/modes";

interface Props {
  config: HookTargetConfig;
  onChange: (next: HookTargetConfig) => void;
  disabled?: boolean;
}

const OPTIONS: { value: WorkingMode; label: string }[] = [
  { value: "control", label: "Control" },
  { value: "audit", label: "Audit" },
  { value: "observe", label: "Observe" },
  { value: "custom", label: "Custom" },
];

export default function HookModeDropdown({ config, onChange, disabled }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleSelect = (mode: WorkingMode) => {
    if (mode === "custom") {
      onChange({ mode, custom: config.custom ?? EMPTY_CUSTOM });
      setPopoverOpen(true);
      return;
    }
    onChange({ mode, custom: config.custom ?? EMPTY_CUSTOM });
  };

  const handleCustomChange = (custom: CustomHookSet) => {
    onChange({ mode: "custom", custom });
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <select
        value={config.mode}
        onChange={(e) => handleSelect(e.target.value as WorkingMode)}
        disabled={disabled}
        style={{
          height: 24,
          fontSize: 11,
          padding: "0 6px",
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          border: "0.5px solid var(--border)",
          borderRadius: 4,
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {config.mode === "custom" && (
        <button
          type="button"
          onClick={() => setPopoverOpen((v) => !v)}
          disabled={disabled}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          style={{ fontSize: 10, marginLeft: 4, textDecoration: "underline" }}
        >
          edit
        </button>
      )}
      {popoverOpen && config.mode === "custom" && (
        <CustomModePopover
          value={config.custom}
          onChange={handleCustomChange}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </div>
  );
}
