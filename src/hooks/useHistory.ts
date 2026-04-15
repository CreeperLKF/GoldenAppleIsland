import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import log from "../lib/log";
import type {
  DelegationResolvedPayload,
  HookEvent,
  HookEventDelegatedPayload,
} from "../types/events";

export interface HistoryEntry {
  id: string;
  tool_name: string;
  summary: string;
  action: "approve" | "deny" | "timeout";
  timestamp: string;
  answer?: string;
  source?: "manual" | "auto" | "agent" | "external";
  reason?: string | null;
}

const MAX = 200;

function summarize(event: HookEvent): string {
  const input = event.tool_input as Record<string, unknown>;
  if (typeof input.question === "string") return input.question.slice(0, 60);
  if (typeof input.prompt === "string") return input.prompt.slice(0, 60);
  if (typeof input.command === "string") return input.command.slice(0, 60);
  if (typeof input.file_path === "string") return input.file_path;
  if (typeof input.path === "string") return input.path;
  if (typeof input.pattern === "string") return input.pattern;
  return event.tool_name;
}

export function useHistory() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  // Remember tool_name/summary for in-flight delegated events so that when
  // delegation_resolved fires we can populate a meaningful history row.
  const delegatedMetaRef = useRef<
    Map<string, { tool_name: string; summary: string }>
  >(new Map());

  const push = useCallback((entry: HistoryEntry) => {
    setItems((prev) => {
      const next = [entry, ...prev];
      if (next.length > MAX) next.length = MAX;
      return next;
    });
  }, []);

  useEffect(() => {
    const unsubDelegated = listen<HookEventDelegatedPayload>(
      "hook_event_delegated",
      (evt) => {
        const { event } = evt.payload;
        delegatedMetaRef.current.set(event.id, {
          tool_name: event.tool_name,
          summary: summarize(event),
        });
      },
    );

    const unsubResolved = listen<DelegationResolvedPayload>(
      "delegation_resolved",
      (evt) => {
        const { event_id, action, source, reason } = evt.payload;
        const meta = delegatedMetaRef.current.get(event_id);
        delegatedMetaRef.current.delete(event_id);
        // Only append history rows for terminal approve/deny outcomes
        // coming from the agent/external delegators. escalated / failed /
        // takenover flow through the normal pending queue and record
        // manual history on resolution.
        if (action !== "approve" && action !== "deny") return;
        if (source !== "agent" && source !== "external") return;
        setItems((prev) => {
          const next: HistoryEntry[] = [
            {
              id: event_id,
              tool_name: meta?.tool_name ?? "",
              summary: meta?.summary ?? "",
              action,
              timestamp: new Date().toISOString(),
              source,
              reason: reason ?? null,
            },
            ...prev,
          ];
          if (next.length > MAX) next.length = MAX;
          return next;
        });
      },
    );

    return () => {
      unsubDelegated.then((u) => u()).catch((e) => log.error(String(e)));
      unsubResolved.then((u) => u()).catch((e) => log.error(String(e)));
    };
  }, []);

  return { items, push };
}
