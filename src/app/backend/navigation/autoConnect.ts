// Snap-to-port and edge-routing helpers for the Navigation Map.
// Corresponds to `dev-plan/interaction-design-framework/02-navigation-map.md`
// §4.4. Pure functions only — no React / reducer imports.

import type { NavMapPoint, NavigationMap, StateNode } from "../types/navigationMap";
import { getNodePortPosition } from "./hitTest";

export interface SnapHit {
  nodeId: string;
  port: "in" | "out";
}

const DEFAULT_SNAP_THRESHOLD_PX = 32;
const MIN_ROUTE_OFFSET = 24;
const SAME_BAND_VERTICAL_TOLERANCE = 8;

/**
 * Finds the nearest node port to `worldPoint` within `thresholdPx`,
 * excluding `excludeId`. Returns `null` when nothing is in range
 * (02-navigation-map §4.4).
 */
export function snapToNearestNode(
  map: NavigationMap,
  worldPoint: NavMapPoint,
  excludeId?: string,
  thresholdPx: number = DEFAULT_SNAP_THRESHOLD_PX,
): SnapHit | null {
  let best: SnapHit | null = null;
  let bestDistance = thresholdPx;
  for (const nodeId of map.stateNodeOrder) {
    if (nodeId === excludeId) continue;
    const node = map.stateNodes[nodeId];
    if (!node) continue;
    const candidate = closerPort(node, worldPoint);
    if (candidate.distance <= bestDistance) {
      bestDistance = candidate.distance;
      best = { nodeId: node.id, port: candidate.port };
    }
  }
  return best;
}

/**
 * Builds the polyline used to draw a transition. Returns `>=2` points.
 * Routing rules (02-navigation-map §4.4):
 *   - explicit waypoints → [outPort, ...waypoints, inPort]
 *   - same horizontal band (|Δy| ≤ 8px) → straight line
 *   - otherwise → 4-point S / C curve with horizontal stubs
 */
export function routeEdgePath(
  from: StateNode,
  to: StateNode,
  waypoints?: NavMapPoint[],
): NavMapPoint[] {
  const outPort = getNodePortPosition(from, "out");
  const inPort = getNodePortPosition(to, "in");

  if (waypoints && waypoints.length > 0) {
    return [outPort, ...waypoints.map(clonePoint), inPort];
  }

  if (Math.abs(outPort.y - inPort.y) <= SAME_BAND_VERTICAL_TOLERANCE) {
    return [outPort, inPort];
  }

  const dx = inPort.x - outPort.x;
  const offset = Math.max(MIN_ROUTE_OFFSET, Math.abs(dx) / 2);

  // Always extend outward from each port along its natural direction
  // (out port points right, in port points left). When `dx < 0` the two
  // stubs naturally form a C-shaped loop instead of crossing the nodes.
  return [
    outPort,
    { x: outPort.x + offset, y: outPort.y },
    { x: inPort.x - offset, y: inPort.y },
    inPort,
  ];
}

function closerPort(
  node: StateNode,
  worldPoint: NavMapPoint,
): { port: "in" | "out"; distance: number } {
  const inDistance = distanceBetween(worldPoint, getNodePortPosition(node, "in"));
  const outDistance = distanceBetween(worldPoint, getNodePortPosition(node, "out"));
  return inDistance <= outDistance
    ? { port: "in", distance: inDistance }
    : { port: "out", distance: outDistance };
}

function distanceBetween(a: NavMapPoint, b: NavMapPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clonePoint(p: NavMapPoint): NavMapPoint {
  return { x: p.x, y: p.y };
}
