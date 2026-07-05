import type { TicketDetail } from "@/api/types";
import { Bot } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { TicketStatusBadge } from "./ticket-status-badge";

type TicketDetailMetaProps = {
  ticket: TicketDetail;
};

export const TicketDetailMeta = ({ ticket }: TicketDetailMetaProps) => (
  <div className="shrink-0">
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      <span className="font-mono text-xs text-muted-foreground">
        {ticket.issueKey}
      </span>
      {ticket.status ? <TicketStatusBadge status={ticket.status} /> : null}
      {ticket.scope ? (
        <Badge variant="outline" className="capitalize">
          {ticket.scope}
        </Badge>
      ) : null}
      <Badge variant="secondary">
        <Bot data-icon="inline-start" />
        Agent orchestrated
      </Badge>
    </div>

    <div className="border-b border-border px-4 py-2.5">
      <p className="text-sm font-medium">{ticket.summary}</p>
      {ticket.browseUrl ? (
        <a
          href={ticket.browseUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-xs text-primary hover:underline"
        >
          Open in Jira
        </a>
      ) : null}
    </div>
  </div>
);
