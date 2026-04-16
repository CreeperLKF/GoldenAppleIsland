import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Tone = "default" | "danger";
type Size = "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  tone?: Tone;
  size?: Size;
  icon?: ReactNode;
  kbd?: string; // 显示快捷键 hint,如 "A"
  children?: ReactNode;
}

const base: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontFamily: "var(--font-ui)",
  fontWeight: 500,
  borderRadius: 6,
  cursor: "pointer",
  transition: "filter 120ms, background-color 120ms, color 120ms, transform 80ms",
  whiteSpace: "nowrap",
};

function styleFor(variant: Variant, tone: Tone, size: Size): React.CSSProperties {
  const height = size === "sm" ? 24 : 32;
  const padX = size === "sm" ? 10 : 14;
  const fs = size === "sm" ? 12 : 13;
  const common: React.CSSProperties = { ...base, height, padding: `0 ${padX}px`, fontSize: fs };

  if (variant === "primary") {
    return {
      ...common,
      background: "var(--gold)",
      color: "var(--gold-ink)",
      border: "none",
    };
  }
  if (variant === "secondary") {
    return {
      ...common,
      background: "transparent",
      color: tone === "danger" ? "var(--sem-deny)" : "var(--text-primary)",
      border: "0.5px solid var(--border-strong)",
    };
  }
  // ghost
  return {
    ...common,
    background: "transparent",
    color: tone === "danger" ? "var(--sem-deny)" : "var(--text-secondary)",
    border: "none",
  };
}

export default function Button({
  variant = "secondary",
  tone = "default",
  size = "md",
  icon,
  kbd,
  children,
  style,
  className = "",
  ...rest
}: Props) {
  const s = { ...styleFor(variant, tone, size), ...style };
  return (
    <button
      {...rest}
      className={`gai-btn gai-btn--${variant} gai-btn--${tone} ${className}`}
      style={s}
    >
      {icon}
      {children}
      {kbd && (
        <span
          style={{
            marginLeft: 4,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: variant === "primary" ? "rgba(10,10,11,0.55)" : "var(--text-tertiary)",
            fontWeight: 500,
          }}
        >
          {kbd}
        </span>
      )}
    </button>
  );
}
