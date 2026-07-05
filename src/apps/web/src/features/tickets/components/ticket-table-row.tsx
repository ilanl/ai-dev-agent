import type { TicketListItem } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useTicketsContext } from "../tickets-context";
import { TicketAvatar } from "./ticket-avatar";
import { TicketStatusBadge } from "./ticket-status-badge";

type TicketTableRowProps = {
  ticket: TicketListItem;
};

export const TicketTableRow = ({ ticket }: TicketTableRowProps) => {
  const { selectedIssueKey, selectTicket } = useTicketsContext();
  const isSelected = selectedIssueKey === ticket.issueKey;

  return (
    <TableRow
      data-state={isSelected ? "selected" : undefined}
      className={cn("cursor-pointer", isSelected && "bg-accent/60")}
      onClick={() => selectTicket(isSelected ? null : ticket.issueKey)}
    >
      <TableCell className="pl-5 font-mono text-xs text-muted-foreground">
        {ticket.issueKey}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <TicketAvatar issueKey={ticket.issueKey} />
          <div>
            <div className="font-medium leading-tight">
              {ticket.summary ?? ticket.issueKey}
            </div>
            <div className="text-xs text-muted-foreground">
              {ticket.branchName ?? "No branch yet"}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {ticket.scope ? (
          <Badge variant="outline" className="capitalize">
            {ticket.scope}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-xs truncate">{ticket.summary ?? "—"}</TableCell>
      <TableCell>
        {ticket.status ? (
          <TicketStatusBadge status={ticket.status} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
};
