// Pure helpers for `interactions.ts`. Kept separate so the dispatcher stays
// under the 300-line budget (02-navigation-map §4.7).

import type {
  NavigationMap,
  NavMapPoint,
} from "../../../backend/types/navigationMap";
import {
  makeNavMapSelection,
  type NavMapSelection,
} from "../../../backend/types/navMapSelection";
import { routeEdgePath } from "../../../backend/navigation/autoConnect";
import { getNodeRect } from "../../../backend/navigation/hitTest";

/** Updates the node part of a selection when a node is clicked. */
export function applyNodeSelection(
  current: NavMapSelection,
  nodeId: string,
  additive: boolean,
): NavMapSelection {
  if (!additive) {
    return current.nodeIds.includes(nodeId)
      ? current
      : makeNavMapSelection([nodeId], []);
  }
  const has = current.nodeIds.includes(nodeId);
  const nextNodes = has
    ? current.nodeIds.filter((id) => id !== nodeId)
    : [...current.nodeIds, nodeId];
  return makeNavMapSelection(nextNodes, current.transitionIds);
}

/** Adds/removes a transition id to/from the current selection. */
export function toggleTransition(
  current: NavMapSelection,
  transitionId: string,
): NavMapSelection {
  const has = current.transitionIds.includes(transitionId);
  const next = has
    ? current.transitionIds.filter((id) => id !== transitionId)
    : [...current.transitionIds, transitionId];
  return makeNavMapSelection(current.nodeIds, next);
}

/** Snapshots node positions so drag math can resolve relative deltas. */
export function capturePositions(
  map: NavigationMap,
  nodeIds: string[],
): Record<string, NavMapPoint> {
  const out: Record<string, NavMapPoint> = {};
  for (const id of nodeIds) {
    const n = map.stateNodes[id];
    if (n) out[id] = { x: n.position.x, y: n.position.y };
  }
  return out;
}

export interface MarqueePick {
  nodeIds: string[];
  transitionIds: string[];
}

/**
 * Picks nodes and transitions intersected by the marquee rectangle.
 * Transition intersection uses a coarse test: any polyline vertex inside
 * the rectangle counts, matching the fidelity of `hitTestNavMap` for edges.
 */
export function pickInMarquee(
  map: NavigationMap,
  a: NavMapPoint,
  b: NavMapPoint,
): MarqueePick {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);

  const nodeIds: string[] = [];
  for (const id of map.stateNodeOrder) {
    const node = map.stateNodes[id];
    if (!node) continue;
    const r = getNodeRect(node);
    if (
      r.x + r.width >= minX &&
      r.x <= maxX &&
      r.y + r.height >= minY &&
      r.y <= maxY
    ) {
      nodeIds.push(id);
    }
  }

  const transitionIds: string[] = [];
  for (const id of map.transitionOrder) {
    const t = map.transitions[id];
    if (!t) continue;
    const from = map.stateNodes[t.fromStateNodeId];
    const to = map.stateNodes[t.toStateNodeId];
    if (!from || !to) continue;
    for (const p of routeEdgePath(from, to, t.waypoints)) {
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
        transitionIds.push(id);
        break;
      }
    }
  }

  return { nodeIds, transitionIds };
}

/** Clamps `value` to `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
