import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  tone?: "default" | "gold";
}

export default function SectionCard({
  title, description, action, children, id, tone = "default",
}: Props) {
  return (
    <section
      id={id}
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        ...(tone === "gold" ? { borderColor: "var(--border-gold)" } : null),
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "0.5px solid var(--border)",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div
            className="caption"
            style={{ color: "var(--text-secondary)" }}
          >
            {title}
          </div>
          {description && (
            <div style={{
              fontSize: "var(--fs-small)",
              lineHeight: "var(--lh-small)",
              color: "var(--text-tertiary)",
            }}>
              {description}
            </div>
          )}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </header>
      <div style={{ padding: "12px 14px" }}>{children}</div>
    </section>
  );
}
