// Pure geometric hit-testing over the Navigation Map.
// Corresponds to `dev-plan/interaction-design-framework/02-navigation-map.md`
// §4.2. Keep this module free of React / reducer / IO — it is consumed by
// both the canvas interaction layer and the domain test suite.

import type { NavMapPoint, NavigationMap, StateNode, Transition } from "../types/navigationMap";
import { routeEdgePath } from "./autoConnect";

export const NAV_MAP_DEFAULT_NODE_SIZE: { width: number; height: number } = {
  width: 160,
  height: 72,
};
export const NAV_MAP_PORT_RADIUS = 6;
export const NAV_MAP_EDGE_HIT_THRESHOLD_PX = 6;

export interface NavMapHit {
  kind: "node" | "edge" | "edge_handle" | "empty";
  nodeId?: string;
  transitionId?: string;
  handle?: "port_out" | "port_in" | "waypoint" | "end";
  waypointIndex?: number;
}

export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Returns the world-space rectangle occupied by `node`. Node size is fixed
 * to `NAV_MAP_DEFAULT_NODE_SIZE` for now (02-navigation-map §4.2).
 */
export function getNodeRect(node: StateNode): NodeRect {
  return {
    x: node.position.x,
    y: node.position.y,
    width: NAV_MAP_DEFAULT_NODE_SIZE.width,
    height: NAV_MAP_DEFAULT_NODE_SIZE.height,
  };
}

/**
 * World-space port position. `out` is the right edge midpoint, `in` is the
 * left edge midpoint (02-navigation-map §4.2).
 */
export function getNodePortPosition(node: StateNode, port: "in" | "out"): NavMapPoint {
  const rect = getNodeRect(node);
  return {
    x: port === "out" ? rect.x + rect.width : rect.x,
    y: rect.y + rect.height / 2,
  };
}

/**
 * Classifies a world-space pointer against the Navigation Map.
 * Priority: port > node > waypoint > edge-path > empty (02-navigation-map §4.2).
 */
export function hitTestNavMap(
  map: NavigationMap,
  worldPoint: NavMapPoint,
  zoom: number,
): NavMapHit {
  const effectiveZoom = zoom > 0 ? zoom : 1;
  const portRadius = NAV_MAP_PORT_RADIUS / effectiveZoom;
  const edgeThreshold = NAV_MAP_EDGE_HIT_THRESHOLD_PX / effectiveZoom;

  return (
    findPortHit(map, worldPoint, portRadius) ??
    findNodeHit(map, worldPoint) ??
    findWaypointHit(map, worldPoint, portRadius) ??
    findEdgeHit(map, worldPoint, edgeThreshold) ?? { kind: "empty" }
  );
}

function findPortHit(
  map: NavigationMap,
  worldPoint: NavMapPoint,
  radius: number,
): NavMapHit | null {
  for (let i = map.stateNodeOrder.length - 1; i >= 0; i -= 1) {
    const node = map.stateNodes[map.stateNodeOrder[i]];
    if (!node) continue;
    if (pointWithinRadius(worldPoint, getNodePortPosition(node, "out"), radius)) {
      return { kind: "edge_handle", nodeId: node.id, handle: "port_out" };
    }
    if (pointWithinRadius(worldPoint, getNodePortPosition(node, "in"), radius)) {
      return { kind: "edge_handle", nodeId: node.id, handle: "port_in" };
    }
  }
  return null;
}

function findNodeHit(map: NavigationMap, worldPoint: NavMapPoint): NavMapHit | null {
  for (let i = map.stateNodeOrder.length - 1; i >= 0; i -= 1) {
    const node = map.stateNodes[map.stateNodeOrder[i]];
    if (node && pointInRect(worldPoint, getNodeRect(node))) {
      return { kind: "node", nodeId: node.id };
    }
  }
  return null;
}

function findWaypointHit(
  map: NavigationMap,
  worldPoint: NavMapPoint,
  radius: number,
): NavMapHit | null {
  for (let i = map.transitionOrder.length - 1; i >= 0; i -= 1) {
    const transition = map.transitions[map.transitionOrder[i]];
    if (!transition || !transition.waypoints) continue;
    for (let w = 0; w < transition.waypoints.length; w += 1) {
      if (pointWithinRadius(worldPoint, transition.waypoints[w], radius)) {
        return {
          kind: "edge_handle",
          transitionId: transition.id,
          handle: "waypoint",
          waypointIndex: w,
        };
      }
    }
  }
  return null;
}

function findEdgeHit(
  map: NavigationMap,
  worldPoint: NavMapPoint,
  threshold: number,
): NavMapHit | null {
  for (let i = map.transitionOrder.length - 1; i >= 0; i -= 1) {
    const transition = map.transitions[map.transitionOrder[i]];
    if (!transition) continue;
    const polyline = polylineForTransition(map, transition);
    if (polyline && distanceToPolyline(worldPoint, polyline) <= threshold) {
      return { kind: "edge", transitionId: transition.id };
    }
  }
  return null;
}

function polylineForTransition(
  map: NavigationMap,
  transition: Transition,
): NavMapPoint[] | null {
  const from = map.stateNodes[transition.fromStateNodeId];
  const to = map.stateNodes[transition.toStateNodeId];
  if (!from || !to) return null;
  return routeEdgePath(from, to, transition.waypoints);
}

function pointWithinRadius(p: NavMapPoint, center: NavMapPoint, radius: number): boolean {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return dx * dx + dy * dy <= radius * radius;
}

function pointInRect(p: NavMapPoint, rect: NodeRect): boolean {
  return (
    p.x >= rect.x &&
    p.x <= rect.x + rect.width &&
    p.y >= rect.y &&
    p.y <= rect.y + rect.height
  );
}

function distanceToPolyline(p: NavMapPoint, polyline: NavMapPoint[]): number {
  if (polyline.length === 0) return Number.POSITIVE_INFINITY;
  if (polyline.length === 1) {
    return Math.hypot(p.x - polyline[0].x, p.y - polyline[0].y);
  }
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const d = distanceToSegment(p, polyline[i], polyline[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

function distanceToSegment(p: NavMapPoint, a: NavMapPoint, b: NavMapPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq;
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + clamped * abx), p.y - (a.y + clamped * aby));
}
