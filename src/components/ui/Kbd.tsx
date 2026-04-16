/** 键盘快捷键 glyph。渲染为 keycap 样式的小字符。 */
export default function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 16,
        padding: "0 4px",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 500,
        color: "var(--text-tertiary)",
        background: "var(--bg-elevated)",
        border: "0.5px solid var(--border)",
        borderRadius: 3,
        lineHeight: 1,
      }}
    >
      {children}
    </kbd>
  );
}
