import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import type { Camera } from "./types";

export function CanvasViewportToolbar({
  camera,
  screenSize,
  onZoomIn,
  onZoomOut,
  onResetView,
}: {
  camera: Camera;
  screenSize: { width: number; height: number };
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}) {
  return (
    <div className="h-10 bg-neutral-700 border-b border-neutral-900 flex items-center justify-between px-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-300">Canvas</span>
        <div className="h-4 w-px bg-neutral-600" />
        <span className="text-xs text-neutral-300">
          {screenSize.width} × {screenSize.height}
        </span>
        <div className="h-4 w-px bg-neutral-600" />
        <span className="text-xs text-neutral-400">
          Pan: Two-Finger Drag / Space / Middle Drag | Zoom: Pinch
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onZoomOut}
          className="p-1 hover:bg-neutral-600 rounded transition-colors text-neutral-300"
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-xs text-neutral-300 w-14 text-center">{Math.round(camera.zoom * 100)}%</span>
        <button
          onClick={onZoomIn}
          className="p-1 hover:bg-neutral-600 rounded transition-colors text-neutral-300"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={onResetView}
          className="p-1 hover:bg-neutral-600 rounded transition-colors text-neutral-300"
        >
          <Maximize size={14} />
        </button>
      </div>
    </div>
  );
}
