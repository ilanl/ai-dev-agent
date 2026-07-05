import { useState } from "react";
import type { TicketSummary } from "../types";
import { respondTicket, resumeTicket } from "../api";
import { formatApiError, formatBusyMessage } from "../ticketStatus";

interface Props {
  ticket: TicketSummary;
  onTicketUpdated: (ticket: TicketSummary) => void;
  isActing: boolean;
  onActingChange: (acting: boolean) => void;
  disabled?: boolean;
}

function WorkingHint({ message }: { message: string }) {
  return <p className="hint">{message}</p>;
}

export function ActionBar({
  ticket,
  onTicketUpdated,
  isActing,
  onActingChange,
  disabled,
}: Props) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const blocked = disabled || ticket.busy;

  async function run(fn: () => Promise<{ ticket: TicketSummary | null }>) {
    onActingChange(true);
    setError(null);
    try {
      const { ticket: updated } = await fn();
      setComment("");
      if (updated) onTicketUpdated(updated);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      onActingChange(false);
    }
  }

  if (ticket.busy || isActing) {
    const message = isActing && !ticket.busy ? "Sending…" : formatBusyMessage(ticket);
    return (
      <div className="action-bar">
        <WorkingHint message={message} />
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  if (ticket.awaiting === "plan") {
    return (
      <div className="action-bar">
        <button disabled={blocked} onClick={() => run(() => respondTicket(ticket.issueKey, "approve"))}>
          Implement
        </button>
        <button disabled={blocked} className="danger" onClick={() => run(() => respondTicket(ticket.issueKey, "reject"))}>
          Reject
        </button>
        <div className="comment-row">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Plan feedback…"
            disabled={blocked}
          />
          <button
            disabled={blocked || !comment.trim()}
            onClick={() => run(() => respondTicket(ticket.issueKey, "comment", comment.trim()))}
          >
            Send feedback
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  if (ticket.awaiting === "ship") {
    return (
      <div className="action-bar">
        <button disabled={blocked} onClick={() => run(() => respondTicket(ticket.issueKey, "ship"))}>
          Ship
        </button>
        <button disabled={blocked} className="danger" onClick={() => run(() => respondTicket(ticket.issueKey, "reject"))}>
          Reject
        </button>
        <div className="comment-row">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ship feedback…"
            disabled={blocked}
          />
          <button
            disabled={blocked || !comment.trim()}
            onClick={() => run(() => respondTicket(ticket.issueKey, "comment", comment.trim()))}
          >
            Send feedback
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  if (ticket.awaiting === "question") {
    return (
      <div className="action-bar">
        <div className="comment-row">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Your answer…"
            disabled={blocked}
          />
          <button
            disabled={blocked || !comment.trim()}
            onClick={() => run(() => resumeTicket(ticket.issueKey, comment.trim()))}
          >
            Submit answer
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return null;
}
