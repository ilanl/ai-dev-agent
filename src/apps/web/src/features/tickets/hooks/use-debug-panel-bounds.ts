import { useCallback, useEffect, useState } from "react";

export type DebugPanelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DEBUG_PANEL_POSITION_STORAGE_KEY = "tickets-debug-panel-position";
export const DEBUG_PANEL_SIZE_STORAGE_KEY = "tickets-debug-panel-size";
const LEGACY_BOUNDS_STORAGE_KEY = "tickets-debug-panel-bounds";

const DEFAULT_WIDTH = 920;
const DEFAULT_HEIGHT = 520;
const MIN_WIDTH = 400;
const MIN_HEIGHT = 280;

export type ResizeAxis = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RESIZE_CURSORS: Record<ResizeAxis, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

const resizeBounds = (
  start: DebugPanelBounds,
  axis: ResizeAxis,
  dx: number,
  dy: number,
): DebugPanelBounds => {
  let { x, y, width, height } = start;

  if (axis.includes("e")) width = start.width + dx;
  if (axis.includes("w")) {
    width = start.width - dx;
    x = start.x + dx;
  }
  if (axis.includes("s")) height = start.height + dy;
  if (axis.includes("n")) {
    height = start.height - dy;
    y = start.y + dy;
  }

  return clampBounds({ x, y, width, height });
};

const clampBounds = (bounds: DebugPanelBounds): DebugPanelBounds => {
  const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - 32);
  const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - 32);

  return {
    width: Math.min(maxWidth, Math.max(MIN_WIDTH, bounds.width)),
    height: Math.min(maxHeight, Math.max(MIN_HEIGHT, bounds.height)),
    x: Math.min(
      Math.max(16, bounds.x),
      window.innerWidth - Math.min(maxWidth, Math.max(MIN_WIDTH, bounds.width)) - 16,
    ),
    y: Math.min(
      Math.max(16, bounds.y),
      window.innerHeight - Math.min(maxHeight, Math.max(MIN_HEIGHT, bounds.height)) - 16,
    ),
  };
};

const defaultBounds = (): DebugPanelBounds =>
  clampBounds({
    x: Math.max(16, window.innerWidth - DEFAULT_WIDTH - 24),
    y: Math.max(16, window.innerHeight - DEFAULT_HEIGHT - 24),
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });

const readJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const readLegacyBounds = (): DebugPanelBounds | null => {
  const parsed = readJson<DebugPanelBounds>(LEGACY_BOUNDS_STORAGE_KEY);
  if (
    !parsed ||
    !Number.isFinite(parsed.x) ||
    !Number.isFinite(parsed.y) ||
    !Number.isFinite(parsed.width) ||
    !Number.isFinite(parsed.height)
  ) {
    return null;
  }
  return parsed;
};

const readStoredBounds = (): DebugPanelBounds => {
  const legacy = readLegacyBounds();
  const position = readJson<Pick<DebugPanelBounds, "x" | "y">>(DEBUG_PANEL_POSITION_STORAGE_KEY);
  const size = readJson<Pick<DebugPanelBounds, "width" | "height">>(DEBUG_PANEL_SIZE_STORAGE_KEY);

  const x = Number.isFinite(position?.x) ? position!.x : legacy?.x;
  const y = Number.isFinite(position?.y) ? position!.y : legacy?.y;
  const width = Number.isFinite(size?.width) ? size!.width : legacy?.width;
  const height = Number.isFinite(size?.height) ? size!.height : legacy?.height;

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return defaultBounds();
  }

  return clampBounds({ x: x!, y: y!, width: width!, height: height! });
};

const storePosition = (x: number, y: number): void => {
  try {
    localStorage.setItem(DEBUG_PANEL_POSITION_STORAGE_KEY, JSON.stringify({ x, y }));
  } catch {
    // ignore quota / private mode
  }
};

const storeSize = (width: number, height: number): void => {
  try {
    localStorage.setItem(DEBUG_PANEL_SIZE_STORAGE_KEY, JSON.stringify({ width, height }));
  } catch {
    // ignore quota / private mode
  }
};

export const useDebugPanelBounds = (open: boolean) => {
  const [bounds, setBounds] = useState(readStoredBounds);

  useEffect(() => {
    if (!open) return;
    setBounds(readStoredBounds());
  }, [open]);

  const onDragPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("[data-panel-no-drag]")) return;

      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const startBounds = bounds;
      let lastBounds = startBounds;

      const onMove = (moveEvent: PointerEvent) => {
        lastBounds = clampBounds({
          ...startBounds,
          x: startBounds.x + moveEvent.clientX - startX,
          y: startBounds.y + moveEvent.clientY - startY,
        });
        setBounds(lastBounds);
      };

      const onUp = () => {
        storePosition(lastBounds.x, lastBounds.y);
        setBounds(lastBounds);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [bounds],
  );

  const onResizePointerDown = useCallback(
    (axis: ResizeAxis, event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      const startBounds = bounds;
      let lastBounds = startBounds;

      const onMove = (moveEvent: PointerEvent) => {
        lastBounds = resizeBounds(
          startBounds,
          axis,
          moveEvent.clientX - startX,
          moveEvent.clientY - startY,
        );
        setBounds(lastBounds);
      };

      const onUp = () => {
        storeSize(lastBounds.width, lastBounds.height);
        storePosition(lastBounds.x, lastBounds.y);
        setBounds(lastBounds);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = RESIZE_CURSORS[axis];
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [bounds],
  );

  return { bounds, onDragPointerDown, onResizePointerDown };
};
