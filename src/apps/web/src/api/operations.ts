import axios from "axios";
import { webEnv } from "@/config/web-env";
import {
  ticketDetailSchema,
  ticketListItemSchema,
  ticketRunResultSchema,
} from "@contract/http/tickets.schemas";
import type { TicketDetail, TicketListItem, TicketRunResult } from "./types";
import { API_ROUTES } from "./routes";

export const api = axios.create({
  baseURL: webEnv.apiBaseUrl,
  headers: { "Content-Type": "application/json" },
});

export const listTickets = async (): Promise<TicketListItem[]> => {
  const { data } = await api.get(API_ROUTES.tickets);
  return ticketListItemSchema.array().parse(data);
};

export const getTicket = async (issueKey: string): Promise<TicketDetail> => {
  const { data } = await api.get(API_ROUTES.ticket(issueKey));
  return ticketDetailSchema.parse(data);
};

export const startTicket = async (
  issueKey: string,
): Promise<TicketRunResult> => {
  const { data } = await api.post(API_ROUTES.tickets, { issueKey });
  return ticketRunResultSchema.parse(data);
};

export const resumeTicket = async (
  issueKey: string,
  message: string,
): Promise<TicketRunResult> => {
  const { data } = await api.post(API_ROUTES.ticketResume(issueKey), {
    message,
  });
  return ticketRunResultSchema.parse(data);
};

export const resetTicket = async (issueKey: string): Promise<void> => {
  await api.post(API_ROUTES.ticketReset(issueKey));
};
