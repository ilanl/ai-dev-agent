/** CLI commands (`pnpm run agent -- …`). */
export type AgentCommand = "start" | "resume" | "status" | "list" | "reset";

export const AGENT_COMMANDS = [
  "start",
  "resume",
  "status",
  "list",
  "reset",
] as const satisfies readonly AgentCommand[];
