import { z } from "zod";

export const reviewGateSchema = z.enum(["plan", "ship", "question"]);

export type ReviewGate = z.infer<typeof reviewGateSchema>;

export const reviewInterruptSchema = z.object({
  gate: reviewGateSchema,
  title: z.string(),
  body: z.string(),
  plan: z.string().optional(),
  planPath: z.string().optional(),
  openRisks: z.array(z.string()).optional(),
  threadId: z.string().optional(),
  hints: z.array(z.string()).optional(),
});

export type ReviewInterruptPayload = z.infer<typeof reviewInterruptSchema>;
