import type { TicketDetail } from "@/api/types";
import { cn } from "@/lib/utils";
import { authorInitials, formatTime } from "../lib/ticket.utils";
import { JiraPlainContent } from "./jira-plain-content";

type TicketCommentProps = {
  comment: TicketDetail["comments"][number];
  tone: string;
};

export const TicketComment = ({ comment, tone }: TicketCommentProps) => (
  <div className="flex min-w-0 gap-2">
    <div
      className={cn(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        tone,
      )}
    >
      {authorInitials(comment.authorDisplayName)}
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="min-w-0 max-w-full overflow-hidden rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs leading-relaxed">
        <JiraPlainContent content={comment.bodyPlain} />
      </div>
      <span className="px-1 text-xs text-muted-foreground">
        {comment.authorDisplayName ?? "Unknown"} · {formatTime(comment.created)}
      </span>
    </div>
  </div>
);
