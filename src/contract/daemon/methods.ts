/** NDJSON daemon methods (`agentd` socket protocol). */
export const AGENT_METHOD = {
  AGENT_REGISTER: "agent.register",
  AGENT_LIST: "agent.list",
  SESSION_FOCUS: "session.focus",
  SESSION_CURRENT: "session.current",
  SESSION_SUBSCRIBE: "session.subscribe",
  TICKET_START: "ticket.start",
  TICKET_RESUME: "ticket.resume",
  TICKET_RESPOND: "ticket.respond",
  TICKET_STATUS: "ticket.status",
  TICKET_LIST: "ticket.list",
  TICKET_RESET: "ticket.reset",
} as const;

export type AgentMethod = (typeof AGENT_METHOD)[keyof typeof AGENT_METHOD];
