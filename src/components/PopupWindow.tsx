import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import log from "../lib/log";
import Header from "./Header";
import SessionStrip from "./SessionStrip";
import ApprovalCard from "./ApprovalCard";
import QuestionCard from "./QuestionCard";
import EmptyState from "./EmptyState";
import PolicyPanel from "./PolicyPanel";
import HistoryList from "./HistoryList";
import { usePendingEvents } from "../hooks/usePendingEvents";
import { useWebSocket } from "../hooks/useWebSocket";
import { useConnection } from "../hooks/useConnection";
import { useHistory } from "../hooks/useHistory";
import { useApprovalPolicies } from "../hooks/useApprovalPolicies";
import { useAppSettings } from "../hooks/useAppSettings";
import type { HookEvent, PolicyKind, PolicyScope } from "../types/events";
import { detectVariant } from "../types/events";
import type { DropdownValue } from "./ui/PolicyDropdown";

const APPROVE_ALL_STAGGER_MS = 50;

function summarize(event: HookEvent): string {
  const input = event.tool_input as Record<string, unknown>;
  if (typeof input.question === "string") return input.question.slice(0, 60);
  if (typeof input.prompt === "string") return input.prompt.slice(0, 60);
  if (typeof input.command === "string") return input.command;
  if (typeof input.file_path === "string") return input.file_path;
  if (typeof input.path === "string") return input.path;
  if (typeof input.pattern === "string") return input.pattern;
  return event.tool_name;
}

export default function PopupWindow() {
  const { items: history, push: pushHistory } = useHistory();
  const { clientCount } = useConnection();

  const onResolve = useCallback(
    (event: HookEvent, action: "approve" | "deny", answer?: string) => {
      pushHistory({
        id: event.id,
        tool_name: event.tool_name,
        summary: summarize(event),
        action,
        timestamp: new Date().toISOString(),
        answer,
      });
    },
    [pushHistory],
  );

  const { pending, resolving, enqueue, resolve } = usePendingEvents({
    onResolve,
  });

  const [showUpdateHint, setShowUpdateHint] = useState(false);
  // Tracks the most recently seen event so the policy dropdown remains
  // actionable after the queue drains — the user can pre-set Force Auto
  // before the next event for the same session arrives.
  const [lastSeenEvent, setLastSeenEvent] = useState<HookEvent | null>(null);

  const onEvent = useCallback(
    (event: HookEvent) => {
      if (event.source_distro === "unknown" && !showUpdateHint) {
        setShowUpdateHint(true);
      }
      setLastSeenEvent(event);
      enqueue(event);
    },
    [enqueue, showUpdateHint],
  );

  useWebSocket(onEvent);

  const { policies, setSession, removeSession } = useApprovalPolicies();

  const visible = useMemo(
    () => pending.filter((e) => !resolving.has(e.id)),
    [pending, resolving],
  );

  const sharedCwd = useMemo(() => {
    if (visible.length === 0) return null;
    const first = visible[0].session_cwd;
    return visible.every((e) => e.session_cwd === first) ? first : null;
  }, [visible]);

  const connected = clientCount > 0;

  const { settings: appSettings, update: updateSettings } = useAppSettings();

  const collapsed = appSettings?.collapsed ?? false;
  const pinned = appSettings?.always_on_top ?? true;

  const toggleCollapse = useCallback(() => {
    const next = !collapsed;
    updateSettings({ collapsed: next });
  }, [collapsed, updateSettings]);

  const togglePin = useCallback(() => {
    const next = !pinned;
    getCurrentWindow().setAlwaysOnTop(next).catch(log.error);
    updateSettings({ always_on_top: next });
  }, [pinned, updateSettings]);

  const approveTop = useCallback(() => {
    const top = visible[0];
    if (top) resolve(top.id, "approve");
  }, [visible, resolve]);

  const denyTop = useCallback(() => {
    const top = visible[0];
    if (top) resolve(top.id, "deny");
  }, [visible, resolve]);

  const approveAll = useCallback(() => {
    visible.forEach((e, i) => {
      window.setTimeout(
        () => resolve(e.id, "approve"),
        i * APPROVE_ALL_STAGGER_MS,
      );
    });
  }, [visible, resolve]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (e.key === "Escape") {
        e.preventDefault();
        invoke("hide_popup").catch(log.error);
        return;
      }
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        if (e.shiftKey) {
          approveAll();
        } else {
          approveTop();
        }
        return;
      }
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        denyTop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approveTop, denyTop, approveAll]);

  const top = visible[0] ?? null;
  // The dropdown operates on the current top event if any, otherwise on the
  // last session we saw. That keeps the control usable while the queue is
  // empty between events of the same Claude run.
  const activeEvent = top ?? lastSeenEvent;

  const topResolved = useMemo(() => {
    if (!top) return null;
    if (top.resolved_kind && top.resolved_scope) {
      return { kind: top.resolved_kind, scope: top.resolved_scope };
    }
    // Fallback for events from before backend tagging landed (defensive).
    return { kind: "manual" as PolicyKind, scope: "global" as PolicyScope };
  }, [top]);

  const sessionOverride: PolicyKind | null = useMemo(() => {
    if (!activeEvent) return null;
    const rule = policies.per_session.find(
      (r) => r.session_id === activeEvent.session_id,
    );
    return rule ? rule.kind : null;
  }, [activeEvent, policies]);

  const onChangePolicy = useCallback(
    async (next: DropdownValue) => {
      if (!activeEvent) return;
      if (next === "inherit") {
        await removeSession(activeEvent.session_id).catch(log.error);
        return;
      }
      await setSession(activeEvent.session_id, next).catch(log.error);
      if (next === "auto") {
        // Cascade: approve consecutive same-session events from the top of
        // the current pending queue. If the queue is empty this is a no-op,
        // and the rule still applies to future events from this session.
        const sid = activeEvent.session_id;
        for (const e of pending) {
          if (e.session_id !== sid) break;
          resolve(e.id, "approve");
        }
      }
    },
    [activeEvent, pending, resolve, setSession, removeSession],
  );

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const height = Math.min(600, Math.max(80, Math.ceil(entry.borderBoxSize[0].blockSize)));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        getCurrentWindow().setSize(new LogicalSize(400, height)).catch(log.error);
      }, 50);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<{ event: HookEvent; scope: string }>(
      "hook_event_auto_resolved",
      (e) => {
        const ev = e.payload.event;
        pushHistory({
          id: ev.id,
          tool_name: ev.tool_name,
          summary: summarize(ev),
          action: "approve",
          timestamp: new Date().toISOString(),
          source: "auto",
        });
      },
    );
    return () => {
      unlisten.then((u) => u()).catch(() => {});
    };
  }, [pushHistory]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-[var(--bg-base)] overflow-hidden"
      style={{
        width: 400,
        borderRadius: 8,
        border: "0.5px solid var(--border)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.12)",
      }}
    >
      <Header
        pendingCount={visible.length}
        connected={connected}
        pinned={pinned}
        onTogglePin={togglePin}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
      {!collapsed && (
        <>
          {sharedCwd && <SessionStrip cwd={sharedCwd} />}

          <div className="flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <EmptyState connected={connected} />
            ) : (
              pending.map((event) => {
                const variant = detectVariant(event);
                if (variant === "question") {
                  return (
                    <QuestionCard
                      key={event.id}
                      event={event}
                      resolving={resolving.has(event.id)}
                      onSubmit={(answer) => resolve(event.id, "approve", answer)}
                      onSkip={() => resolve(event.id, "deny")}
                    />
                  );
                }
                return (
                  <ApprovalCard
                    key={event.id}
                    event={event}
                    resolving={resolving.has(event.id)}
                    onApprove={() => resolve(event.id, "approve")}
                    onDeny={() => resolve(event.id, "deny")}
                    onApproveSession={
                      variant === "permission"
                        ? () => resolve(event.id, "approve", undefined, "acceptEdits")
                        : undefined
                    }
                  />
                );
              })
            )}
          </div>

          {showUpdateHint && (
            <div
              className="flex items-center justify-between px-2"
              style={{
                height: 22,
                fontSize: 11,
                background: "var(--badge-permission-bg)",
                color: "var(--badge-permission-text)",
                borderTop: "0.5px solid var(--border)",
              }}
            >
              <span>Update WSL scripts to enable per-distribution rules.</span>
              <button
                type="button"
                onClick={() => setShowUpdateHint(false)}
                aria-label="Dismiss hint"
                style={{ fontSize: 11, marginLeft: 6 }}
              >
                ×
              </button>
            </div>
          )}
          <PolicyPanel
            topEvent={top}
            topResolved={topResolved}
            sessionOverride={sessionOverride}
            pendingCount={visible.length}
            onChangePolicy={onChangePolicy}
            onApproveAll={approveAll}
          />
          <HistoryList items={history} />
        </>
      )}
    </div>
  );
}
