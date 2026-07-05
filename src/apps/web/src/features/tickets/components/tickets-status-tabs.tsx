import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTicketsContext } from "../tickets-context";
import { STATUS_TABS, type StatusTab } from "../lib/ticket-status.constants";
import { tabCount } from "../lib/ticket-row.utils";

export const TicketsStatusTabs = () => {
  const { activeTab, setActiveTab, tickets } = useTicketsContext();

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as StatusTab)}
      className="gap-0"
    >
      <div className="border-b border-border bg-card px-5">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start rounded-none bg-transparent p-0"
        >
          {STATUS_TABS.map(({ key, label }) => (
            <TabsTrigger
              key={key}
              value={key}
              className="rounded-none px-3 py-2.5 data-active:shadow-none"
            >
              {label}
              <Badge variant="secondary" className="ml-1.5 font-normal">
                {tabCount(tickets, key)}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
};
