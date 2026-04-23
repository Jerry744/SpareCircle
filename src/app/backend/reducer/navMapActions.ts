// Navigation Map reducer action types.
// See `dev-plan/interaction-design-framework/02-navigation-map.md` §4.5.
// Actions here operate on `ProjectSnapshotV2` and will be wired into the
// live reducer by the Phase 6 migration. Do not import React/IO from here.

import type { NavMapPoint, NavMapViewport } from "../types/navigationMap";
import { makeNavMapSelection, type NavMapSelection } from "../types/navMapSelection";

export type NavMapAction =
  | {
      type: "createStateNode";
      position: NavMapPoint;
      name?: string;
      color?: string;
      isNavigationState?: boolean;
      // Optional overrides kept for deterministic fixtures / tests.
      stateNodeId?: string;
      boardId?: string;
      variantId?: string;
      rootWidgetId?: string;
      now?: string;
    }
  | { type: "renameStateNode"; stateNodeId: string; name: string }
  | { type: "moveStateNode"; stateNodeId: string; position: NavMapPoint }
  | {
      type: "batchMoveStateNodes";
      updates: Array<{ stateNodeId: string; position: NavMapPoint }>;
    }
  | { type: "setInitialState"; stateNodeId: string }
  | {
      type: "assignStateNodeGroup";
      stateNodeId: string;
      screenGroupId: string | null;
    }
  | {
      type: "toggleNavigationState";
      stateNodeId: string;
      isNavigationState: boolean;
    }
  | { type: "deleteStateNodes"; stateNodeIds: string[] }
  | {
      type: "createTransition";
      fromStateNodeId: string;
      toStateNodeId: string;
      waypoints?: NavMapPoint[];
      label?: string;
      transitionId?: string;
    }
  | { type: "deleteTransition"; transitionId: string }
  | {
      type: "updateTransitionLabel";
      transitionId: string;
      label: string | undefined;
    }
  | {
      type: "updateTransitionWaypoints";
      transitionId: string;
      waypoints: NavMapPoint[];
    }
  | { type: "reverseTransition"; transitionId: string }
  | { type: "setNavViewport"; viewport: NavMapViewport }
  | { type: "autoTidyNavMap" };

// Prune selection after cascade deletes. Used by both stateNodeReducer and
// transitionReducer so the two code paths stay in sync. A deleted id is
// silently dropped; the `kind` field is recomputed via `makeNavMapSelection`
// to avoid stale "node"/"transition"/"mixed" labels.
export function applyNavMapSelectionAfterDelete(
  selection: NavMapSelection,
  deletedNodeIds: Set<string>,
  deletedTransitionIds: Set<string>,
): NavMapSelection {
  const nextNodes = selection.nodeIds.filter((id) => !deletedNodeIds.has(id));
  const nextTransitions = selection.transitionIds.filter(
    (id) => !deletedTransitionIds.has(id),
  );
  if (
    nextNodes.length === selection.nodeIds.length &&
    nextTransitions.length === selection.transitionIds.length
  ) {
    return selection;
  }
  return makeNavMapSelection(nextNodes, nextTransitions);
}
