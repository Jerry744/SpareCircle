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

// ── Tree node types (non-widget structural nodes) ──

export interface BaseNode {
  id: string;
  parentId: string | null;
  childrenIds: string[];
}

export interface ScreenRootNode extends BaseNode {
  kind: "screen_root";
}

export interface StateSectionNode extends BaseNode {
  kind: "state_section";
  screenId: string;
  stateId: string;
  name: string;
  sectionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layoutMode: "auto" | "manual";
}

export interface FreeLayerNode extends BaseNode {
  kind: "free_layer";
}

export type TreeNode = ScreenRootNode | StateSectionNode | FreeLayerNode;

// ── Section (deprecated, use StateSection) ──

/** @deprecated Use StateSection instead. */
export interface Section {
  id: string;
  screenId: string;
  stateId: string;
  name: string;
  canonicalFrameId: string;
  draftNodeIds: string[];
  order: number;
}

/** T5.2: Section renamed to StateSection. */
export type StateSection = Section;

export interface ScreenTreeIndex {
  rootWidgetIds: string[];
}

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
  // T5.2: structural tree nodes (ScreenRoot, StateSection, FreeLayer).
  // These encode the per-screen tree hierarchy; indexes below are derived.
  treeNodesById: Record<string, TreeNode>;
  // Derived indexes — built from treeNodesById via syncSectionIndexes().
  // These are NOT the source of truth for tree structure.
  sectionsById: Record<string, Section>;
  sectionOrderByScreenId: Record<string, string[]>;
  sectionIdByStateId: Record<string, string>;
  screenTreeByScreenId: Record<string, ScreenTreeIndex>;
  screenIdByRootWidgetId: Record<string, string>;
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
