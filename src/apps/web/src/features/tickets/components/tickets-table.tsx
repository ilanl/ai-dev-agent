import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTicketsContext } from "../tickets-context";
import { TicketsEmptyState } from "./tickets-empty-state";
import { TicketTableRow } from "./ticket-table-row";

export const TicketsTable = () => {
  const { filteredTickets, isLoading } = useTicketsContext();

  return (
    <ScrollArea className="flex-1">
      {isLoading ? (
        <p className="p-8 text-sm text-muted-foreground">Loading tickets…</p>
      ) : filteredTickets.length === 0 ? (
        <TicketsEmptyState />
      ) : (
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="pl-5">Key</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.map((ticket) => (
              <TicketTableRow key={ticket.threadId} ticket={ticket} />
            ))}
          </TableBody>
        </Table>
      )}
    </ScrollArea>
  );
};
