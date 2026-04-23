import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import type { Camera } from "./types";
import type { Point } from "../../backend/editorStore";

/**
 * Returns a React wheel handler that pans on plain wheel events and zooms
 * (anchored at the cursor) when ctrlKey is pressed — which is what macOS
 * sends for trackpad pinch gestures outside Safari.
 */
export function useCanvasWheel(
  setCamera: Dispatch<SetStateAction<Camera>>,
  screenToWorld: (screenX: number, screenY: number) => Point,
): (event: React.WheelEvent) => void {
  const zoomAnchorWorldRef = useRef<Point | null>(null);
  const zoomTimeoutRef = useRef<number | null>(null);

  return useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();

      if (!event.ctrlKey) {
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
          zoomTimeoutRef.current = null;
        }
        zoomAnchorWorldRef.current = null;
        setCamera((prev) => ({
          ...prev,
          x: prev.x - event.deltaX / prev.zoom,
          y: prev.y - event.deltaY / prev.zoom,
        }));
        return;
      }

      if (!zoomAnchorWorldRef.current) {
        zoomAnchorWorldRef.current = screenToWorld(event.clientX, event.clientY);
      }
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
      zoomTimeoutRef.current = window.setTimeout(() => {
        zoomAnchorWorldRef.current = null;
      }, 150);

      const anchor = zoomAnchorWorldRef.current;
      const delta = -event.deltaY * 0.001;
      setCamera((prev) => {
        const newZoom = Math.max(0.1, Math.min(5, prev.zoom * (1 + delta)));
        return {
          x: (anchor.x + prev.x) * prev.zoom / newZoom - anchor.x,
          y: (anchor.y + prev.y) * prev.zoom / newZoom - anchor.y,
          zoom: newZoom,
        };
      });
    },
    [screenToWorld, setCamera],
  );
}
