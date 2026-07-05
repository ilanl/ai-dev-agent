import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTicket,
  listTickets,
  resetTicket,
  resumeTicket,
  startTicket,
} from "@/api/operations";

export const ticketKeys = {
  all: ["tickets"] as const,
  detail: (issueKey: string) => ["tickets", issueKey] as const,
};

export const useTickets = () =>
  useQuery({
    queryKey: ticketKeys.all,
    queryFn: listTickets,
    refetchInterval: 5000,
  });

export const useTicketDetail = (issueKey: string | null) =>
  useQuery({
    queryKey: issueKey ? ticketKeys.detail(issueKey) : ["tickets", "none"],
    queryFn: () => getTicket(issueKey!),
    enabled: !!issueKey,
    refetchInterval: issueKey ? 5000 : false,
  });

export const useStartTicket = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: startTicket,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ticketKeys.all });
    },
  });
};

export const useResumeTicket = (issueKey: string) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (message: string) => resumeTicket(issueKey, message),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ticketKeys.all });
      void qc.invalidateQueries({ queryKey: ticketKeys.detail(issueKey) });
    },
  });
};

export const useResetTicket = (issueKey: string) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => resetTicket(issueKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ticketKeys.all });
      void qc.invalidateQueries({ queryKey: ticketKeys.detail(issueKey) });
    },
  });
};
