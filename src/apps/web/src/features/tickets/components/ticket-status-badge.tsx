import type { AgentStatus } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, statusBadgeClass } from "../lib/ticket-status.constants";

type TicketStatusBadgeProps = {
  status: AgentStatus;
};

export const TicketStatusBadge = ({ status }: TicketStatusBadgeProps) => (
  <Badge className={statusBadgeClass[status]}>{STATUS_LABEL[status]}</Badge>
);
