import type { AgentLogLine } from "@contract";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Search, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDebugPanelBounds, type ResizeAxis } from "../hooks/use-debug-panel-bounds";
import { useLiveLogs } from "../hooks/use-live-logs";
import { formatElapsed, formatEventOffset } from "../utils/log-event.utils";

type ServerDebugPanelProps = {
  open: boolean;
  onClose: () => void;
};

type ResizeHandleProps = {
  axis: ResizeAxis;
  className: string;
  onResizePointerDown: (axis: ResizeAxis, event: React.PointerEvent<HTMLElement>) => void;
};

const ResizeHandle = ({ axis, className, onResizePointerDown }: ResizeHandleProps) => (
  <div
    data-panel-no-drag
    onPointerDown={(event) => onResizePointerDown(axis, event)}
    className={cn("absolute touch-none", className)}
    aria-hidden
  />
);

export const ServerDebugPanel = ({ open, onClose }: ServerDebugPanelProps) => {
  const { bounds, onDragPointerDown, onResizePointerDown } = useDebugPanelBounds(open);
  const { lines, connected, refresh } = useLiveLogs(open);
  const [search, setSearch] = useState("");
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const listBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setOpenedAt(Date.now());
    setElapsedMs(0);
    setSearch("");
  }, [open]);

  const filteredLines = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return lines;
    return lines.filter(
      (line) =>
        line.event.toLowerCase().includes(query) ||
        line.message.toLowerCase().includes(query),
    );
  }, [lines, search]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - openedAt);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, openedAt]);

  useEffect(() => {
    if (!open) return;
    listBottomRef.current?.scrollIntoView({ block: "end" });
  }, [filteredLines.length, open]);

  const handleRefresh = () => {
    setRefreshing(true);
    setOpenedAt(Date.now());
    setElapsedMs(0);
    refresh();
    window.setTimeout(() => setRefreshing(false), 400);
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
      }}
    >
      <div
        onPointerDown={onDragPointerDown}
        className="flex cursor-grab select-none items-center justify-between border-b border-border px-4 py-3 active:cursor-grabbing"
      >
        <h2 className="text-sm font-semibold text-foreground">Server debug</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          data-panel-no-drag
          onClick={onClose}
          aria-label="Close debug panel"
        >
          <X />
        </Button>
      </div>

      <div
        data-panel-no-drag
        className="flex items-center gap-2 border-b border-border px-4 py-2.5"
      >
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={handleRefresh}
          aria-label="Refresh log stream"
          title="Refresh log stream"
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
        </Button>

        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          <span>{formatElapsed(elapsedMs)}</span>
          <span>{lines.length}</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "size-2 rounded-full",
                connected ? "bg-amber-400" : "bg-muted-foreground/40",
              )}
            />
            Live
          </span>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 bg-zinc-950">
        <div className="py-1 font-mono text-xs leading-relaxed text-zinc-300">
          {filteredLines.length === 0 ? (
            <p className="px-4 py-6 text-zinc-500">
              {connected ? "Waiting for server logs…" : "Connecting to log stream…"}
            </p>
          ) : (
            filteredLines.map((line: AgentLogLine, index: number) => (
              <div
                key={`${line.ts}-${index}`}
                className="flex gap-3 px-4 py-1.5 hover:bg-zinc-900"
              >
                <span className="shrink-0 text-[11px] text-zinc-500">
                  {formatEventOffset(line.ts, openedAt)}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">
                  {line.message}
                </span>
              </div>
            ))
          )}
          <div ref={listBottomRef} />
        </div>
      </ScrollArea>

      <ResizeHandle
        axis="n"
        onResizePointerDown={onResizePointerDown}
        className="top-0 right-3 left-3 h-2 cursor-ns-resize"
      />
      <ResizeHandle
        axis="s"
        onResizePointerDown={onResizePointerDown}
        className="right-3 bottom-0 left-3 h-2 cursor-ns-resize"
      />
      <ResizeHandle
        axis="e"
        onResizePointerDown={onResizePointerDown}
        className="top-3 right-0 bottom-3 w-2 cursor-ew-resize"
      />
      <ResizeHandle
        axis="w"
        onResizePointerDown={onResizePointerDown}
        className="top-3 bottom-3 left-0 w-2 cursor-ew-resize"
      />
      <ResizeHandle
        axis="nw"
        onResizePointerDown={onResizePointerDown}
        className="top-0 left-0 size-3 cursor-nwse-resize"
      />
      <ResizeHandle
        axis="ne"
        onResizePointerDown={onResizePointerDown}
        className="top-0 right-0 size-3 cursor-nesw-resize"
      />
      <ResizeHandle
        axis="sw"
        onResizePointerDown={onResizePointerDown}
        className="bottom-0 left-0 size-3 cursor-nesw-resize"
      />
      <ResizeHandle
        axis="se"
        onResizePointerDown={onResizePointerDown}
        className="right-0 bottom-0 size-3 cursor-nwse-resize"
      />
    </div>,
    document.body,
  );
};
