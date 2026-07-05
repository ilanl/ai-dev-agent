type TicketDetailResizeHandleProps = {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
};

export const TicketDetailResizeHandle = ({
  onPointerDown,
}: TicketDetailResizeHandleProps) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize detail panel"
    onPointerDown={onPointerDown}
    className="hidden w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/40 active:bg-primary/60 lg:block"
  />
);
