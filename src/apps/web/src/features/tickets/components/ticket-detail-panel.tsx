import type { TicketDetail } from "@/api/types";
import { useTicketsContext } from "../tickets-context";
import { TicketDetailActions } from "./ticket-detail-actions";
import { TicketDetailHeader } from "./ticket-detail-header";
import { TicketDetailMeta } from "./ticket-detail-meta";
import { TicketDetailThread } from "./ticket-detail-thread";

type TicketDetailPanelProps = {
  ticket: TicketDetail;
  width: number;
};

export const TicketDetailPanel = ({ ticket, width }: TicketDetailPanelProps) => {
  const { closeDetail } = useTicketsContext();

  return (
    <aside
      style={{ width }}
      className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-l border-border bg-card lg:w-auto"
    >
      <TicketDetailHeader ticket={ticket} onClose={closeDetail} />
      <TicketDetailMeta ticket={ticket} />
      <TicketDetailThread ticket={ticket} />
      <TicketDetailActions ticket={ticket} />
    </aside>
  );
};
