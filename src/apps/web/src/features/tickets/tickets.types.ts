import type { TicketDetail, TicketListItem } from "@/api/types";
import type { StatusTab } from "./lib/ticket-status.constants";

export type TicketsContextValue = {
  tickets: TicketListItem[];
  filteredTickets: TicketListItem[];
  isLoading: boolean;
  isFilteredEmpty: boolean;
  selectedIssueKey: string | null;
  search: string;
  activeTab: StatusTab;
  detail: TicketDetail | undefined;
  isDetailLoading: boolean;
  isStarting: boolean;
  setSearch: (value: string) => void;
  setActiveTab: (tab: StatusTab) => void;
  selectTicket: (issueKey: string | null) => void;
  startNewTicket: () => void;
  closeDetail: () => void;
};
