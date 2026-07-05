import { cn } from "@/lib/utils";
import { TicketsStatusTabs } from "./components/tickets-status-tabs";
import { TicketsTable } from "./components/tickets-table";
import { TicketsToolbar } from "./components/tickets-toolbar";
import { TicketDetailLoading } from "./components/ticket-detail-loading";
import { TicketDetailPanel } from "./components/ticket-detail-panel";
import { TicketDetailResizeHandle } from "./components/ticket-detail-resize-handle";
import { useDetailPanelWidth } from "./hooks/use-detail-panel-width";
import { TicketsProvider, useTicketsContext } from "./tickets-context";

const TicketsLayout = () => {
  const { selectedIssueKey, detail, isDetailLoading } = useTicketsContext();
  const { width: detailWidth, onResizePointerDown } = useDetailPanelWidth();
  const showDetailPane = isDetailLoading || (selectedIssueKey && detail);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-hidden",
            selectedIssueKey ? "hidden lg:flex" : "flex",
            "lg:flex",
          )}
        >
          <TicketsToolbar />
          <TicketsStatusTabs />
          <TicketsTable />
        </div>

        {showDetailPane ? (
          <>
            <TicketDetailResizeHandle onPointerDown={onResizePointerDown} />
            {isDetailLoading ? (
              <TicketDetailLoading width={detailWidth} />
            ) : detail ? (
              <TicketDetailPanel ticket={detail} width={detailWidth} />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};

export const TicketsPage = () => (
  <TicketsProvider>
    <TicketsLayout />
  </TicketsProvider>
);
