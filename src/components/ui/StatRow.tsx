import type { ReactNode } from "react";

interface Props {
  label: string;
  value?: ReactNode;   // 中栏内容(可以是文字、input、component)
  action?: ReactNode;  // 右侧按钮
  mono?: boolean;      // value 是否 mono
  align?: "center" | "start";
}

export default function StatRow({ label, value, action, mono = false, align = "center" }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr auto",
        alignItems: align === "center" ? "center" : "start",
        gap: 12,
        minHeight: 28,
        padding: "3px 0",
      }}
    >
      <div
        className="caption"
        style={{
          color: "var(--text-secondary)",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)",
          fontSize: mono ? "var(--fs-mono-sm)" : "var(--fs-small)",
          color: "var(--text-primary)",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
