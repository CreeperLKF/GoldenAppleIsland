import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PolicyKind } from "../types/events";

export type ForceKind = PolicyKind | null;

interface ForceOverridesValue {
  get: (sessionId: string) => ForceKind;
  set: (sessionId: string, kind: ForceKind) => void;
}

const ForceOverridesContext = createContext<ForceOverridesValue | null>(null);

export function ForceOverridesProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Record<string, PolicyKind>>({});

  const get = useCallback(
    (sessionId: string): ForceKind => map[sessionId] ?? null,
    [map],
  );

  const set = useCallback((sessionId: string, kind: ForceKind) => {
    setMap((prev) => {
      if (kind === null) {
        if (!(sessionId in prev)) return prev;
        const next = { ...prev };
        delete next[sessionId];
        return next;
      }
      if (prev[sessionId] === kind) return prev;
      return { ...prev, [sessionId]: kind };
    });
  }, []);

  const value = useMemo<ForceOverridesValue>(() => ({ get, set }), [get, set]);

  return (
    <ForceOverridesContext.Provider value={value}>
      {children}
    </ForceOverridesContext.Provider>
  );
}

export function useForceOverrides(): ForceOverridesValue {
  const ctx = useContext(ForceOverridesContext);
  if (!ctx) {
    throw new Error(
      "useForceOverrides must be used inside <ForceOverridesProvider>",
    );
  }
  return ctx;
}
