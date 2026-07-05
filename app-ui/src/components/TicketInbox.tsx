import type { TicketPhase, TicketSummary } from "../types";

type Filter = "all" | TicketPhase;

interface Props {
  tickets: TicketSummary[];
  selectedKey: string | null;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  onSelect: (issueKey: string) => void;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "needs_you", label: "Needs you" },
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "done", label: "Done" },
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

export function TicketInbox({
  tickets,
  selectedKey,
  filter,
  onFilterChange,
  onSelect,
}: Props) {
  const visible =
    filter === "all" ? tickets : tickets.filter((t) => t.phase === filter);

  return (
    <div className="inbox">
      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={filter === f.id ? "active" : ""}
            onClick={() => onFilterChange(f.id)}
          >
            {f.label}
            {f.id !== "all" && (
              <span className="count">
                {tickets.filter((t) => t.phase === f.id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <ul className="ticket-list">
        {visible.length === 0 && <li className="empty">No tickets in this view.</li>}
        {visible.map((ticket) => (
          <li key={ticket.threadId}>
            <button
              className={`ticket-row ${selectedKey === ticket.issueKey ? "selected" : ""}`}
              onClick={() => onSelect(ticket.issueKey)}
            >
              <span className="key">{ticket.issueKey}</span>
              <span className={`phase phase-${ticket.phase}`}>
                {ticket.awaiting ?? ticket.phase}
              </span>
              <span className="when">{formatWhen(ticket.updatedAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
