import { z } from "zod";
import { reviewGateSchema, reviewInterruptSchema } from "../agent/review.js";

export const agentStatusSchema = z.enum([
  "running",
  "blocked",
  "shipped",
  "failed",
  "rejected",
]);

export const jiraCommentSchema = z.object({
  id: z.string(),
  authorDisplayName: z.string().nullable(),
  created: z.string().nullable(),
  bodyPlain: z.string(),
});

const runMetaCliSchema = z.object({
  dryRun: z.boolean(),
  verbose: z.boolean(),
  fullSkills: z.boolean(),
  maxAttempts: z.number(),
  lint: z.string().optional(),
  test: z.string().optional(),
  e2e: z.string().optional(),
});

export const ticketListItemSchema = z
  .object({
    threadId: z.string(),
    issueKey: z.string(),
    agentId: z.string(),
    clientPath: z.string(),
    serverPath: z.string(),
    scope: z.enum(["client", "server"]).optional(),
    updatedAt: z.string(),
    cli: runMetaCliSchema,
    summary: z.string().optional(),
    status: agentStatusSchema.optional(),
    awaiting: reviewGateSchema.optional(),
    branchName: z.string().optional(),
    browseUrl: z.string().nullable().optional(),
  })
  .passthrough();

export const ticketDetailSchema = z.object({
  threadId: z.string(),
  issueKey: z.string(),
  agentId: z.string(),
  summary: z.string(),
  descriptionPlain: z.string(),
  updatedAt: z.string(),
  comments: z.array(jiraCommentSchema),
  browseUrl: z.string().nullable(),
  status: agentStatusSchema.optional(),
  scope: z.enum(["client", "server"]).optional(),
  branchName: z.string().optional(),
  activeRepoPath: z.string().optional(),
  suggestedBranch: z.string().optional(),
  awaiting: reviewGateSchema.optional(),
  interrupt: reviewInterruptSchema.optional(),
  error: z.string().optional(),
  planPath: z.string().optional(),
});

export const ticketRunResultSchema = z.object({
  threadId: z.string(),
  phase: z.enum(["awaiting_input", "completed", "failed"]),
  status: agentStatusSchema,
  interrupted: z.boolean(),
  error: z.string().optional(),
});

export const startTicketBodySchema = z.object({
  issueKey: z.string().min(1),
  agentId: z.string().optional(),
});

export const resumeTicketBodySchema = z.object({
  message: z.string().min(1),
  agentId: z.string().optional(),
});

export const respondTicketBodySchema = z.object({
  action: z.enum(["approve", "reject", "ship", "comment"]),
  text: z.string().optional(),
  agentId: z.string().optional(),
});
