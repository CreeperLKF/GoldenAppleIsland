import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ExternalApproveConfig } from "../types/settings";

export interface ExternalTestResult {
  ok: boolean;
  verdict?: "approve" | "reject" | "escalate";
  reason?: string;
  error?: string;
  elapsedMs: number;
}

interface VerdictWire {
  verdict: "approve" | "reject" | "escalate";
  reason: string;
}

export function useExternalConfig() {
  const [config, setConfig] = useState<ExternalApproveConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTest, setLastTest] = useState<ExternalTestResult | null>(null);

  const refresh = useCallback(async () => {
    try {
      const cfg = await invoke<ExternalApproveConfig>("get_external_config");
      setConfig(cfg);
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

  const setEndpointUrl = useCallback(
    async (url: string | null) => {
      if (url === null) {
        await invoke("set_external_config", { patch: { clear_endpoint: true } });
      } else {
        await invoke("set_external_config", { patch: { endpoint_url: url } });
      }
      await refresh();
    },
    [refresh],
  );

  const setAuthHeader = useCallback(
    async (header: string) => {
      await invoke("set_external_config", { patch: { auth_header: header } });
      await refresh();
    },
    [refresh],
  );

  const setTimeout_ = useCallback(
    async (n: number) => {
      await invoke("set_external_config", { patch: { call_timeout_secs: n } });
      await refresh();
    },
    [refresh],
  );

  const test = useCallback(async (): Promise<ExternalTestResult> => {
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const verdict = await invoke<VerdictWire>("test_external_endpoint");
      const result: ExternalTestResult = {
        ok: true,
        verdict: verdict.verdict,
        reason: verdict.reason,
        elapsedMs: performance.now() - started,
      };
      setLastTest(result);
      return result;
    } catch (e) {
      const result: ExternalTestResult = {
        ok: false,
        error: String(e),
        elapsedMs: performance.now() - started,
      };
      setLastTest(result);
      setError(String(e));
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    config,
    busy,
    error,
    lastTest,
    setEndpointUrl,
    setAuthHeader,
    setTimeout: setTimeout_,
    test,
  };
}
