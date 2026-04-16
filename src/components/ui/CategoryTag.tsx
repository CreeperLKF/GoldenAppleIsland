import type { ToolCategory } from "../../types/events";

const COLORS: Record<ToolCategory, string> = {
  "Shell command": "var(--cat-shell)",
  "File write":    "var(--cat-write)",
  "File read":     "var(--cat-read)",
  "File search":   "var(--cat-search)",
  "Question":      "var(--cat-question)",
  "Permission":    "var(--cat-permission)",
  "Tool call":     "var(--cat-tool)",
};

const LABELS: Record<ToolCategory, string> = {
  "Shell command": "SHELL",
  "File write":    "WRITE",
  "File read":     "READ",
  "File search":   "SEARCH",
  "Question":      "QUESTION",
  "Permission":    "PERMISSION",
  "Tool call":     "TOOL",
};

export default function CategoryTag({ category }: { category: ToolCategory }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden
        style={{
          width: 8, height: 8, borderRadius: "50%",
          background: COLORS[category],
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "var(--fs-caption)",
          lineHeight: 1,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        {LABELS[category]}
      </span>
    </span>
  );
}

/** 同时导出一个给左侧命脉条用的辅助函数 */
export function categoryVeinColor(category: ToolCategory): string {
  return COLORS[category];
}
