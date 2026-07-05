import { Bot } from "@/components/icons";
import { useTicketsContext } from "../tickets-context";

export const TicketsEmptyState = () => {
  const { isFilteredEmpty } = useTicketsContext();

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <Bot className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">
        {isFilteredEmpty ? "No tickets match your filters" : "No tickets yet"}
      </p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {isFilteredEmpty
          ? "Try a different search term or status tab."
          : "Start a new ticket with a Jira issue key to begin an agent run."}
      </p>
    </div>
  );
};
