// NavMapToolbar — zoom / auto-tidy / new-node controls shown above the map.
// See `dev-plan/interaction-design-framework/02-navigation-map.md` §3.2.

import {
  LayoutTemplate,
  Plus,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { NavMapCamera } from "../canvas/types";

export interface NavMapToolbarProps {
  camera: NavMapCamera;
  selectionSize: number;
  onZoomIn(): void;
  onZoomOut(): void;
  onResetCamera(): void;
  onAutoTidy(): void;
  onCreateStateNode?(): void;
  className?: string;
}

const BUTTON_CLASS =
  "inline-flex items-center justify-center h-7 w-7 rounded-md text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40 disabled:hover:bg-transparent";

const LABEL_BUTTON_CLASS =
  "inline-flex items-center gap-1 px-2 h-7 rounded-md text-xs text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-400";

/**
 * NavMapToolbar — stateless horizontal toolbar placed on top of the
 * NavMap canvas. Parents own all state; the toolbar just emits intents.
 */
export function NavMapToolbar({
  camera,
  selectionSize,
  onZoomIn,
  onZoomOut,
  onResetCamera,
  onAutoTidy,
  onCreateStateNode,
  className,
}: NavMapToolbarProps) {
  const zoomPct = Math.round((camera.zoom || 1) * 100);
  return (
    <div
      className={
        "absolute top-2 left-2 z-10 flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800/95 px-1.5 py-1 shadow-lg backdrop-blur" +
        (className ? ` ${className}` : "")
      }
      role="toolbar"
      aria-label="Navigation Map toolbar"
    >
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={onZoomOut}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <span
        className="w-10 text-center text-xs tabular-nums text-neutral-300"
        aria-live="polite"
      >
        {zoomPct}%
      </span>
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={onZoomIn}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
      <span className="mx-1 h-4 w-px bg-neutral-700" aria-hidden />
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={onResetCamera}
        title="Reset camera"
        aria-label="Reset camera"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={LABEL_BUTTON_CLASS}
        onClick={onAutoTidy}
        title="Auto tidy layout"
      >
        <LayoutTemplate className="h-4 w-4" />
        <span>Tidy</span>
      </button>
      {onCreateStateNode ? (
        <>
          <span className="mx-1 h-4 w-px bg-neutral-700" aria-hidden />
          <button
            type="button"
            className={LABEL_BUTTON_CLASS}
            onClick={onCreateStateNode}
            title="Create state node"
          >
            <Plus className="h-4 w-4" />
            <span>New state</span>
          </button>
        </>
      ) : null}
      {selectionSize > 0 ? (
        <>
          <span className="mx-1 h-4 w-px bg-neutral-700" aria-hidden />
          <span className="px-1 text-xs text-neutral-400">
            {selectionSize} selected
          </span>
        </>
      ) : null}
    </div>
  );
}
