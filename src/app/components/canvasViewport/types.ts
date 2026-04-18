import type { Point } from "../../backend/editorStore";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface SafariGestureEvent extends Event {
  scale: number;
  clientX: number;
  clientY: number;
}

export interface MarqueeState {
  startWorld: Point;
  currentWorld: Point;
  additive: boolean;
}

export interface DragState {
  kind: "move" | "resize";
  pointerStart: Point;
  widgetIds: string[];
  handle?: "se";
}
