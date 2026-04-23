// Zoom-navigation level type.
// Corresponds to `dev-plan/interaction-design-framework/01-data-model.md` §3.7.
// "Zoom" is semantic navigation, not a camera property (PRD §5.2). The
// current level is persisted so reloading restores the user's context.

export type NavigationZoomLevel =
  | { level: "map" }
  | { level: "board"; stateNodeId: string; variantId: string };

export const DEFAULT_ZOOM_LEVEL: NavigationZoomLevel = { level: "map" };

export function isMapLevel(
  zoomLevel: NavigationZoomLevel,
): zoomLevel is { level: "map" } {
  return zoomLevel.level === "map";
}

export function isBoardLevel(
  zoomLevel: NavigationZoomLevel,
): zoomLevel is { level: "board"; stateNodeId: string; variantId: string } {
  return zoomLevel.level === "board";
}
