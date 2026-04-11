import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { HookEvent } from "../types/events";

const FADE_MS = 200;

export function usePendingEvents() {
  const [pending, setPending] = useState<HookEvent[]>([]);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const lastCountRef = useRef<number>(-1);

  useEffect(() => {
    const visibleCount = pending.filter((e) => !resolving.has(e.id)).length;
    if (visibleCount !== lastCountRef.current) {
      lastCountRef.current = visibleCount;
      invoke("set_pending_count", { count: visibleCount }).catch(() => {});
    }
  }, [pending, resolving]);

  const enqueue = useCallback((event: HookEvent) => {
    setPending((prev) => {
      if (prev.some((e) => e.id === event.id)) return prev;
      return [...prev, event];
    });
  }, []);

  const resolve = useCallback(
    (id: string, action: "approve" | "deny") => {
      invoke("respond", { id, action }).catch(() => {});
      setResolving((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      window.setTimeout(() => {
        setPending((prev) => prev.filter((e) => e.id !== id));
        setResolving((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, FADE_MS);
    },
    [],
  );

  return { pending, resolving, enqueue, resolve };
}
