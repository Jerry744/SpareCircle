// Transition CRUD handlers for v2 Navigation Map.
// Implements the handler list in `02-navigation-map.md` §4.5. Functions are
// pure `(ProjectSnapshotV2, action) => ProjectSnapshotV2`. Maintains INV-5
// (transition endpoints exist) and INV-6 (bindings point at a live
// Transition) as described in `01-data-model.md` §4.

import type { Transition } from "../types/navigationMap";
import type { TransitionEventBinding } from "../types/eventBinding";
import type { ProjectSnapshotV2 } from "../types/projectV2";
import { ID_PREFIX, makeId } from "../types/idPrefixes";
import type { NavMapAction } from "./navMapActions";

function hasTransitionBetween(
  project: ProjectSnapshotV2,
  fromStateNodeId: string,
  toStateNodeId: string,
): boolean {
  for (const t of Object.values(project.navigationMap.transitions)) {
    if (t.fromStateNodeId === fromStateNodeId && t.toStateNodeId === toStateNodeId) {
      return true;
    }
  }
  return false;
}

export function handleCreateTransition(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "createTransition" }>,
): ProjectSnapshotV2 {
  // Reject unknown endpoints, self-loops, and duplicate pairs silently so
  // that fast double-clicks / drag-release fuzz cannot corrupt the graph.
  if (action.fromStateNodeId === action.toStateNodeId) return project;
  if (!project.navigationMap.stateNodes[action.fromStateNodeId]) return project;
  if (!project.navigationMap.stateNodes[action.toStateNodeId]) return project;
  if (hasTransitionBetween(project, action.fromStateNodeId, action.toStateNodeId)) return project;

  const transitionId = action.transitionId ?? makeId(ID_PREFIX.transition);
  if (project.navigationMap.transitions[transitionId]) return project;

  const transition: Transition = {
    id: transitionId,
    fromStateNodeId: action.fromStateNodeId,
    toStateNodeId: action.toStateNodeId,
    ...(action.label ? { label: action.label } : {}),
    ...(action.waypoints ? { waypoints: action.waypoints.map((p) => ({ ...p })) } : {}),
  };

  return {
    ...project,
    navigationMap: {
      ...project.navigationMap,
      transitions: { ...project.navigationMap.transitions, [transitionId]: transition },
      transitionOrder: [...project.navigationMap.transitionOrder, transitionId],
    },
  };
}

export function handleDeleteTransition(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "deleteTransition" }>,
): ProjectSnapshotV2 {
  if (!project.navigationMap.transitions[action.transitionId]) return project;

  const nextTransitions: Record<string, Transition> = {};
  for (const [id, t] of Object.entries(project.navigationMap.transitions)) {
    if (id !== action.transitionId) nextTransitions[id] = t;
  }
  const nextOrder = project.navigationMap.transitionOrder.filter(
    (id) => id !== action.transitionId,
  );

  // INV-6 maintenance: purge any bindings that referenced the dead edge.
  const nextBindings: Record<string, TransitionEventBinding> = {};
  let bindingsChanged = false;
  for (const [id, b] of Object.entries(project.transitionEventBindings)) {
    if (b.transitionId === action.transitionId) {
      bindingsChanged = true;
    } else {
      nextBindings[id] = b;
    }
  }

  return {
    ...project,
    navigationMap: {
      ...project.navigationMap,
      transitions: nextTransitions,
      transitionOrder: nextOrder,
    },
    transitionEventBindings: bindingsChanged ? nextBindings : project.transitionEventBindings,
  };
}

export function handleUpdateTransitionLabel(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "updateTransitionLabel" }>,
): ProjectSnapshotV2 {
  const transition = project.navigationMap.transitions[action.transitionId];
  if (!transition) return project;
  const trimmed = action.label?.trim();
  const nextLabel = trimmed && trimmed.length > 0 ? trimmed : undefined;
  if ((transition.label ?? undefined) === nextLabel) return project;

  const nextTransition: Transition = { ...transition };
  if (nextLabel) nextTransition.label = nextLabel;
  else delete nextTransition.label;

  return {
    ...project,
    navigationMap: {
      ...project.navigationMap,
      transitions: {
        ...project.navigationMap.transitions,
        [action.transitionId]: nextTransition,
      },
    },
  };
}

export function handleUpdateTransitionWaypoints(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "updateTransitionWaypoints" }>,
): ProjectSnapshotV2 {
  const transition = project.navigationMap.transitions[action.transitionId];
  if (!transition) return project;

  const cloned = action.waypoints.map((p) => ({ x: p.x, y: p.y }));
  const nextTransition: Transition = { ...transition };
  if (cloned.length === 0) delete nextTransition.waypoints;
  else nextTransition.waypoints = cloned;

  return {
    ...project,
    navigationMap: {
      ...project.navigationMap,
      transitions: {
        ...project.navigationMap.transitions,
        [action.transitionId]: nextTransition,
      },
    },
  };
}

export function handleReverseTransition(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "reverseTransition" }>,
): ProjectSnapshotV2 {
  const transition = project.navigationMap.transitions[action.transitionId];
  if (!transition) return project;
  // Avoid colliding with an existing edge after the swap. Duplicates stay
  // forbidden (see `handleCreateTransition`).
  if (
    hasTransitionBetween(project, transition.toStateNodeId, transition.fromStateNodeId)
  ) {
    return project;
  }

  const reversed: Transition = {
    ...transition,
    fromStateNodeId: transition.toStateNodeId,
    toStateNodeId: transition.fromStateNodeId,
    // Reverse waypoints so the curve flows with the new direction.
    ...(transition.waypoints
      ? { waypoints: [...transition.waypoints].reverse().map((p) => ({ ...p })) }
      : {}),
  };

  return {
    ...project,
    navigationMap: {
      ...project.navigationMap,
      transitions: {
        ...project.navigationMap.transitions,
        [action.transitionId]: reversed,
      },
    },
  };
}
