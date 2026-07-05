import type { TicketDetail } from "@/api/types";
import { ChevronLeft, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { TicketAvatar } from "./ticket-avatar";

type TicketDetailHeaderProps = {
  ticket: TicketDetail;
  onClose: () => void;
};

export const TicketDetailHeader = ({ ticket, onClose }: TicketDetailHeaderProps) => (
  <div className="flex items-center gap-3 shrink-0 border-b border-border px-4 py-3">
    <Button
      variant="ghost"
      size="icon-sm"
      className="lg:hidden"
      onClick={onClose}
    >
      <ChevronLeft />
    </Button>
    <TicketAvatar issueKey={ticket.issueKey} size="md" className="size-8" />
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-semibold">{ticket.issueKey}</div>
      <div className="truncate text-xs text-muted-foreground">
        {ticket.branchName ?? ticket.suggestedBranch ?? "No branch yet"}
      </div>
    </div>
    <Button
      variant="ghost"
      size="icon-sm"
      className="hidden lg:inline-flex"
      onClick={onClose}
    >
      <X />
    </Button>
  </div>
);
