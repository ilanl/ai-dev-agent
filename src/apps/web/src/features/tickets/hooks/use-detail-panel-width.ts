import { useCallback, useState } from "react";

export const DEFAULT_DETAIL_PANEL_WIDTH = 448;
export const DETAIL_PANEL_WIDTH_STORAGE_KEY = "tickets-detail-panel-width";

const MIN_DETAIL_WIDTH = 320;
const MIN_TABLE_WIDTH = 400;

const clampWidth = (width: number): number => {
  const maxWidth = window.innerWidth - MIN_TABLE_WIDTH;
  return Math.min(maxWidth, Math.max(MIN_DETAIL_WIDTH, width));
};

const readStoredWidth = (): number => {
  try {
    const raw = localStorage.getItem(DETAIL_PANEL_WIDTH_STORAGE_KEY);
    if (!raw) return DEFAULT_DETAIL_PANEL_WIDTH;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_DETAIL_PANEL_WIDTH;
    return clampWidth(parsed);
  } catch {
    return DEFAULT_DETAIL_PANEL_WIDTH;
  }
};

const storeWidth = (width: number): void => {
  try {
    localStorage.setItem(DETAIL_PANEL_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // ignore quota / private mode
  }
};

export const useDetailPanelWidth = () => {
  const [width, setWidth] = useState(readStoredWidth);

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;
      let lastWidth = startWidth;

      const onMove = (moveEvent: PointerEvent) => {
        lastWidth = clampWidth(startWidth + (startX - moveEvent.clientX));
        setWidth(lastWidth);
      };

      const onUp = () => {
        storeWidth(lastWidth);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [width],
  );

  return { width, onResizePointerDown };
};
