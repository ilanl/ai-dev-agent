import type { TicketDetail } from "@/api/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { avatarTone } from "../lib/ticket-row.utils";
import { TicketComment } from "./ticket-comment";
import { JiraPlainContent } from "./jira-plain-content";
import { TicketTypingIndicator } from "./ticket-typing-indicator";

type TicketDetailThreadProps = {
  ticket: TicketDetail;
};

export const TicketDetailThread = ({ ticket }: TicketDetailThreadProps) => {
  const tone = avatarTone(ticket.issueKey);

  return (
    <ScrollArea className="min-h-0 flex-1 overflow-hidden px-4 py-3">
      <div className="flex min-w-0 flex-col gap-3">
        {ticket.descriptionPlain ? (
          <div className="min-w-0 overflow-hidden rounded-xl bg-muted px-3 py-2">
            <JiraPlainContent content={ticket.descriptionPlain} />
          </div>
        ) : null}

        {ticket.interrupt ? (
          <div className="rounded-xl border border-border bg-accent/40 px-3 py-2">
            <p className="text-xs font-semibold">{ticket.interrupt.title}</p>
            <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">
              {ticket.interrupt.body}
            </p>
            {ticket.interrupt.plan ? (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-card p-2 text-xs whitespace-pre-wrap">
                {ticket.interrupt.plan}
              </pre>
            ) : null}
          </div>
        ) : null}

        {ticket.comments.map((comment) => (
          <TicketComment key={comment.id} comment={comment} tone={tone} />
        ))}

        {ticket.awaiting ? <TicketTypingIndicator /> : null}
      </div>
    </ScrollArea>
  );
};
