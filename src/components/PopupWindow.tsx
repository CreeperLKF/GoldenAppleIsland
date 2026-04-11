import { useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import Header from "./Header";
import SessionStrip from "./SessionStrip";
import ApprovalCard from "./ApprovalCard";
import EmptyState from "./EmptyState";
import QuickActions from "./QuickActions";
import HistoryList from "./HistoryList";
import { usePendingEvents } from "../hooks/usePendingEvents";
import { useWebSocket } from "../hooks/useWebSocket";

export default function PopupWindow() {
  const { pending, resolving, enqueue, resolve } = usePendingEvents();

  useWebSocket(enqueue);

  const visible = useMemo(
    () => pending.filter((e) => !resolving.has(e.id)),
    [pending, resolving],
  );

  const sharedCwd = useMemo(() => {
    if (visible.length === 0) return null;
    const first = visible[0].session_cwd;
    return visible.every((e) => e.session_cwd === first) ? first : null;
  }, [visible]);

  const connected = pending.length > 0;

  const approveTop = useCallback(() => {
    const top = visible[0];
    if (top) resolve(top.id, "approve");
  }, [visible, resolve]);

  const denyTop = useCallback(() => {
    const top = visible[0];
    if (top) resolve(top.id, "deny");
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
        if (e.shiftKey) return;
        e.preventDefault();
        approveTop();
        return;
      }
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        denyTop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approveTop, denyTop]);

  return (
    <div
      className="flex flex-col bg-[var(--bg-base)] overflow-hidden"
      style={{
        width: 400,
        maxHeight: 600,
        borderRadius: 8,
        border: "0.5px solid var(--border)",
      }}
    >
      <Header pendingCount={visible.length} connected={connected} />
      {sharedCwd && <SessionStrip cwd={sharedCwd} />}

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

      <QuickActions />
      <HistoryList />
    </div>
  );
}
