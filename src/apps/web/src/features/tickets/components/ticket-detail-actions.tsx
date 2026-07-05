import { useState } from "react";
import type { TicketDetail } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  useResetTicket,
  useResumeTicket,
  useStartTicket,
} from "../hooks/use-tickets";
import { getTicketDetailActions } from "@contract/agent/ticket-actions";

type TicketDetailActionsProps = {
  ticket: TicketDetail;
};

export const TicketDetailActions = ({ ticket }: TicketDetailActionsProps) => {
  const actions = getTicketDetailActions(ticket);
  const resume = useResumeTicket(ticket.issueKey);
  const start = useStartTicket();
  const reset = useResetTicket(ticket.issueKey);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!actions.length) return null;

  const isPending = pendingId !== null;

  const run = async (action: (typeof actions)[number]) => {
    setPendingId(action.id);
    try {
      if (action.kind === "start") {
        await start.mutateAsync(ticket.issueKey);
        return;
      }
      if (action.kind === "reset") {
        await reset.mutateAsync();
        return;
      }
      if (action.message) {
        await resume.mutateAsync(action.message);
      }
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="shrink-0 border-t border-border px-4 py-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant={action.variant ?? "default"}
            disabled={isPending}
            onClick={() => void run(action)}
          >
            {pendingId === action.id ? "Working…" : action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
