import type { TicketSummary } from "../types";
import { ActionBar } from "./ActionBar";

interface Props {
  ticket: TicketSummary | null;
  onAction: () => void;
}

export function TicketDetail({ ticket, onAction }: Props) {
  if (!ticket) {
    return (
      <div className="detail empty">
        <p>Select a ticket to view details.</p>
      </div>
    );
  }

  const interrupt = ticket.interrupt;

  return (
    <div className="detail">
      <header>
        <h2>{ticket.issueKey}</h2>
        <span className={`badge phase-${ticket.phase}`}>{ticket.phase.replace("_", " ")}</span>
        {ticket.awaiting && <span className="badge awaiting">{ticket.awaiting}</span>}
        {ticket.busy && <span className="badge busy">running</span>}
      </header>

      <dl className="meta">
        <dt>Thread</dt>
        <dd><code>{ticket.threadId}</code></dd>
        {ticket.status && (
          <>
            <dt>Status</dt>
            <dd>{ticket.status}</dd>
          </>
        )}
        {ticket.branchName && (
          <>
            <dt>Branch</dt>
            <dd><code>{ticket.branchName}</code></dd>
          </>
        )}
        {ticket.activeRepoPath && (
          <>
            <dt>Repo</dt>
            <dd><code>{ticket.activeRepoPath}</code></dd>
          </>
        )}
        {ticket.error && (
          <>
            <dt>Error</dt>
            <dd className="error">{ticket.error}</dd>
          </>
        )}
      </dl>

      {interrupt && (
        <section className="interrupt">
          <h3>{interrupt.title}</h3>
          <pre className="body">{interrupt.body}</pre>
          {interrupt.plan && (
            <>
              <h4>Plan</h4>
              <pre className="plan">{interrupt.plan}</pre>
            </>
          )}
          {interrupt.openRisks?.length ? (
            <>
              <h4>Open risks</h4>
              <ul>
                {interrupt.openRisks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      )}

      <ActionBar ticket={ticket} onAction={onAction} />
    </div>
  );
}
