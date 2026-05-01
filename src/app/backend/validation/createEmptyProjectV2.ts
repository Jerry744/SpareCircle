// Factory for a fresh, valid `ProjectSnapshotV2` seed.
// Produces the smallest project that satisfies every invariant from
// `01-data-model.md` §4 so later phases can boot straight into v2.

import type { WidgetNode } from "../types/widget";
import type { StateBoard } from "../types/stateBoard";
import type { Variant } from "../types/variant";
import type { NavigationMap, StateNode } from "../types/navigationMap";
import type { ProjectSnapshotV2, TreeNode, StateSectionNode } from "../types/projectV2";
import { CURRENT_PROJECT_SCHEMA_VERSION_V2 } from "../types/projectV2";
import { DEFAULT_NAV_MAP_VIEWPORT } from "../types/navigationMap";
import { DEFAULT_STATE_BOARD_META } from "../types/stateBoard";
import { DEFAULT_WORKSPACE_MODE } from "../types/mode";
import { DEFAULT_ZOOM_LEVEL } from "../types/zoomLevel";
import { DEFAULT_CANVAS_SNAP, DEFAULT_PROJECT_NAME } from "../types/project";
import { makeBoardId, makeId, ID_PREFIX } from "../types/idPrefixes";
import { syncSectionIndexes, makeSectionId, getScreenScopeId, ensureScreenRootForScope, makeScreenRootId } from "../stateBoard/sectionModel";
import { createDefaultUserStyleTokens } from "../../constants/styleTokenPresets";

interface CreateEmptyProjectOptions {
  projectName?: string;
  // Override the IDs so deterministic fixtures / tests stay stable. When
  // omitted, fresh IDs are minted with the standard prefix helpers.
  stateNodeId?: string;
  variantId?: string;
  rootWidgetId?: string;
  now?: () => string;
}

export function createEmptyProjectV2(options: CreateEmptyProjectOptions = {}): ProjectSnapshotV2 {
  const now = options.now ?? (() => new Date().toISOString());
  const createdAt = now();

  const stateNodeId = options.stateNodeId ?? makeId(ID_PREFIX.stateNode);
  const boardId = makeBoardId(stateNodeId);
  const variantId = options.variantId ?? makeId(ID_PREFIX.variant);
  const rootWidgetId = options.rootWidgetId ?? "screen-1-root";
  const stateNode: StateNode = {
    id: stateNodeId,
    name: "State1",
    position: { x: 0, y: 0 },
    boardId,
    isNavigationState: true,
  };
  const screenId = getScreenScopeId(stateNode);
  const screenRootId = makeScreenRootId(screenId);
  const sectionId = makeSectionId(variantId);

  const rootWidget: WidgetNode = {
    id: rootWidgetId,
    name: "Screen1",
    type: "Screen",
    parentId: null,
    childrenIds: [],
    x: 0,
    y: 0,
    width: DEFAULT_STATE_BOARD_META.width,
    height: DEFAULT_STATE_BOARD_META.height,
    fill: DEFAULT_STATE_BOARD_META.fill,
    radius: 0,
    visible: true,
    frameRole: "canonical",
  };

  const navigationMap: NavigationMap = {
    stateNodes: { [stateNodeId]: stateNode },
    stateNodeOrder: [stateNodeId],
    transitions: {},
    transitionOrder: [],
    initialStateNodeId: stateNodeId,
    viewport: { ...DEFAULT_NAV_MAP_VIEWPORT },
  };

  const stateBoard: StateBoard = {
    id: boardId,
    stateNodeId,
    meta: { ...DEFAULT_STATE_BOARD_META },
    variantIds: [variantId],
    canonicalVariantId: variantId,
  };

  const variant: Variant = {
    id: variantId,
    boardId,
    name: "Canonical",
    status: "canonical",
    rootWidgetId,
    createdAt,
    updatedAt: createdAt,
  };

  const stateSectionNode: StateSectionNode = {
    id: sectionId,
    kind: "state_section",
    parentId: screenRootId,
    childrenIds: [rootWidgetId],
    screenId,
    stateId: variantId,
    name: "Canonical Section",
    sectionId,
    x: 0, y: 0,
    width: DEFAULT_STATE_BOARD_META.width,
    height: DEFAULT_STATE_BOARD_META.height,
    layoutMode: "auto",
  };

  const treeNodes: Record<string, TreeNode> = {
    ...ensureScreenRootForScope({}, screenId, sectionId),
    [sectionId]: stateSectionNode,
  };

  return syncSectionIndexes({
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION_V2,
    projectName: options.projectName?.trim() || DEFAULT_PROJECT_NAME,
    navigationMap,
    stateBoardsById: { [boardId]: stateBoard },
    variantsById: { [variantId]: variant },
    widgetsById: { [rootWidgetId]: rootWidget },
    treeNodesById: treeNodes,
    transitionEventBindings: {},
    screenGroups: {},
    screenGroupOrder: [],
    styleTokens: createDefaultUserStyleTokens(),
    assets: {},
    canvasSnap: { ...DEFAULT_CANVAS_SNAP },
    snapshots: [],
    workspaceMode: DEFAULT_WORKSPACE_MODE,
    zoomLevel: { ...DEFAULT_ZOOM_LEVEL },
    sectionsById: {},
    sectionOrderByScreenId: {},
    sectionIdByStateId: {},
    screenTreeByScreenId: {},
    screenIdByRootWidgetId: {},
  });
}
