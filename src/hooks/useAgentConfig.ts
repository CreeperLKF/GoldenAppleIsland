import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AgentApproveConfig,
  AgentSessionSnapshot,
} from "../types/settings";

export function useAgentConfig() {
  const [config, setConfig] = useState<AgentApproveConfig | null>(null);
  const [session, setSession] = useState<AgentSessionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [cfg, snap] = await Promise.all([
        invoke<AgentApproveConfig>("get_agent_config"),
        invoke<AgentSessionSnapshot | null>("get_agent_session_snapshot"),
      ]);
      setConfig(cfg);
      setSession(snap);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsub = listen("approval_policies_changed", () => {
      void refresh();
    });
    return () => {
      void unsub.then((fn) => fn());
    };
  }, [refresh]);

  const createDefault = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await invoke<AgentApproveConfig>("use_default_agent_workspace");
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const resetDefault = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await invoke("reset_default_agent_workspace");
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const setWorkspacePath = useCallback(
    async (path: string | null) => {
      if (path === null) {
        await invoke("set_agent_config", { patch: { clear_workspace: true } });
      } else {
        await invoke("set_agent_config", { patch: { workspace_path: path } });
      }
      await refresh();
    },
    [refresh],
  );

  const setTurnLimit = useCallback(
    async (n: number) => {
      await invoke("set_agent_config", { patch: { turn_limit: n } });
      await refresh();
    },
    [refresh],
  );

  const setTimeout_ = useCallback(
    async (n: number) => {
      await invoke("set_agent_config", { patch: { call_timeout_secs: n } });
      await refresh();
    },
    [refresh],
  );

  const resetSession = useCallback(async () => {
    await invoke("reset_agent_session");
    await refresh();
  }, [refresh]);

  return {
    config,
    session,
    busy,
    error,
    createDefault,
    resetDefault,
    setWorkspacePath,
    setTurnLimit,
    setTimeout: setTimeout_,
    resetSession,
  };
}
