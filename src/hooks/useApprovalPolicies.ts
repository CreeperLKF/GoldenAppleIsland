import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import log from "../lib/log";
import type {
  ApprovalPolicies,
  PolicyKind,
  RecentSession,
} from "../types/events";

const EMPTY: ApprovalPolicies = {
  global: "manual",
  per_distro: {},
  per_folder: {},
  per_session: [],
  agent_config: {
    workspace_path: null,
    is_default_workspace: false,
    turn_limit: 0,
    call_timeout_secs: 0,
  },
  external_config: {
    endpoint_url: null,
    auth_header: null,
    call_timeout_secs: 0,
  },
};

export function useApprovalPolicies() {
  const [policies, setPolicies] = useState<ApprovalPolicies>(EMPTY);
  const [recent, setRecent] = useState<RecentSession[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        invoke<ApprovalPolicies>("get_approval_policies"),
        invoke<RecentSession[]>("list_recent_sessions"),
      ]);
      setPolicies(p);
      setRecent(r);
    } catch (e) {
      log.error(`useApprovalPolicies refresh failed: ${String(e)}`);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unlisten = listen<ApprovalPolicies>(
      "approval_policies_changed",
      (event) => {
        setPolicies(event.payload);
        invoke<RecentSession[]>("list_recent_sessions")
          .then(setRecent)
          .catch((e) => log.error(`list_recent_sessions failed: ${String(e)}`));
      },
    );
    return () => {
      unlisten.then((u) => u()).catch(() => {});
    };
  }, [refresh]);

  const setGlobal = useCallback(
    (kind: PolicyKind) => invoke("set_global_policy", { kind }),
    [],
  );
  const setDistro = useCallback(
    (distro: string, kind: PolicyKind) =>
      invoke("set_distro_policy", { distro, kind }),
    [],
  );
  const removeDistro = useCallback(
    (distro: string) => invoke("remove_distro_policy", { distro }),
    [],
  );
  const setFolder = useCallback(
    (path: string, kind: PolicyKind, includeSubdirectories: boolean) =>
      invoke("set_folder_policy", {
        path,
        kind,
        includeSubdirectories,
      }),
    [],
  );
  const removeFolder = useCallback(
    (path: string) => invoke("remove_folder_policy", { path }),
    [],
  );
  const setSession = useCallback(
    (sessionId: string, kind: PolicyKind) =>
      invoke("set_session_policy", { sessionId, kind }),
    [],
  );
  const removeSession = useCallback(
    (sessionId: string) => invoke("remove_session_policy", { sessionId }),
    [],
  );
  const promoteSession = useCallback(
    (sessionId: string, includeSubdirectories: boolean) =>
      invoke("promote_session_to_folder", {
        sessionId,
        includeSubdirectories,
      }),
    [],
  );

  return {
    policies,
    recent,
    refresh,
    setGlobal,
    setDistro,
    removeDistro,
    setFolder,
    removeFolder,
    setSession,
    removeSession,
    promoteSession,
  };
}
