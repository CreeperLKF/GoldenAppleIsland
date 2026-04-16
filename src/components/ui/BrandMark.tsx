/**
 * 金苹果轮廓 —— 品牌 mark。
 * 单色(currentColor),由父级 color 决定实色或暗色。
 * 添加 live=true 时启用 apple-pulse 动画。
 */
interface Props {
  size?: number;
  live?: boolean;
  title?: string;
}

export default function BrandMark({ size = 16, live = false, title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={!title}
      className={live ? "brand-mark--live" : undefined}
    >
      {/* Stem + leaf */}
      <path
        d="M12.6 5.2c0.4-1.6 1.8-2.7 3.4-2.7-0.2 1.7-1.4 2.9-3 3.1"
        opacity="0.85"
      />
      {/* Apple body (rounded heart shape) */}
      <path d="M12 6.5c-1.2-0.9-2.6-1.4-3.9-1.1-2.7 0.6-4.1 3.4-3.4 6.6 0.4 2 1.6 4.5 3.2 6.3 1.3 1.4 2.7 2.2 4.1 2.2 1.4 0 2.8-0.8 4.1-2.2 1.6-1.8 2.8-4.3 3.2-6.3 0.7-3.2-0.7-6-3.4-6.6-1.3-0.3-2.7 0.2-3.9 1.1z" />
    </svg>
  );
}
