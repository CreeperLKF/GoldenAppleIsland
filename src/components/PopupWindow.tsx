import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { currentMonitor, getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import log from "../lib/log";
import Header from "./Header";
import SessionStrip from "./SessionStrip";
import ApprovalCard from "./ApprovalCard";
import DelegatedCard from "./DelegatedCard";
import QuestionCard from "./QuestionCard";
import EmptyState from "./EmptyState";
import PolicyPanel from "./PolicyPanel";
import HistoryList from "./HistoryList";
import { usePendingEvents } from "../hooks/usePendingEvents";
import { useDelegatedEvents } from "../hooks/useDelegatedEvents";
import { useWebSocket } from "../hooks/useWebSocket";
import { useConnection } from "../hooks/useConnection";
import { useHistory } from "../hooks/useHistory";
import { useApprovalPolicies } from "../hooks/useApprovalPolicies";
import { useAppSettings } from "../hooks/useAppSettings";
import type { HookEvent, PolicyKind } from "../types/events";
import { detectVariant } from "../types/events";
import { useForceOverrides } from "../hooks/useForceOverrides";
import Icon from "./ui/Icon";

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

  const { delegated, takeOver } = useDelegatedEvents();

  const force = useForceOverrides();

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

      // Force override pre-filter: if this session is forced to auto,
      // approve the event immediately. Manual force is a no-op on the
      // frontend side because backend auto-resolution already happens
      // before the event reaches this popup via the separate
      // `hook_event_auto_resolved` channel.
      const forced = force.get();
      if (forced === "auto") {
        // Bypass the pending queue entirely: send the approve response to
        // the backend directly and record it in history as an auto-resolved
        // entry, matching the shape the `hook_event_auto_resolved` listener
        // uses for backend-side auto resolution. Going through enqueue/resolve
        // here would race with usePendingEvents' pendingRef effect and drop
        // the history entry.
        invoke("respond", {
          id: event.id,
          action: "approve",
          answer: null,
          sessionMode: null,
        }).catch(log.error);
        pushHistory({
          id: event.id,
          tool_name: event.tool_name,
          summary: summarize(event),
          action: "approve",
          timestamp: new Date().toISOString(),
          source: "auto",
        });
        return;
      }

      enqueue(event);
    },
    [enqueue, pushHistory, showUpdateHint, force],
  );

  useWebSocket(onEvent);

  const { setSession, removeSession } = useApprovalPolicies();

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
  const recentCollapsed = appSettings?.recent_collapsed ?? false;

  const toggleCollapse = useCallback(() => {
    const next = !collapsed;
    updateSettings({ collapsed: next });
  }, [collapsed, updateSettings]);

  const toggleRecentCollapse = useCallback(() => {
    updateSettings({ recent_collapsed: !recentCollapsed });
  }, [recentCollapsed, updateSettings]);

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

  const onCommitSessionPolicy = useCallback(
    async (kind: PolicyKind | null) => {
      if (!activeEvent) return;
      const sid = activeEvent.session_id;
      try {
        if (kind === null) {
          await removeSession(sid);
        } else {
          await setSession(sid, kind);
          if (kind === "auto") {
            // Cascade: auto-approve consecutive same-session events at
            // the head of the queue. Preserves the old dropdown's cascade
            // behavior, now on the split button.
            for (const e of pending) {
              if (e.session_id !== sid) break;
              resolve(e.id, "approve");
            }
          }
        }
      } catch (err) {
        log.error(`onCommitSessionPolicy failed: ${String(err)}`);
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
    const win = getCurrentWindow();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastX = 0;
    let lastY = 0;

    const unlisten = win.onMoved(({ payload }) => {
      lastX = payload.x;
      lastY = payload.y;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const monitor = await currentMonitor();
          const monitorName = monitor?.name ?? "";
          await invoke("update_popup_position", {
            x: lastX,
            y: lastY,
            monitorName,
          });
        } catch (err) {
          log.error(`update_popup_position failed: ${String(err)}`);
        }
      }, 300);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unlisten.then((u) => u()).catch(() => {});
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

  useEffect(() => {
    const unlisten = listen("hotkey_approve_all", () => {
      approveAll();
    });
    return () => {
      unlisten.then((u) => u()).catch(() => {});
    };
  }, [approveAll]);

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
            {delegated.length > 0 && (
              <div className="delegated-list">
                {delegated.map((d) => (
                  <DelegatedCard
                    key={d.event_id}
                    state={d}
                    onTakeOver={(id) => {
                      void takeOver(id);
                    }}
                  />
                ))}
              </div>
            )}
            {visible.length === 0 && delegated.length === 0 ? (
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
                background: "rgba(245, 158, 11, 0.10)",
                color: "var(--cat-permission)",
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
                <Icon name="x" size={10} />
              </button>
            </div>
          )}
          <PolicyPanel
            activeSessionId={activeEvent?.session_id ?? null}
            pendingCount={visible.length}
            onCommitSessionPolicy={onCommitSessionPolicy}
            onApproveAll={approveAll}
            recentVisible={history.length > 0}
            recentCollapsed={recentCollapsed}
            onToggleRecent={toggleRecentCollapse}
          />
          <HistoryList items={history} collapsed={recentCollapsed} />
        </>
      )}
    </div>
  );
}
