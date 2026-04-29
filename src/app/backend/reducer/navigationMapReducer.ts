// Top-level Navigation Map reducer.
// Dispatches every `NavMapAction` to the per-domain handlers defined in
// `stateNodeReducer.ts` and `transitionReducer.ts`. Also owns the two
// map-level handlers (viewport persistence, auto-tidy). See
// `02-navigation-map.md` §4.5.

import type { ProjectSnapshotV2 } from "../types/projectV2";
import { autoTidy } from "../navigation/layout";
import { syncSectionIndexes } from "../stateBoard/sectionModel";
import type { NavMapAction } from "./navMapActions";
import {
  handleAssignStateNodeGroup,
  handleBatchMoveStateNodes,
  handleCreateStateNode,
  handleDeleteStateNodes,
  handleMoveStateNode,
  handleRenameStateNode,
  handleSetInitialState,
  handleSetStateNodeAppearance,
  handleToggleNavigationState,
} from "./stateNodeReducer";
import {
  handleCreateTransition,
  handleDeleteTransition,
  handleReverseTransition,
  handleUpdateTransitionLabel,
  handleUpdateTransitionWaypoints,
} from "./transitionReducer";

function syncIfChanged(project: ProjectSnapshotV2, next: ProjectSnapshotV2): ProjectSnapshotV2 {
  return next === project ? project : syncSectionIndexes(next);
}

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
      return syncIfChanged(project, handleCreateStateNode(project, action));
    case "renameStateNode":
      return handleRenameStateNode(project, action);
    case "moveStateNode":
      return handleMoveStateNode(project, action);
    case "batchMoveStateNodes":
      return handleBatchMoveStateNodes(project, action);
    case "setInitialState":
      return handleSetInitialState(project, action);
    case "assignStateNodeGroup":
      return syncIfChanged(project, handleAssignStateNodeGroup(project, action));
    case "toggleNavigationState":
      return handleToggleNavigationState(project, action);
    case "deleteStateNodes":
      return syncIfChanged(project, handleDeleteStateNodes(project, action));
    case "setStateNodeAppearance":
      return handleSetStateNodeAppearance(project, action);
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
      // Runtime fallback: React/devtools can occasionally feed stray
      // actions that bypass the static union. We preserve the invariant
      // "reducer always returns ProjectSnapshotV2" by returning the
      // current project unchanged. The explicit `never` assertion below
      // still surfaces missing cases at compile time.
      const _exhaustive: never = action;
      void _exhaustive;
      return project;
    }
  }
}
