import { useState } from "react";
import type { TicketSummary } from "../types";
import { respondTicket, resumeTicket } from "../api";

interface Props {
  ticket: TicketSummary;
  onAction: () => void;
  disabled?: boolean;
}

export function ActionBar({ ticket, onAction, disabled }: Props) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = disabled || loading || ticket.busy;

  async function run(fn: () => Promise<unknown>) {
    setLoading(true);
    setError(null);
    try {
      await fn();
      setComment("");
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (ticket.awaiting === "plan") {
    return (
      <div className="action-bar">
        <button disabled={busy} onClick={() => run(() => respondTicket(ticket.issueKey, "approve"))}>
          Implement
        </button>
        <button disabled={busy} className="danger" onClick={() => run(() => respondTicket(ticket.issueKey, "reject"))}>
          Reject
        </button>
        <div className="comment-row">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Plan feedback…"
            disabled={busy}
          />
          <button
            disabled={busy || !comment.trim()}
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
        <button disabled={busy} onClick={() => run(() => respondTicket(ticket.issueKey, "ship"))}>
          Ship
        </button>
        <button disabled={busy} className="danger" onClick={() => run(() => respondTicket(ticket.issueKey, "reject"))}>
          Reject
        </button>
        <div className="comment-row">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ship feedback…"
            disabled={busy}
          />
          <button
            disabled={busy || !comment.trim()}
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
            disabled={busy}
          />
          <button
            disabled={busy || !comment.trim()}
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
