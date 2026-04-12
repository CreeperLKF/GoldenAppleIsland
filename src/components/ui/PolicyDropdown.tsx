import type { PolicyKind } from "../../types/events";

export type DropdownValue = PolicyKind | "inherit";

interface Props {
  value: DropdownValue;
  allowInherit: boolean;
  onChange: (next: DropdownValue) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
  disabled?: boolean;
}

export default function PolicyDropdown({
  value,
  allowInherit,
  onChange,
  size = "md",
  ariaLabel,
  disabled = false,
}: Props) {
  const height = size === "sm" ? 20 : 24;
  const fontSize = size === "sm" ? 11 : 12;
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
      {allowInherit && <option value="inherit">Use inherited</option>}
      <option value="auto">Force Auto</option>
      <option value="manual">Force Manual</option>
    </select>
  );
}
