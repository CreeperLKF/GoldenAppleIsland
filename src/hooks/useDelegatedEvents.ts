import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import log from "../lib/log";
import type {
  DelegatedSummary,
  DelegationKind,
  DelegationResolvedPayload,
  HookEventDelegatedPayload,
} from "../types/events";

export interface DelegatedState {
  event_id: string;
  kind: DelegationKind;
  started_at_ms: number;
  tool_name: string;
  session_cwd: string;
  source_distro: string;
  tool_input: Record<string, unknown> | null;
}

export function useDelegatedEvents() {
  const [delegated, setDelegated] = useState<Map<string, DelegatedState>>(
    () => new Map(),
  );

  useEffect(() => {
    let cancelled = false;

    // Rehydrate from backend in case the popup window was closed mid-delegation.
    invoke<DelegatedSummary[]>("list_delegated")
      .then((list) => {
        if (cancelled) return;
        setDelegated((prev) => {
          const next = new Map(prev);
          for (const s of list) {
            if (!next.has(s.event_id)) {
              next.set(s.event_id, {
                event_id: s.event_id,
                kind: s.kind,
                started_at_ms: s.started_at_ms,
                tool_name: "",
                session_cwd: "",
                source_distro: "",
                tool_input: null,
              });
            }
          }
          return next;
        });
      })
      .catch((e) => log.error(`list_delegated failed: ${String(e)}`));

    const unsubDelegated = listen<HookEventDelegatedPayload>(
      "hook_event_delegated",
      (evt) => {
        const { event, kind } = evt.payload;
        setDelegated((prev) => {
          const next = new Map(prev);
          next.set(event.id, {
            event_id: event.id,
            kind,
            started_at_ms: Date.now(),
            tool_name: event.tool_name,
            session_cwd: event.session_cwd,
            source_distro: event.source_distro,
            tool_input: event.tool_input,
          });
          return next;
        });
      },
    );

    const unsubResolved = listen<DelegationResolvedPayload>(
      "delegation_resolved",
      (evt) => {
        const { event_id } = evt.payload;
        setDelegated((prev) => {
          if (!prev.has(event_id)) return prev;
          const next = new Map(prev);
          next.delete(event_id);
          return next;
        });
      },
    );

    return () => {
      cancelled = true;
      void unsubDelegated.then((fn) => fn());
      void unsubResolved.then((fn) => fn());
    };
  }, []);

  const takeOver = useCallback(async (event_id: string) => {
    await invoke("take_over_delegated", { eventId: event_id });
  }, []);

  return {
    delegated: Array.from(delegated.values()),
    takeOver,
  };
}
