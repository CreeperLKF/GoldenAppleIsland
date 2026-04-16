import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppSettings } from "./useAppSettings";

export type ThemePref = "system" | "light" | "dark";

function resolve(pref: ThemePref): "light" | "dark" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

function apply(resolved: "light" | "dark") {
  document.documentElement.dataset.theme = resolved;
}

/**
 * 在应用根部挂一次即可。
 * - 读 AppSettings.theme
 * - 写 <html data-theme="light|dark">
 * - System 模式下监听 prefers-color-scheme 变化
 * - 监听跨窗口的 app_settings_changed event (可选, backend 支持时生效)
 */
export function useTheme() {
  const { settings } = useAppSettings();
  const pref = (settings?.theme ?? "system") as ThemePref;

  useEffect(() => {
    apply(resolve(pref));
  }, [pref]);

  // System 模式:响应 OS 切换
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(resolve("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  // 跨窗口同步(如果后端 emit 了 app_settings_changed)
  useEffect(() => {
    const unlisten = listen<{ theme?: ThemePref }>("app_settings_changed", (evt) => {
      const next = evt.payload.theme ?? "system";
      apply(resolve(next));
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);
}
