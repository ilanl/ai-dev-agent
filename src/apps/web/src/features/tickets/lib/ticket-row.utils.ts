import type { TicketListItem } from "@/api/types";
import type { StatusTab } from "./ticket-status.constants";

export const filterTickets = (
  tickets: TicketListItem[],
  tab: StatusTab,
  search: string,
): TicketListItem[] => {
  const q = search.trim().toLowerCase();

  return tickets.filter((ticket) => {
    const matchesTab = tab === "all" || ticket.status === tab;
    const matchesSearch =
      !q ||
      ticket.issueKey.toLowerCase().includes(q) ||
      (ticket.summary?.toLowerCase().includes(q) ?? false) ||
      (ticket.branchName?.toLowerCase().includes(q) ?? false);

    return matchesTab && matchesSearch;
  });
};

export const tabCount = (
  tickets: TicketListItem[],
  tab: StatusTab,
): number => {
  if (tab === "all") return tickets.length;
  return tickets.filter((t) => t.status === tab).length;
};

export const issueInitials = (issueKey: string): string => {
  const parts = issueKey.split("-");
  const prefix = parts[0] ?? issueKey;
  return prefix.slice(0, 2).toUpperCase();
};

export const avatarTone = (issueKey: string): string => {
  const tones = [
    "bg-pink-200 text-pink-700",
    "bg-purple-200 text-purple-700",
    "bg-indigo-200 text-indigo-700",
    "bg-emerald-200 text-emerald-700",
    "bg-cyan-200 text-cyan-700",
    "bg-blue-200 text-blue-700",
    "bg-lime-200 text-lime-700",
    "bg-violet-200 text-violet-700",
    "bg-sky-200 text-sky-700",
    "bg-rose-200 text-rose-700",
    "bg-teal-200 text-teal-700",
  ];

  let hash = 0;
  for (let i = 0; i < issueKey.length; i += 1) {
    hash = issueKey.charCodeAt(i) + ((hash << 5) - hash);
  }

  return tones[Math.abs(hash) % tones.length] ?? tones[0]!;
};
