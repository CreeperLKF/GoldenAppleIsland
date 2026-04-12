import type { PolicyKind } from "../../types/events";

export type DropdownValue = PolicyKind | "inherit";

interface Props {
  value: DropdownValue;
  allowInherit: boolean;
  onChange: (next: DropdownValue) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
  disabled?: boolean;
  labels?: {
    auto?: string;
    manual?: string;
    inherit?: string;
  };
}

export default function PolicyDropdown({
  value,
  allowInherit,
  onChange,
  size = "md",
  ariaLabel,
  disabled = false,
  labels,
}: Props) {
  const height = size === "sm" ? 20 : 24;
  const fontSize = size === "sm" ? 11 : 12;
  const autoLabel = labels?.auto ?? "Force Auto";
  const manualLabel = labels?.manual ?? "Force Manual";
  const inheritLabel = labels?.inherit ?? "Use inherited";
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as DropdownValue)}
      className="rounded bg-[var(--bg-surface)] text-[var(--text-primary)] hover:brightness-95 disabled:opacity-40"
      style={{
        height,
        fontSize,
        padding: "0 6px",
        borderWidth: "0.5px",
        borderStyle: "solid",
        borderColor: "var(--border)",
      }}
    >
      {allowInherit && <option value="inherit">{inheritLabel}</option>}
      <option value="auto">{autoLabel}</option>
      <option value="manual">{manualLabel}</option>
    </select>
  );
}
