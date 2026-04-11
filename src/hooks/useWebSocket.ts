import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { HookEvent } from "../types/events";

export function useWebSocket(onEvent: (event: HookEvent) => void) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        unlisten = await listen<HookEvent>("hook_event", (msg) => {
          onEvent(msg.payload);
        });
        if (cancelled) {
          unlisten?.();
          return;
        }
        const queued = await invoke<HookEvent[]>("get_pending_events");
        if (cancelled) return;
        for (const event of queued) onEvent(event);
      } catch {
        /* Tauri API unavailable or event channel denied */
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [onEvent]);
}
