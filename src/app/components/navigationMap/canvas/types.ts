// Navigation Map canvas types.
// Corresponds to `dev-plan/interaction-design-framework/02-navigation-map.md`
// §4.6. Kept React-free so both the renderer and the interaction layer can
// share the same shapes.

import type { NavMapPoint, NavMapViewport } from "../../../backend/types/navigationMap";
import type { NavMapSelection } from "../../../backend/types/navMapSelection";

/**
 * Camera used by the React wrapper. Structurally compatible with
 * `NavMapViewport` so reducer state can be fed straight through.
 */
export interface NavMapCamera extends NavMapViewport {}

/** Rectangular marquee selection, in world space. */
export interface MarqueeRect {
  startWorld: NavMapPoint;
  currentWorld: NavMapPoint;
  additive: boolean;
}

/**
 * Discriminated union of all in-flight drag gestures. `idle` is the resting
 * state between gestures; every `on*` handler returns to it on pointer up.
 */
export type DragKind =
  | { kind: "idle" }
  | {
      kind: "pan";
      pointerStartScreen: NavMapPoint;
      cameraStart: NavMapCamera;
    }
  | {
      kind: "move_nodes";
      pointerStartWorld: NavMapPoint;
      startPositions: Record<string, NavMapPoint>;
    }
  | { kind: "marquee"; rect: MarqueeRect }
  | {
      kind: "connect";
      fromNodeId: string;
      cursorWorld: NavMapPoint;
      snapTarget: { nodeId: string; port: "in" | "out" } | null;
    };

/** Colors used by `renderNavMap`. Tuned to the existing editor palette. */
export interface NavMapRenderTheme {
  background: string;
  gridMinor: string;
  gridMajor: string;
  nodeFill: string;
  nodeSelectedFill: string;
  nodeStroke: string;
  nodeSelectedStroke: string;
  nodeTitle: string;
  nodeGroupBadge: string;
  initialBadge: string;
  edge: string;
  edgeSelected: string;
  port: string;
  marqueeFill: string;
  marqueeStroke: string;
  ghostEdge: string;
}

/** Default dark theme matching `bg-neutral-800 / neutral-900` + `highlight-400`. */
export const NAV_MAP_DARK_THEME: NavMapRenderTheme = {
  background: "#171717",
  gridMinor: "#262626",
  gridMajor: "#3f3f46",
  nodeFill: "#262626",
  nodeSelectedFill: "#1e293b",
  nodeStroke: "#3f3f46",
  nodeSelectedStroke: "#60a5fa",
  nodeTitle: "#f4f4f5",
  nodeGroupBadge: "#737373",
  initialBadge: "#22c55e",
  edge: "#71717a",
  edgeSelected: "#60a5fa",
  port: "#60a5fa",
  marqueeFill: "rgba(96,165,250,0.12)",
  marqueeStroke: "#60a5fa",
  ghostEdge: "#60a5fa",
};

/** Immutable input bundle passed to `renderNavMap` each frame. */
export interface NavMapRenderParams {
  camera: NavMapCamera;
  map: import("../../../backend/types/navigationMap").NavigationMap;
  selection: NavMapSelection;
  drag: DragKind;
  theme?: NavMapRenderTheme;
  devicePixelRatio?: number;
  canvasWidthCss: number;
  canvasHeightCss: number;
  screenGroupColorByStateNodeId?: Record<string, string | undefined>;
}
