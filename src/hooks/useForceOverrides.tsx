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
  get: () => ForceKind;
  set: (kind: ForceKind) => void;
}

const ForceOverridesContext = createContext<ForceOverridesValue | null>(null);

export function ForceOverridesProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<ForceKind>(null);

  const get = useCallback((): ForceKind => value, [value]);

  const set = useCallback((kind: ForceKind) => {
    setValue((prev) => (prev === kind ? prev : kind));
  }, []);

  const ctxValue = useMemo<ForceOverridesValue>(
    () => ({ get, set }),
    [get, set],
  );

  return (
    <ForceOverridesContext.Provider value={ctxValue}>
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
