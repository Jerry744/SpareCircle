// ProjectSnapshot v2.
// Corresponds to `dev-plan/interaction-design-framework/01-data-model.md` §3.8.
//
// IMPORTANT: v1 `ProjectSnapshot` (from ./project.ts) is kept untouched so
// the running editor keeps compiling. v2 lives side-by-side and will be
// wired into the reducer/persistence layer by later phases (see README §2).
// Any code reading/writing v2 MUST go through the parsers in
// `backend/validation/` to keep INV-1..INV-10 enforced.

import type { AssetItem } from "./asset";
import type { StyleToken, ColorFormat } from "./style";
import type { WidgetNode } from "./widget";
import type { CanvasSnapSettings } from "./project";
import type { NavigationMap } from "./navigationMap";
import type { StateBoard } from "./stateBoard";
import type { Variant } from "./variant";
import type { ScreenGroup } from "./screenGroup";
import type { TransitionEventBinding } from "./eventBinding";
import type { WorkspaceMode } from "./mode";
import type { NavigationZoomLevel } from "./zoomLevel";
import type { Snapshot } from "./snapshot";

export const CURRENT_PROJECT_SCHEMA_VERSION_V2 = 2 as const;

// `ProjectSnapshotCore` is the portion of a project that can be frozen into
// a Snapshot. It deliberately excludes `snapshots`, `workspaceMode`, and
// `zoomLevel` to prevent snapshots from nesting or capturing per-user prefs.
export interface ProjectSnapshotCore {
  schemaVersion: typeof CURRENT_PROJECT_SCHEMA_VERSION_V2;
  projectName: string;
  navigationMap: NavigationMap;
  stateBoardsById: Record<string, StateBoard>;
  variantsById: Record<string, Variant>;
  // `widgetsById` holds the flattened widget tree shared by every Variant.
  // The v2 model reuses the existing WidgetNode shape to avoid a second
  // editing/render pipeline.
  widgetsById: Record<string, WidgetNode>;
  transitionEventBindings: Record<string, TransitionEventBinding>;
  screenGroups: Record<string, ScreenGroup>;
  screenGroupOrder: string[];
  styleTokens: StyleToken[];
  assets: Record<string, AssetItem>;
  colorFormat?: ColorFormat;
  canvasSnap?: CanvasSnapSettings;
}

export interface ProjectSnapshotV2 extends ProjectSnapshotCore {
  // User-triggered freezes; never touched by the undo stack.
  snapshots: Snapshot[];
  // Workspace-level preferences persisted per project.
  workspaceMode: WorkspaceMode;
  zoomLevel: NavigationZoomLevel;
}

export function isProjectSnapshotV2(value: unknown): value is ProjectSnapshotV2 {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { schemaVersion?: unknown }).schemaVersion === CURRENT_PROJECT_SCHEMA_VERSION_V2
  );
}
