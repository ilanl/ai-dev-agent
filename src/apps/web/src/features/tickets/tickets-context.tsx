import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { StatusTab } from "./lib/ticket-status.constants";
import { filterTickets } from "./lib/ticket-row.utils";
import { promptIssueKey } from "./lib/ticket.utils";
import { readTicketFromUrl, writeTicketToUrl } from "./lib/ticket-url.utils";
import {
  useStartTicket,
  useTicketDetail,
  useTickets,
} from "./hooks/use-tickets";
import type { TicketsContextValue } from "./tickets.types";

export const TicketsContext = createContext<TicketsContextValue | null>(null);

type TicketsProviderProps = {
  children: ReactNode;
};

export const TicketsProvider = ({ children }: TicketsProviderProps) => {
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(
    readTicketFromUrl,
  );
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<StatusTab>("all");

  useEffect(() => {
    const onPopState = () => setSelectedIssueKey(readTicketFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const ticketsQuery = useTickets();
  const detailQuery = useTicketDetail(selectedIssueKey);
  const startTicket = useStartTicket();

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const filteredTickets = useMemo(
    () => filterTickets(tickets, activeTab, search),
    [tickets, activeTab, search],
  );
  const isFilteredEmpty = tickets.length > 0 && filteredTickets.length === 0;

  const selectTicket = useCallback((issueKey: string | null) => {
    const normalized = issueKey?.trim().toUpperCase() ?? null;
    setSelectedIssueKey(normalized);
    writeTicketToUrl(normalized, normalized ? "push" : "replace");
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedIssueKey(null);
    writeTicketToUrl(null);
  }, []);

  const startNewTicket = useCallback(() => {
    const issueKey = promptIssueKey();
    if (!issueKey) return;

    const normalized = issueKey.trim().toUpperCase();
    startTicket.mutate(normalized, {
      onSuccess: () => {
        setSelectedIssueKey(normalized);
        writeTicketToUrl(normalized, "push");
      },
    });
  }, [startTicket]);

  const value: TicketsContextValue = {
    tickets,
    filteredTickets,
    isLoading: ticketsQuery.isLoading,
    isFilteredEmpty,
    selectedIssueKey,
    search,
    activeTab,
    detail: detailQuery.data,
    isDetailLoading: !!selectedIssueKey && detailQuery.isLoading,
    isStarting: startTicket.isPending,
    setSearch,
    setActiveTab,
    selectTicket,
    startNewTicket,
    closeDetail,
  };

  return (
    <TicketsContext.Provider value={value}>{children}</TicketsContext.Provider>
  );
};

export const useTicketsContext = (): TicketsContextValue => {
  const value = useContext(TicketsContext);
  if (!value) {
    throw new Error("useTicketsContext must be used within TicketsProvider");
  }
  return value;
};
