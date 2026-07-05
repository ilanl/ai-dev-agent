import { useEffect, useRef, useState } from "react";
import type { TicketSummary } from "./types";

type WsMessage =
  | { type: "ticket.updated"; data: TicketSummary }
  | { type: "agent.changed"; data: { agentId: string } }
  | { type: "run.event"; data: unknown };

const DEV_WS_URL = "ws://127.0.0.1:9478/ws";
const MIN_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;

function wsUrl(): string {
  if (import.meta.env.DEV) return DEV_WS_URL;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

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
    let retryAttempt = 0;
    let hadDisconnect = false;

    const scheduleReconnect = () => {
      const delay = Math.min(MIN_RETRY_MS * 2 ** retryAttempt, MAX_RETRY_MS);
      retryAttempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      ws = new WebSocket(wsUrl());

      ws.onopen = () => {
        setConnected(true);
        retryAttempt = 0;
        if (hadDisconnect) {
          hadDisconnect = false;
          optionsRef.current.onReconnect?.();
        }
      };

      ws.onclose = () => {
        setConnected(false);
        hadDisconnect = true;
        if (!closed) scheduleReconnect();
      };

      ws.onerror = () => ws?.close();

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as WsMessage;
          if (msg.type === "ticket.updated") {
            optionsRef.current.onTicketUpdated(msg.data);
          } else if (msg.type === "agent.changed") {
            optionsRef.current.onAgentChanged(msg.data.agentId);
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
