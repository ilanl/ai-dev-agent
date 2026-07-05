import { z } from "zod";

export const agentLogLineSchema = z.object({
  ts: z.string(),
  level: z.enum(["info", "debug"]),
  event: z.string(),
  message: z.string(),
});

export type AgentLogLine = z.infer<typeof agentLogLineSchema>;
