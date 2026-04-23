// Read-only graph queries over the Navigation Map.
// Used by later modules (State Board resolver, auto-tidy layout, export
// checks) to avoid scattering traversal logic. Keep this file pure — no
// React, no reducer imports, no IO.

import type { NavigationMap, StateNode, Transition } from "../types/navigationMap";

export function getOutgoingTransitions(
  map: NavigationMap,
  stateNodeId: string,
): Transition[] {
  const result: Transition[] = [];
  for (const transitionId of map.transitionOrder) {
    const transition = map.transitions[transitionId];
    if (transition && transition.fromStateNodeId === stateNodeId) {
      result.push(transition);
    }
  }
  return result;
}

export function getIncomingTransitions(
  map: NavigationMap,
  stateNodeId: string,
): Transition[] {
  const result: Transition[] = [];
  for (const transitionId of map.transitionOrder) {
    const transition = map.transitions[transitionId];
    if (transition && transition.toStateNodeId === stateNodeId) {
      result.push(transition);
    }
  }
  return result;
}

export interface StateNodeNeighbors {
  inbound: StateNode[];
  outbound: StateNode[];
}

export function getNeighbors(map: NavigationMap, stateNodeId: string): StateNodeNeighbors {
  const inbound: StateNode[] = [];
  const outbound: StateNode[] = [];
  for (const transition of Object.values(map.transitions)) {
    if (transition.fromStateNodeId === stateNodeId) {
      const target = map.stateNodes[transition.toStateNodeId];
      if (target) outbound.push(target);
    } else if (transition.toStateNodeId === stateNodeId) {
      const source = map.stateNodes[transition.fromStateNodeId];
      if (source) inbound.push(source);
    }
  }
  return { inbound, outbound };
}

// Shortest path by edge count (BFS). Returns `null` when the destination is
// unreachable from the source. Used by cross-reference tooling and the
// state-board breadcrumb trail.
export function findShortestPath(
  map: NavigationMap,
  fromId: string,
  toId: string,
): string[] | null {
  if (!map.stateNodes[fromId] || !map.stateNodes[toId]) return null;
  if (fromId === toId) return [fromId];

  const queue: string[] = [fromId];
  const visited = new Set<string>([fromId]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const outgoing = getOutgoingTransitions(map, current);
    for (const transition of outgoing) {
      const next = transition.toStateNodeId;
      if (visited.has(next)) continue;
      visited.add(next);
      parent.set(next, current);
      if (next === toId) {
        const path: string[] = [next];
        let cursor = next;
        while (parent.has(cursor)) {
          cursor = parent.get(cursor) as string;
          path.unshift(cursor);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

// A state node is orphan when it has no incoming and no outgoing edges.
// Used by `09-export-check` to flag nodes that would be unreachable at
// runtime, and by the Navigation Map inspector to hint the user.
export function listOrphanStateNodes(map: NavigationMap): StateNode[] {
  const hasEdge = new Set<string>();
  for (const transition of Object.values(map.transitions)) {
    hasEdge.add(transition.fromStateNodeId);
    hasEdge.add(transition.toStateNodeId);
  }
  const orphans: StateNode[] = [];
  for (const id of map.stateNodeOrder) {
    if (hasEdge.has(id)) continue;
    const node = map.stateNodes[id];
    if (node) orphans.push(node);
  }
  return orphans;
}

export function isStateOrphan(map: NavigationMap, stateNodeId: string): boolean {
  if (!map.stateNodes[stateNodeId]) return false;
  for (const transition of Object.values(map.transitions)) {
    if (
      transition.fromStateNodeId === stateNodeId ||
      transition.toStateNodeId === stateNodeId
    ) {
      return false;
    }
  }
  return true;
}
