import { useCallback, useEffect, useState } from "react";
import { agentLogLineSchema, API_ROUTES, type AgentLogLine } from "@contract";
import { webEnv } from "@/config/web-env";

export const useLiveLogs = (enabled: boolean) => {
  const [lines, setLines] = useState<AgentLogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamKey, setStreamKey] = useState(0);

  const refresh = useCallback(() => {
    setLines([]);
    setStreamKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    const url = `${webEnv.apiBaseUrl}${API_ROUTES.logsStream}`;
    const source = new EventSource(url);

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.onmessage = (event) => {
      const parsed = agentLogLineSchema.safeParse(JSON.parse(event.data));
      if (!parsed.success) return;
      setConnected(true);
      setLines((prev) => [...prev.slice(-499), parsed.data]);
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, [enabled, streamKey]);

  return { lines, connected, refresh };
};
