import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { HookEvent } from "../types/events";

export function useWebSocket(onEvent: (event: HookEvent) => void) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    listen<HookEvent>("hook_event", (msg) => {
      onEvent(msg.payload);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [onEvent]);
}
