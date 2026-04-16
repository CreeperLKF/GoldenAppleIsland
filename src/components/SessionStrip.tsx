import { middleEllipsis } from "../lib/format";

interface SessionStripProps {
  cwd: string;
  autoApprove?: boolean;
}

export default function SessionStrip({ cwd, autoApprove = false }: SessionStripProps) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8,
        height: 26,
        padding: "0 12px",
        background: "var(--bg-surface)",
        boxShadow: "0 0.5px 0 0 var(--border)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-mono-xs)",
          color: "var(--text-tertiary)",
          textTransform: "lowercase",
        }}
      >
        cwd
      </span>
      <span
        className="mono"
        style={{
          fontSize: "var(--fs-mono-sm)",
          color: autoApprove ? "var(--gold)" : "var(--text-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
        title={cwd}
      >
        {middleEllipsis(cwd, 40)}
        {autoApprove && <span style={{ marginLeft: 6, opacity: 0.7 }}>· auto</span>}
      </span>
    </div>
  );
}
