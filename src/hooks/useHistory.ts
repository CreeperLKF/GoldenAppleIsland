import { useCallback, useState } from "react";

export interface HistoryEntry {
  id: string;
  tool_name: string;
  summary: string;
  action: "approve" | "deny" | "timeout";
  timestamp: string;
  answer?: string;
  source?: "manual" | "auto";
}

const MAX = 200;

export function useHistory() {
  const [items, setItems] = useState<HistoryEntry[]>([]);

  const push = useCallback((entry: HistoryEntry) => {
    setItems((prev) => {
      const next = [entry, ...prev];
      if (next.length > MAX) next.length = MAX;
      return next;
    });
  }, []);

  return { items, push };
}
