type TicketDetailLoadingProps = {
  width: number;
};

export const TicketDetailLoading = ({ width }: TicketDetailLoadingProps) => (
  <aside
    style={{ width }}
    className="flex h-full min-h-0 w-full shrink-0 items-center justify-center overflow-hidden border-l border-border bg-card text-sm text-muted-foreground lg:w-auto"
  >
    Loading ticket…
  </aside>
);
