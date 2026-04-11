import { useCallback, useState } from "react";

export function useAutoApprove() {
  const [enabled, setEnabled] = useState(false);
  const toggle = useCallback(() => setEnabled((v) => !v), []);
  return { enabled, toggle };
}
