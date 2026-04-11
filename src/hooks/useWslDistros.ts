import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BulkResult, WslDistroWithStatus } from "../types/settings";

interface State {
  loading: boolean;
  distros: WslDistroWithStatus[];
  error: string | null;
}

export function useWslDistros() {
  const [state, setState] = useState<State>({
    loading: true,
    distros: [],
    error: null,
  });
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const distros = await invoke<WslDistroWithStatus[]>("list_wsl_distros");
      setState({ loading: false, distros, error: null });
    } catch (e) {
      setState({
        loading: false,
        distros: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setEnabled = useCallback(
    async (distro: string, enabled: boolean) => {
      setBusy((prev) => {
        const next = new Set(prev);
        next.add(distro);
        return next;
      });
      try {
        await invoke("set_hook_enabled", { distro, enabled });
        await refresh();
      } catch (e) {
        setState((s) => ({
          ...s,
          error: `${distro}: ${e instanceof Error ? e.message : String(e)}`,
        }));
      } finally {
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(distro);
          return next;
        });
      }
    },
    [refresh],
  );

  const setAll = useCallback(
    async (enabled: boolean): Promise<BulkResult[]> => {
      try {
        const results = await invoke<BulkResult[]>("set_hook_enabled_all", {
          enabled,
        });
        await refresh();
        return results;
      } catch (e) {
        setState((s) => ({
          ...s,
          error: e instanceof Error ? e.message : String(e),
        }));
        return [];
      }
    },
    [refresh],
  );

  return { ...state, busy, refresh, setEnabled, setAll };
}
