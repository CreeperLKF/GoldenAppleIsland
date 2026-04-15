import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BulkResult, HookStatus, WslDistroWithStatus } from "../types/settings";
import type { HookTargetConfig } from "../types/modes";

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
      const distros = await invoke<WslDistroWithStatus[]>("list_wsl_distros_smart");
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

  const checkDistro = useCallback(
    async (distro: string) => {
      setBusy((prev) => new Set(prev).add(distro));
      try {
        const status = await invoke<HookStatus>("check_wsl_distro_status", { distro });
        setState((s) => ({
          ...s,
          distros: s.distros.map((d) =>
            d.name === distro ? { ...d, status } : d,
          ),
        }));
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
    [],
  );

  const setEnabled = useCallback(
    async (distro: string, enabled: boolean) => {
      setBusy((prev) => new Set(prev).add(distro));
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
        const results = await invoke<BulkResult[]>("set_hook_enabled_all", { enabled });
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

  const [updating, setUpdating] = useState(false);

  const updateScripts = useCallback(async (): Promise<BulkResult[]> => {
    setUpdating(true);
    try {
      const results = await invoke<BulkResult[]>("update_wsl_scripts");
      await refresh();
      return results;
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : String(e),
      }));
      return [];
    } finally {
      setUpdating(false);
    }
  }, [refresh]);

  const setConfig = useCallback(
    async (distro: string, config: HookTargetConfig) => {
      await invoke("set_wsl_hook_config", { distro, config });
      await refresh();
    },
    [refresh],
  );

  return { ...state, busy, updating, refresh, checkDistro, setEnabled, setAll, updateScripts, setConfig };
}
