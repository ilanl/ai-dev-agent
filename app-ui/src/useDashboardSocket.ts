import { useEffect, useRef, useState } from "react";
import type { TicketSummary } from "./types";

type WsMessage =
  | { type: "ticket.updated"; data: TicketSummary }
  | { type: "agent.changed"; data: { agentId: string } }
  | { type: "run.event"; data: unknown };

export function useDashboardSocket(options: {
  onTicketUpdated: (ticket: TicketSummary) => void;
  onAgentChanged: (agentId: string) => void;
  onReconnect?: () => void;
}) {
  const [connected, setConnected] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(url);

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retryTimer = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws?.close();

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as WsMessage;
          if (msg.type === "ticket.updated") {
            optionsRef.current.onTicketUpdated(msg.data);
          } else if (msg.type === "agent.changed") {
            optionsRef.current.onAgentChanged(msg.data.agentId);
          } else if (msg.type === "run.event") {
            optionsRef.current.onReconnect?.();
          }
        } catch {
          // ignore malformed
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  return { connected };
}
