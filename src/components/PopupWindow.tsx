import { useCallback, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import Header from "./Header";
import SessionStrip from "./SessionStrip";
import ApprovalCard from "./ApprovalCard";
import EmptyState from "./EmptyState";
import QuickActions from "./QuickActions";
import HistoryList from "./HistoryList";
import { usePendingEvents } from "../hooks/usePendingEvents";
import { useWebSocket } from "../hooks/useWebSocket";
import { useConnection } from "../hooks/useConnection";
import { useHistory } from "../hooks/useHistory";
import { useAutoApprove } from "../hooks/useAutoApprove";
import type { HookEvent } from "../types/events";

const APPROVE_ALL_STAGGER_MS = 50;

function summarize(event: HookEvent): string {
  const input = event.tool_input as Record<string, unknown>;
  if (typeof input.command === "string") return input.command;
  if (typeof input.file_path === "string") return input.file_path;
  if (typeof input.path === "string") return input.path;
  if (typeof input.pattern === "string") return input.pattern;
  return event.tool_name;
}

export default function PopupWindow() {
  const { items: history, push: pushHistory } = useHistory();
  const { enabled: autoApprove, toggle: toggleAutoApprove } = useAutoApprove();
  const { clientCount } = useConnection();

  const onResolve = useCallback(
    (event: HookEvent, action: "approve" | "deny") => {
      pushHistory({
        id: event.id,
        tool_name: event.tool_name,
        summary: summarize(event),
        action,
        timestamp: new Date().toISOString(),
      });
    },
    [pushHistory],
  );

  const { pending, resolving, enqueue, resolve } = usePendingEvents({
    onResolve,
  });

  const autoApproveRef = useRef(autoApprove);
  useEffect(() => {
    autoApproveRef.current = autoApprove;
  }, [autoApprove]);

  const enqueueWithAuto = useCallback(
    (event: HookEvent) => {
      if (autoApproveRef.current) {
        window.setTimeout(() => resolve(event.id, "approve"), 0);
        pushHistory({
          id: event.id,
          tool_name: event.tool_name,
          summary: summarize(event),
          action: "approve",
          timestamp: new Date().toISOString(),
        });
        return;
      }
      enqueue(event);
    },
    [enqueue, resolve, pushHistory],
  );

  useWebSocket(enqueueWithAuto);

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
        invoke("hide_popup").catch(() => {});
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

  const showQuickActions = connected || visible.length > 0;

  return (
    <div
      className="flex flex-col bg-[var(--bg-base)] overflow-hidden"
      style={{
        width: 400,
        maxHeight: 600,
        borderRadius: 8,
        border: "0.5px solid var(--border)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.12)",
      }}
    >
      <Header pendingCount={visible.length} connected={connected} />
      {sharedCwd && <SessionStrip cwd={sharedCwd} autoApprove={autoApprove} />}

      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <EmptyState connected={connected} />
        ) : (
          pending.map((event) => (
            <ApprovalCard
              key={event.id}
              event={event}
              resolving={resolving.has(event.id)}
              onApprove={() => resolve(event.id, "approve")}
              onDeny={() => resolve(event.id, "deny")}
            />
          ))
        )}
      </div>

      {showQuickActions && (
        <QuickActions
          pendingCount={visible.length}
          autoApprove={autoApprove}
          onToggleAutoApprove={toggleAutoApprove}
          onApproveAll={approveAll}
        />
      )}
      <HistoryList items={history} />
    </div>
  );
}
