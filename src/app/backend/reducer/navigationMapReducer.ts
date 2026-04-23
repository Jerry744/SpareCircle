// Top-level Navigation Map reducer.
// Dispatches every `NavMapAction` to the per-domain handlers defined in
// `stateNodeReducer.ts` and `transitionReducer.ts`. Also owns the two
// map-level handlers (viewport persistence, auto-tidy). See
// `02-navigation-map.md` §4.5.

import type { ProjectSnapshotV2 } from "../types/projectV2";
import { autoTidy } from "../navigation/layout";
import type { NavMapAction } from "./navMapActions";
import {
  handleAssignStateNodeGroup,
  handleBatchMoveStateNodes,
  handleCreateStateNode,
  handleDeleteStateNodes,
  handleMoveStateNode,
  handleRenameStateNode,
  handleSetInitialState,
  handleToggleNavigationState,
} from "./stateNodeReducer";
import {
  handleCreateTransition,
  handleDeleteTransition,
  handleReverseTransition,
  handleUpdateTransitionLabel,
  handleUpdateTransitionWaypoints,
} from "./transitionReducer";

export function handleSetNavViewport(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "setNavViewport" }>,
): ProjectSnapshotV2 {
  const current = project.navigationMap.viewport;
  const { x, y, zoom } = action.viewport;
  if (current.x === x && current.y === y && current.zoom === zoom) return project;
  return {
    ...project,
    navigationMap: { ...project.navigationMap, viewport: { x, y, zoom } },
  };
}

export function handleAutoTidyNavMap(
  project: ProjectSnapshotV2,
  _action: Extract<NavMapAction, { type: "autoTidyNavMap" }>,
): ProjectSnapshotV2 {
  const nextMap = autoTidy(project.navigationMap);
  if (nextMap === project.navigationMap) return project;
  return { ...project, navigationMap: nextMap };
}

export function navigationMapReducer(
  project: ProjectSnapshotV2,
  action: NavMapAction,
): ProjectSnapshotV2 {
  switch (action.type) {
    case "createStateNode":
      return handleCreateStateNode(project, action);
    case "renameStateNode":
      return handleRenameStateNode(project, action);
    case "moveStateNode":
      return handleMoveStateNode(project, action);
    case "batchMoveStateNodes":
      return handleBatchMoveStateNodes(project, action);
    case "setInitialState":
      return handleSetInitialState(project, action);
    case "assignStateNodeGroup":
      return handleAssignStateNodeGroup(project, action);
    case "toggleNavigationState":
      return handleToggleNavigationState(project, action);
    case "deleteStateNodes":
      return handleDeleteStateNodes(project, action);
    case "createTransition":
      return handleCreateTransition(project, action);
    case "deleteTransition":
      return handleDeleteTransition(project, action);
    case "updateTransitionLabel":
      return handleUpdateTransitionLabel(project, action);
    case "updateTransitionWaypoints":
      return handleUpdateTransitionWaypoints(project, action);
    case "reverseTransition":
      return handleReverseTransition(project, action);
    case "setNavViewport":
      return handleSetNavViewport(project, action);
    case "autoTidyNavMap":
      return handleAutoTidyNavMap(project, action);
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
