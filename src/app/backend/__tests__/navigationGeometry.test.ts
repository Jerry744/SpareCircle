import { describe, expect, it } from "vitest";
import type { NavigationMap, StateNode } from "../types/navigationMap";
import { createEmptyProjectV2 } from "../validation";
import {
  NAV_MAP_DEFAULT_NODE_SIZE,
  getNodePortPosition,
  getNodeRect,
  hitTestNavMap,
} from "../navigation/hitTest";
import { autoTidy, computeNodeInitialPosition } from "../navigation/layout";
import { routeEdgePath, snapToNearestNode } from "../navigation/autoConnect";

function makeNode(overrides: Partial<StateNode> = {}): StateNode {
  return {
    id: "state-node-sample",
    name: "Sample",
    position: { x: 0, y: 0 },
    boardId: "board-sample",
    isNavigationState: true,
    ...overrides,
  };
}

function makeMap(nodes: StateNode[]): NavigationMap {
  const stateNodes: Record<string, StateNode> = {};
  for (const n of nodes) stateNodes[n.id] = n;
  return {
    stateNodes,
    stateNodeOrder: nodes.map((n) => n.id),
    transitions: {},
    transitionOrder: [],
    initialStateNodeId: nodes[0]?.id ?? "",
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

type Rect = { x: number; y: number; width: number; height: number };
function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe("getNodeRect / getNodePortPosition", () => {
  const node = makeNode({ position: { x: 10, y: 20 } });

  it("returns a rect anchored at node.position with the default size", () => {
    expect(getNodeRect(node)).toEqual({
      x: 10,
      y: 20,
      width: NAV_MAP_DEFAULT_NODE_SIZE.width,
      height: NAV_MAP_DEFAULT_NODE_SIZE.height,
    });
  });

  it("places ports at the left / right edge midpoints", () => {
    const rect = getNodeRect(node);
    expect(getNodePortPosition(node, "in")).toEqual({ x: rect.x, y: rect.y + rect.height / 2 });
    expect(getNodePortPosition(node, "out")).toEqual({
      x: rect.x + rect.width,
      y: rect.y + rect.height / 2,
    });
  });
});

describe("hitTestNavMap", () => {
  const node = makeNode({ id: "state-node-a", position: { x: 0, y: 0 } });
  const map = makeMap([node]);

  it("classifies a click on each port area as edge_handle with the right handle id", () => {
    const outHit = hitTestNavMap(map, getNodePortPosition(node, "out"), 1);
    expect(outHit).toMatchObject({ kind: "edge_handle", nodeId: "state-node-a", handle: "port_out" });
    const inHit = hitTestNavMap(map, getNodePortPosition(node, "in"), 1);
    expect(inHit).toMatchObject({ kind: "edge_handle", nodeId: "state-node-a", handle: "port_in" });
  });

  it("classifies a click inside the rect but off the ports as a node hit", () => {
    const rect = getNodeRect(node);
    const hit = hitTestNavMap(map, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, 1);
    expect(hit).toMatchObject({ kind: "node", nodeId: "state-node-a" });
  });

  it("returns empty when the click lands far from any node", () => {
    expect(hitTestNavMap(map, { x: 10_000, y: 10_000 }, 1).kind).toBe("empty");
  });
});

describe("computeNodeInitialPosition", () => {
  it("returns a non-overlapping seed when two existing nodes overlap it", () => {
    const a = makeNode({ id: "state-node-a", position: { x: 0, y: 0 } });
    const b = makeNode({ id: "state-node-b", position: { x: 16, y: 16 } });
    const result = computeNodeInitialPosition(makeMap([a, b]), { x: 0, y: 0 });
    const candidate: Rect = {
      x: result.x,
      y: result.y,
      width: NAV_MAP_DEFAULT_NODE_SIZE.width,
      height: NAV_MAP_DEFAULT_NODE_SIZE.height,
    };
    for (const existing of [a, b]) {
      expect(rectsOverlap(candidate, getNodeRect(existing))).toBe(false);
    }
  });
});

describe("autoTidy", () => {
  it("returns a new map, preserves every id, and keeps y>=0 with initial state at y=0", () => {
    const project = createEmptyProjectV2({
      stateNodeId: "state-node-alpha",
      variantId: "variant-root",
      rootWidgetId: "screen-1-root",
      now: () => "2026-04-23T10:00:00.000Z",
    });
    const nav = project.navigationMap;
    nav.stateNodes["state-node-beta"] = makeNode({
      id: "state-node-beta",
      position: { x: 999, y: -500 },
      boardId: "board-beta",
    });
    nav.stateNodeOrder.push("state-node-beta");
    nav.transitions["transition-ab"] = {
      id: "transition-ab",
      fromStateNodeId: "state-node-alpha",
      toStateNodeId: "state-node-beta",
    };
    nav.transitionOrder.push("transition-ab");

    const tidied = autoTidy(nav);
    expect(tidied).not.toBe(nav);
    expect(new Set(Object.keys(tidied.stateNodes))).toEqual(new Set(Object.keys(nav.stateNodes)));
    for (const id of Object.keys(tidied.stateNodes)) {
      expect(tidied.stateNodes[id].position.y).toBeGreaterThanOrEqual(0);
    }
    expect(tidied.stateNodes["state-node-alpha"].position.y).toBe(0);
  });
});

describe("routeEdgePath", () => {
  const from = makeNode({ id: "state-node-a", position: { x: 0, y: 0 } });

  it("produces a 2-point straight line in the same horizontal band", () => {
    const to = makeNode({ id: "state-node-b", position: { x: 400, y: 0 } });
    const path = routeEdgePath(from, to, undefined);
    expect(path).toHaveLength(2);
    expect(path[0]).toEqual(getNodePortPosition(from, "out"));
    expect(path[1]).toEqual(getNodePortPosition(to, "in"));
  });

  it("produces a 3+ point path across bands, bookended by the correct ports", () => {
    const to = makeNode({ id: "state-node-b", position: { x: 400, y: 300 } });
    const path = routeEdgePath(from, to, undefined);
    expect(path.length).toBeGreaterThanOrEqual(3);
    expect(path[0]).toEqual(getNodePortPosition(from, "out"));
    expect(path[path.length - 1]).toEqual(getNodePortPosition(to, "in"));
  });

  it("injects explicit waypoints between out-port and in-port", () => {
    const to = makeNode({ id: "state-node-b", position: { x: 400, y: 0 } });
    const waypoints = [
      { x: 100, y: 50 },
      { x: 200, y: -50 },
    ];
    const path = routeEdgePath(from, to, waypoints);
    expect(path).toHaveLength(waypoints.length + 2);
    expect(path[0]).toEqual(getNodePortPosition(from, "out"));
    expect(path.slice(1, -1)).toEqual(waypoints);
    expect(path[path.length - 1]).toEqual(getNodePortPosition(to, "in"));
  });
});

describe("snapToNearestNode", () => {
  const node = makeNode({ id: "state-node-a", position: { x: 0, y: 0 } });
  const map = makeMap([node]);
  const inPort = getNodePortPosition(node, "in");
  const nearProbe = { x: inPort.x + 2, y: inPort.y + 2 };

  it("snaps to the nearest in-port when within threshold", () => {
    expect(snapToNearestNode(map, nearProbe)).toEqual({ nodeId: "state-node-a", port: "in" });
  });

  it("returns null when no port is within threshold", () => {
    expect(snapToNearestNode(map, { x: 10_000, y: 10_000 })).toBeNull();
  });

  it("returns null when the only candidate is excluded", () => {
    expect(snapToNearestNode(map, nearProbe, "state-node-a")).toBeNull();
  });
});
