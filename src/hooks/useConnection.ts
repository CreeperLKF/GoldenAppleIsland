import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

interface ConnectionChangedPayload {
  count: number;
}

export function useConnection() {
  const [clientCount, setClientCount] = useState(0);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        unlisten = await listen<ConnectionChangedPayload>(
          "connection_changed",
          (msg) => {
            setClientCount(msg.payload.count);
          },
        );
        if (cancelled) unlisten?.();
      } catch {
        /* Tauri API unavailable */
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return { clientCount };
}
