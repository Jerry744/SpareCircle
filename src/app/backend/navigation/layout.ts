// Layout helpers for the Navigation Map: new-node placement and auto-tidy.
// Corresponds to `dev-plan/interaction-design-framework/02-navigation-map.md`
// §4.3. Pure, deterministic, non-mutating.

import type { NavMapPoint, NavigationMap, StateNode } from "../types/navigationMap";
import { getOutgoingTransitions } from "./graph";
import { NAV_MAP_DEFAULT_NODE_SIZE, getNodeRect } from "./hitTest";

const DEFAULT_PLACEMENT_STEP = 48;
const PLACEMENT_MAX_ATTEMPTS = 200;
const LAYER_VERTICAL_SPACING = 120;
const LAYER_HORIZONTAL_SPACING = 96;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Returns a non-overlapping seed position. Spirals around `seed` in steps
 * of `step` px, capped at 200 attempts with a hard fallback so callers
 * never loop forever (02-navigation-map §4.3).
 */
export function computeNodeInitialPosition(
  map: NavigationMap,
  seed: NavMapPoint,
  step: number = DEFAULT_PLACEMENT_STEP,
): NavMapPoint {
  const existing = collectNodeRects(map);
  if (!overlapsAny(seed, existing)) return { x: seed.x, y: seed.y };
  for (const offset of spiralOffsets(step, PLACEMENT_MAX_ATTEMPTS)) {
    const next: NavMapPoint = { x: seed.x + offset.x, y: seed.y + offset.y };
    if (!overlapsAny(next, existing)) return next;
  }
  return { x: seed.x + step * PLACEMENT_MAX_ATTEMPTS, y: seed.y };
}

/**
 * Returns a new NavigationMap with nodes arranged by BFS layering from
 * `initialStateNodeId`. Orphan (unreachable) nodes get an extra bottom
 * layer. Transitions, order arrays, initial id and viewport are preserved
 * byte-for-byte (02-navigation-map §4.3).
 */
export function autoTidy(map: NavigationMap): NavigationMap {
  const layers = orderLayersByBarycenter(map, buildLayers(map));
  const nextNodes: Record<string, StateNode> = {};
  const { width, height } = NAV_MAP_DEFAULT_NODE_SIZE;
  const rowStride = height + LAYER_VERTICAL_SPACING;
  const colStride = width + LAYER_HORIZONTAL_SPACING;

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx += 1) {
    const layer = layers[layerIdx];
    for (let i = 0; i < layer.length; i += 1) {
      const source = map.stateNodes[layer[i]];
      if (!source) continue;
      nextNodes[layer[i]] = {
        ...source,
        position: { x: i * colStride, y: layerIdx * rowStride },
      };
    }
  }
  for (const id of map.stateNodeOrder) {
    if (!nextNodes[id] && map.stateNodes[id]) {
      nextNodes[id] = { ...map.stateNodes[id] };
    }
  }

  return {
    ...map,
    stateNodes: nextNodes,
    stateNodeOrder: [...map.stateNodeOrder],
    transitions: { ...map.transitions },
    transitionOrder: [...map.transitionOrder],
    viewport: { ...map.viewport },
  };
}

function collectNodeRects(map: NavigationMap): Rect[] {
  const rects: Rect[] = [];
  for (const id of map.stateNodeOrder) {
    const node = map.stateNodes[id];
    if (node) rects.push(getNodeRect(node));
  }
  return rects;
}

function overlapsAny(origin: NavMapPoint, existing: Rect[]): boolean {
  const candidate: Rect = {
    x: origin.x,
    y: origin.y,
    width: NAV_MAP_DEFAULT_NODE_SIZE.width,
    height: NAV_MAP_DEFAULT_NODE_SIZE.height,
  };
  return existing.some((rect) => rectsOverlap(candidate, rect));
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// Outward square spiral: right, up, left×2, down×2, right×3, up×3, ...
function spiralOffsets(step: number, attempts: number): NavMapPoint[] {
  const offsets: NavMapPoint[] = [];
  let x = 0;
  let y = 0;
  let dx = 1;
  let dy = 0;
  let segment = 1;
  let stepsInSegment = 0;
  let segmentsAtLength = 0;
  while (offsets.length < attempts) {
    x += dx;
    y += dy;
    offsets.push({ x: x * step, y: y * step });
    stepsInSegment += 1;
    if (stepsInSegment === segment) {
      stepsInSegment = 0;
      [dx, dy] = [-dy, dx];
      segmentsAtLength += 1;
      if (segmentsAtLength === 2) {
        segmentsAtLength = 0;
        segment += 1;
      }
    }
  }
  return offsets;
}

function buildLayers(map: NavigationMap): string[][] {
  const visited = new Set<string>();
  const layers: string[][] = [];
  const root = map.initialStateNodeId;
  if (root && map.stateNodes[root]) {
    visited.add(root);
    layers.push([root]);
    let frontier: string[] = [root];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const nodeId of frontier) {
        for (const transition of getOutgoingTransitions(map, nodeId)) {
          const target = transition.toStateNodeId;
          if (visited.has(target) || !map.stateNodes[target]) continue;
          visited.add(target);
          next.push(target);
        }
      }
      if (next.length > 0) layers.push(next);
      frontier = next;
    }
  }
  const orphans = map.stateNodeOrder.filter(
    (id) => !visited.has(id) && map.stateNodes[id],
  );
  if (orphans.length > 0) layers.push(orphans);
  return layers;
}

function orderLayersByBarycenter(map: NavigationMap, layers: string[][]): string[][] {
  if (layers.length === 0) return layers;
  const result: string[][] = [layers[0].slice()];
  const xPositions = new Map<string, number>();
  layers[0].forEach((id, index) => xPositions.set(id, index));

  for (let i = 1; i < layers.length; i += 1) {
    const previous = result[i - 1];
    const scored = layers[i].map((id, fallbackIndex) => {
      const parents = previousLayerParents(map, id, previous);
      if (parents.length === 0) return { id, score: fallbackIndex };
      const sum = parents.reduce((acc, pid) => acc + (xPositions.get(pid) ?? 0), 0);
      return { id, score: sum / parents.length };
    });
    scored.sort((a, b) => a.score - b.score);
    const ordered = scored.map((entry) => entry.id);
    ordered.forEach((id, index) => xPositions.set(id, index));
    result.push(ordered);
  }
  return result;
}

function previousLayerParents(
  map: NavigationMap,
  nodeId: string,
  previousLayer: string[],
): string[] {
  const prevSet = new Set(previousLayer);
  const parents: string[] = [];
  for (const transition of Object.values(map.transitions)) {
    if (transition.toStateNodeId === nodeId && prevSet.has(transition.fromStateNodeId)) {
      parents.push(transition.fromStateNodeId);
    }
  }
  return parents;
}
