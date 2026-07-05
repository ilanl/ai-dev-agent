/** HTTP API route paths (web app ↔ `http-api`). */
export const API_ROUTES = {
  tickets: "/api/tickets",
  ticket: (issueKey: string) => `/api/tickets/${encodeURIComponent(issueKey)}`,
  ticketRespond: (issueKey: string) =>
    `/api/tickets/${encodeURIComponent(issueKey)}/respond`,
  ticketResume: (issueKey: string) =>
    `/api/tickets/${encodeURIComponent(issueKey)}/resume`,
  ticketReset: (issueKey: string) =>
    `/api/tickets/${encodeURIComponent(issueKey)}/reset`,
} as const;
