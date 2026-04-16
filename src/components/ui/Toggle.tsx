interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        padding: 2,
        background: checked ? "var(--sem-approve)" : "var(--text-tertiary)",
        border: "0.5px solid var(--border)",
        justifyContent: checked ? "flex-end" : "flex-start",
      }}
    >
      <span
        className="block bg-white shadow"
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          transition: "transform 150ms ease",
        }}
      />
    </button>
  );
}
