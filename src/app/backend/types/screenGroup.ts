// ScreenGroup domain types.
// Corresponds to `dev-plan/interaction-design-framework/01-data-model.md` §3.4.
// Screen is intentionally de-emphasized during editing; it is reintroduced
// at export time through ScreenGroup → Screen mapping (PRD §6.10 + §6.11).

export interface ScreenGroup {
  id: string;
  name: string;
  // Visual identity colour used both on the ScreenGroup chip and to tint
  // nodes on the Navigation Map.
  color: string;
  description?: string;
  // Optional override used by the export adapter; when empty the group
  // `name` is slugified into the generated Screen name.
  exportScreenName?: string;
  // Reverse lookup of StateNode membership. Keeping it here lets the
  // Navigation Map render group tints without scanning every StateNode.
  stateNodeIds: string[];
}

export const DEFAULT_SCREEN_GROUP_COLOR = "#a855f7";
