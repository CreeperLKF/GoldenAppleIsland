import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AuditIndex, EventRecord } from "../types/audit";

export function useAuditHistory(pollMs = 2000) {
  const [index, setIndex] = useState<AuditIndex | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const idx = await invoke<AuditIndex>("audit_list");
      setIndex(idx);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(t);
  }, [refresh, pollMs]);

  const readSession = useCallback(
    async (folderHash: string, sessionId: string): Promise<EventRecord[]> =>
      invoke("audit_read_session", { folderHash, sessionId }),
    [],
  );

  const pinFolder = useCallback(async (folderHash: string) => {
    await invoke("audit_pin_folder", { folderHash });
    await refresh();
  }, [refresh]);

  const unpinFolder = useCallback(async (folderHash: string) => {
    await invoke("audit_unpin_folder", { folderHash });
    await refresh();
  }, [refresh]);

  const pinSession = useCallback(async (folderHash: string, sessionId: string) => {
    await invoke("audit_pin_session", { folderHash, sessionId });
    await refresh();
  }, [refresh]);

  const unpinSession = useCallback(async (folderHash: string, sessionId: string) => {
    await invoke("audit_unpin_session", { folderHash, sessionId });
    await refresh();
  }, [refresh]);

  const deleteSession = useCallback(async (folderHash: string, sessionId: string) => {
    await invoke("audit_delete_session", { folderHash, sessionId });
    await refresh();
  }, [refresh]);

  const deleteFolder = useCallback(async (folderHash: string) => {
    await invoke("audit_delete_folder", { folderHash });
    await refresh();
  }, [refresh]);

  return {
    index,
    error,
    refresh,
    readSession,
    pinFolder,
    unpinFolder,
    pinSession,
    unpinSession,
    deleteSession,
    deleteFolder,
  };
}
