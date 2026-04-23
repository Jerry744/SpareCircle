// Thin React wrapper around the pure canvas renderer.
// Mirrors the ref/ResizeObserver/render-loop pattern from
// `CanvasViewport.container.tsx` and follows
// `dev-plan/interaction-design-framework/02-navigation-map.md` §5.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { NavigationMap } from "../../../backend/types/navigationMap";
import type { NavMapSelection } from "../../../backend/types/navMapSelection";
import { renderNavMap } from "./render";
import type {
  DragKind,
  NavMapCamera,
  NavMapRenderTheme,
} from "./types";
import type { NavMapInteractionHandlers } from "./interactions";

export interface NavMapCanvasProps {
  map: NavigationMap;
  camera: NavMapCamera;
  drag: DragKind;
  selection: NavMapSelection;
  screenGroupColorByStateNodeId?: Record<string, string | undefined>;
  theme?: NavMapRenderTheme;
  handlers: NavMapInteractionHandlers;
  className?: string;
}

interface CanvasSize {
  widthCss: number;
  heightCss: number;
}

/**
 * NavMapCanvas — mounts a single `<canvas>` inside a resizable container,
 * keeps its backing store in sync with the container size, and paints a
 * frame whenever the immutable inputs (camera/drag/map/selection) change
 * via `requestAnimationFrame` coalescing.
 */
export function NavMapCanvas({
  map,
  camera,
  drag,
  selection,
  screenGroupColorByStateNodeId,
  theme,
  handlers,
  className,
}: NavMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<CanvasSize>({ widthCss: 0, heightCss: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      setSize({
        widthCss: container.clientWidth,
        heightCss: container.clientHeight,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (size.widthCss === 0 || size.heightCss === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      renderNavMap(ctx, {
        camera,
        map,
        selection,
        drag,
        theme,
        canvasWidthCss: size.widthCss,
        canvasHeightCss: size.heightCss,
        devicePixelRatio:
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        screenGroupColorByStateNodeId,
      });
    });
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [camera, drag, map, selection, size, theme, screenGroupColorByStateNodeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const down = (e: PointerEvent) => {
      canvas.focus();
      canvas.setPointerCapture?.(e.pointerId);
      handlers.onPointerDown(e);
    };
    const move = (e: PointerEvent) => handlers.onPointerMove(e);
    const up = (e: PointerEvent) => {
      if (canvas.hasPointerCapture?.(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      handlers.onPointerUp(e);
    };
    const dbl = (e: MouseEvent) => handlers.onDoubleClick(e);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      handlers.onWheel(e);
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("dblclick", dbl);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("dblclick", dbl);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [handlers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const keyHandler = (e: KeyboardEvent) => {
      if (!container.contains(document.activeElement)) return;
      handlers.onKeyDown(e);
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [handlers]);

  const canvasStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "block",
    outline: "none",
    touchAction: "none",
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={
        "absolute inset-0 overflow-hidden focus:outline-none" +
        (className ? ` ${className}` : "")
      }
    >
      <canvas ref={canvasRef} style={canvasStyle} tabIndex={0} />
    </div>
  );
}
