/**
 * 统一的线性 icon 集合。
 * 替换当前散落各处的 inline <svg> 与 emoji 字符 (⟳ ▾ ▸ 📌 ⌘ 等)。
 */
type IconName =
  | "pin"
  | "settings"
  | "minimize"
  | "chevron-up"
  | "chevron-down"
  | "chevron-right"
  | "loader"
  | "check"
  | "x"
  | "plus"
  | "folder"
  | "dot"
  | "kbd-return";

const PATHS: Record<IconName, string> = {
  pin: "M12 17v5 M9 2h6l-1 7h4l-2 4H8l-2-4h4L9 2z",
  settings:
    "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33 1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82 1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
  minimize: "M5 12h14",
  "chevron-up":    "M6 15l6-6 6 6",
  "chevron-down":  "M6 9l6 6 6-6",
  "chevron-right": "M9 6l6 6-6 6",
  loader: "M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83",
  check: "M5 12l5 5L20 7",
  x: "M6 6l12 12 M18 6l-12 12",
  plus: "M12 5v14 M5 12h14",
  folder: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
  dot: "M12 12h.01",
  "kbd-return": "M9 14l-4-4 4-4 M5 10h10a4 4 0 014 4v2",
};

interface Props {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export default function Icon({ name, size = 16, strokeWidth = 1.75, className, style, title }: Props) {
  const d = PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={!title}
    >
      {/* multi-path split by " M " prefix */}
      {d.split(/(?=M)/).map((seg, i) => (
        <path key={i} d={seg} />
      ))}
    </svg>
  );
}
