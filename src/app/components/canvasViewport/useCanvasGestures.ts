import { useEffect, useRef, type RefObject, type Dispatch, type SetStateAction } from "react";
import type { Camera, SafariGestureEvent } from "./types";

/**
 * Wires Safari pinch-to-zoom gestures and prevents the default
 * ctrl+wheel page zoom on the canvas container.
 *
 * Anchor tracking is kept local: gesture-driven zoom and wheel-driven zoom
 * never overlap in a single user gesture, so they can own independent anchors.
 */
export function useCanvasGestures(
  containerRef: RefObject<HTMLDivElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  setCamera: Dispatch<SetStateAction<Camera>>,
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number },
): void {
  const lastGestureScaleRef = useRef<number | null>(null);
  const zoomAnchorWorldRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const getAnchorWorldFromGesture = (event: SafariGestureEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return { x: 0, y: 0 };
      }

      const rect = canvas.getBoundingClientRect();
      const clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2;
      const clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2;
      return screenToWorld(clientX, clientY);
    };

    const handleNativeWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    const handleGestureStart = (event: Event) => {
      const gesture = event as SafariGestureEvent;
      gesture.preventDefault();
      lastGestureScaleRef.current = gesture.scale;
      zoomAnchorWorldRef.current = getAnchorWorldFromGesture(gesture);
    };

    const handleGestureChange = (event: Event) => {
      const gesture = event as SafariGestureEvent;
      gesture.preventDefault();

      const previousScale = lastGestureScaleRef.current ?? gesture.scale;
      if (!Number.isFinite(previousScale) || !Number.isFinite(gesture.scale) || previousScale === 0) {
        lastGestureScaleRef.current = gesture.scale;
        return;
      }

      const ratio = gesture.scale / previousScale;
      const anchor = getAnchorWorldFromGesture(gesture);
      zoomAnchorWorldRef.current = anchor;
      setCamera((prev) => {
        const newZoom = Math.max(0.1, Math.min(5, prev.zoom * ratio));
        return {
          x: (anchor.x + prev.x) * prev.zoom / newZoom - anchor.x,
          y: (anchor.y + prev.y) * prev.zoom / newZoom - anchor.y,
          zoom: newZoom,
        };
      });

      lastGestureScaleRef.current = gesture.scale;
    };

    const handleGestureEnd = (event: Event) => {
      const gesture = event as SafariGestureEvent;
      gesture.preventDefault();
      lastGestureScaleRef.current = null;
      zoomAnchorWorldRef.current = null;
    };

    container.addEventListener("wheel", handleNativeWheel, { passive: false });
    container.addEventListener("gesturestart", handleGestureStart, { passive: false });
    container.addEventListener("gesturechange", handleGestureChange, { passive: false });
    container.addEventListener("gestureend", handleGestureEnd, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleNativeWheel);
      container.removeEventListener("gesturestart", handleGestureStart);
      container.removeEventListener("gesturechange", handleGestureChange);
      container.removeEventListener("gestureend", handleGestureEnd);
    };
  }, [canvasRef, containerRef, screenToWorld, setCamera]);
}
