import type { z } from "zod";
import {
  respondTicketBodySchema,
  resumeTicketBodySchema,
  startTicketBodySchema,
  ticketDetailSchema,
  ticketListItemSchema,
  ticketRunResultSchema,
} from "./tickets.schemas.js";

export type TicketListItem = z.infer<typeof ticketListItemSchema>;
export type TicketDetail = z.infer<typeof ticketDetailSchema>;
export type TicketRunResult = z.infer<typeof ticketRunResultSchema>;
export type AgentStatus = TicketRunResult["status"];

export type StartTicketBody = z.infer<typeof startTicketBodySchema>;
export type ResumeTicketBody = z.infer<typeof resumeTicketBodySchema>;
export type RespondTicketBody = z.infer<typeof respondTicketBodySchema>;
