import { Plus, Search } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTicketsContext } from "../tickets-context";

export const TicketsToolbar = () => {
  const { search, setSearch, startNewTicket, isStarting } = useTicketsContext();

  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-5 py-3">
      <Button onClick={startNewTicket} disabled={isStarting}>
        <Plus data-icon="inline-start" />
        New ticket
      </Button>
      <div className="relative max-w-xs flex-1">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search requests..."
          className="pl-8"
        />
      </div>
    </div>
  );
};
