import { useCallback, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuditHistory } from "../hooks/useAuditHistory";
import { useAppSettings } from "../hooks/useAppSettings";
import SectionCard from "./ui/SectionCard";
import Icon from "./ui/Icon";
import type { EventRecord, FolderMeta, SessionMeta } from "../types/audit";

interface Selection {
  folderHash: string;
  sessionId: string;
}

function summarizeInput(r: EventRecord): string {
  const i = r.tool_input ?? {};
  for (const k of ["command", "file_path", "path", "pattern", "prompt", "question"]) {
    const v = (i as Record<string, unknown>)[k];
    if (typeof v === "string" && v.length > 0) return v.slice(0, 120);
  }
  return r.tool_name;
}

function isActive(last: string): boolean {
  const t = Date.parse(last);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 5 * 60 * 1000;
}

export default function AuditHistoryTab() {
  const { settings, update } = useAppSettings();
  const history = useAuditHistory();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [detail, setDetail] = useState<EventRecord[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadSession = useCallback(
    async (folderHash: string, sessionId: string) => {
      setSelection({ folderHash, sessionId });
      const records = await history.readSession(folderHash, sessionId);
      setDetail(records);
    },
    [history],
  );

  const confirmDelete = useCallback(
    async (
      kind: "folder" | "session",
      folderHash: string,
      sessionId?: string,
    ) => {
      const meta = history.index?.folders?.[folderHash];
      if (!meta) return;
      const pinned =
        kind === "session" && sessionId
          ? !!meta.sessions[sessionId]?.pinned
          : meta.pinned;
      const skip =
        settings?.audit_skip_unpinned_delete_confirm && !pinned && kind === "session";
      if (!skip) {
        const label =
          kind === "folder"
            ? `Delete folder "${meta.display_name}" (${Object.keys(meta.sessions).length} sessions)?`
            : `Delete session ${sessionId} (${meta.sessions[sessionId!]?.event_count ?? 0} events)?`;
        if (!window.confirm(label)) return;
      }
      if (kind === "folder") {
        await history.deleteFolder(folderHash);
      } else {
        await history.deleteSession(folderHash, sessionId!);
      }
      if (
        selection?.folderHash === folderHash &&
        (kind === "folder" || selection.sessionId === sessionId)
      ) {
        setSelection(null);
        setDetail([]);
      }
    },
    [history, settings, selection],
  );

  const setRecording = async (value: boolean) => {
    await invoke("set_audit_enabled", { enabled: value });
    await update({});
  };

  const setCap = async (value: number) => {
    await invoke("set_max_dynamic_sessions", { cap: value });
    await update({});
  };

  const folders = useMemo(() => {
    const idx = history.index;
    if (!idx) return [] as [string, FolderMeta][];
    return Object.entries(idx.folders).sort(([, a], [, b]) =>
      a.display_name.localeCompare(b.display_name),
    );
  }, [history.index]);

  return (
    <div className="flex flex-col" style={{ gap: 0 }}>
      <div style={{ padding: 12 }}>
        <SectionCard title="Recording">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontSize: "var(--fs-body)", display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={!!settings?.audit_history_enabled}
                onChange={(e) => setRecording(e.target.checked)}
              />
              Enabled
            </label>
            <label style={{ fontSize: "var(--fs-body)", display: "flex", alignItems: "center", gap: 6 }}>
              Max dynamic sessions:
              <input
                type="number"
                min={1}
                max={1000}
                value={settings?.max_dynamic_sessions ?? 50}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(n) && n > 0) void setCap(n);
                }}
                style={{
                  width: 60,
                  fontSize: "var(--fs-small)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "0.5px solid var(--border)",
                  borderRadius: 4,
                  padding: "2px 4px",
                }}
              />
              <span style={{ fontSize: "var(--fs-small)", color: "var(--text-tertiary)" }}>
                (pinned don't count)
              </span>
            </label>
          </div>
        </SectionCard>
      </div>
      <div style={{ borderTop: "0.5px solid var(--border)" }} />

      {!settings?.audit_history_enabled && folders.length === 0 && (
        <div style={{ padding: 16, fontSize: 12, color: "var(--text-tertiary)" }}>
          Recording disabled — enable above to start capturing audit history.
        </div>
      )}
      {settings?.audit_history_enabled && folders.length === 0 && (
        <div style={{ padding: 16, fontSize: 12, color: "var(--text-tertiary)" }}>
          No events recorded yet.
        </div>
      )}

      {folders.length > 0 && (
        <div style={{ display: "flex", minHeight: 400 }}>
          <div style={{ flex: "0 0 240px", borderRight: "0.5px solid var(--border)", overflowY: "auto" }}>
            {folders.map(([fh, folder]) => (
              <FolderRow
                key={fh}
                hash={fh}
                folder={folder}
                selectedSession={selection?.folderHash === fh ? selection.sessionId : null}
                onSelectSession={(sid) => loadSession(fh, sid)}
                onPinFolder={() => history.pinFolder(fh)}
                onUnpinFolder={() => history.unpinFolder(fh)}
                onPinSession={(sid) => history.pinSession(fh, sid)}
                onUnpinSession={(sid) => history.unpinSession(fh, sid)}
                onDeleteFolder={() => confirmDelete("folder", fh)}
                onDeleteSession={(sid) => confirmDelete("session", fh, sid)}
              />
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {!selection && (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                Select a session to view its events.
              </div>
            )}
            {selection && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                  {selection.sessionId}
                </div>
                {detail.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: "6px 8px",
                      borderBottom: "0.5px solid var(--border)",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                    onClick={() => setExpanded((m) => ({ ...m, [r.id]: !m[r.id] }))}
                  >
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ color: "var(--text-tertiary)" }}>
                        {r.ts.slice(11, 19)}
                      </span>
                      <span style={{ fontWeight: 600 }}>{r.hook_type}</span>
                      <span>{r.tool_name}</span>
                      <span
                        style={{
                          marginLeft: "auto",
                          color:
                            r.decision === "approve"
                              ? "var(--approve-text)"
                              : r.decision === "deny"
                                ? "var(--deny-text)"
                                : "var(--text-secondary)",
                        }}
                      >
                        → {r.decision} ({r.decision_source})
                      </span>
                    </div>
                    <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>
                      {summarizeInput(r)}
                    </div>
                    {expanded[r.id] && (
                      <pre
                        style={{
                          fontSize: "var(--fs-mono-xs)",
                          fontFamily: "var(--font-mono)",
                          marginTop: 4,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {JSON.stringify(r.tool_input, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FolderRow({
  hash,
  folder,
  selectedSession,
  onSelectSession,
  onPinFolder,
  onUnpinFolder,
  onPinSession,
  onUnpinSession,
  onDeleteFolder,
  onDeleteSession,
}: {
  hash: string;
  folder: FolderMeta;
  selectedSession: string | null;
  onSelectSession: (sid: string) => void;
  onPinFolder: () => void;
  onUnpinFolder: () => void;
  onPinSession: (sid: string) => void;
  onUnpinSession: (sid: string) => void;
  onDeleteFolder: () => void;
  onDeleteSession: (sid: string) => void;
}) {
  void hash;
  const [expanded, setExpanded] = useState(true);
  const sessions = Object.entries(folder.sessions).sort(([, a], [, b]) =>
    b.last_activity.localeCompare(a.last_activity),
  );
  return (
    <div style={{ padding: "4px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          fontSize: 12,
          cursor: "pointer",
        }}
        onClick={() => setExpanded((v) => !v)}
        title={folder.cwd}
      >
        {expanded
          ? <Icon name="chevron-down" size={10} style={{ flexShrink: 0 }} />
          : <Icon name="chevron-right" size={10} style={{ flexShrink: 0 }} />}
        {folder.pinned && <Icon name="pin" size={10} style={{ flexShrink: 0, color: "var(--gold)" }} />}
        <span style={{ fontWeight: 500 }}>{folder.display_name}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-tertiary)" }}>
          {sessions.length}
        </span>
      </div>
      {expanded && (
        <div>
          {sessions.map(([sid, s]) => (
            <SessionRow
              key={sid}
              id={sid}
              meta={s}
              selected={selectedSession === sid}
              onClick={() => onSelectSession(sid)}
              onPin={() => (s.pinned ? onUnpinSession(sid) : onPinSession(sid))}
              onDelete={() => onDeleteSession(sid)}
            />
          ))}
        </div>
      )}
      {expanded && (
        <div style={{ display: "flex", gap: 6, padding: "2px 24px" }}>
          <button
            type="button"
            onClick={folder.pinned ? onUnpinFolder : onPinFolder}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            style={{ fontSize: 10 }}
          >
            {folder.pinned ? "Unpin folder" : "Pin folder"}
          </button>
          <button
            type="button"
            onClick={onDeleteFolder}
            className="text-[var(--deny-text)] hover:brightness-110"
            style={{ fontSize: 10 }}
          >
            Delete folder
          </button>
        </div>
      )}
    </div>
  );
}

function SessionRow({
  id,
  meta,
  selected,
  onClick,
  onPin,
  onDelete,
}: {
  id: string;
  meta: SessionMeta;
  selected: boolean;
  onClick: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const active = isActive(meta.last_activity);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 24px",
        fontSize: 11,
        background: selected ? "var(--bg-elevated)" : "transparent",
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? "var(--approve-text)" : "var(--text-tertiary)",
        }}
      />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-mono-xs)" }}>{id.slice(0, 10)}</span>
      <span style={{ color: "var(--text-tertiary)" }}>{meta.event_count} evts</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center" }}>
        {meta.pinned
          ? <Icon name="pin" size={10} style={{ color: "var(--gold)" }} />
          : meta.fixed
            ? <span style={{ color: "var(--text-tertiary)" }}>·</span>
            : null}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPin();
        }}
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        style={{ fontSize: 10 }}
      >
        {meta.pinned ? "Unpin" : "Pin"}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="text-[var(--deny-text)]"
        style={{ fontSize: 10 }}
      >
        Del
      </button>
    </div>
  );
}
