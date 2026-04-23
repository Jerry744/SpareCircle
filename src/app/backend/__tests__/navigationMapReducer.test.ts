import { describe, expect, it } from "vitest";
import type { ProjectSnapshotV2 } from "../types/projectV2";
import type { NavMapAction } from "../reducer/navMapActions";
import { createEmptyProjectV2, parseProjectSnapshotV2, parseNavigationMap } from "../validation";
import { navigationMapReducer } from "../reducer/navigationMapReducer";

const NOW = "2026-04-23T10:00:00.000Z";

function makeFixture(): ProjectSnapshotV2 {
  return createEmptyProjectV2({
    stateNodeId: "state-node-alpha",
    variantId: "variant-root",
    rootWidgetId: "screen-1-root",
    now: () => NOW,
  });
}

function addNode(
  project: ProjectSnapshotV2,
  id: string,
  position = { x: 0, y: 0 },
  name?: string,
): ProjectSnapshotV2 {
  return navigationMapReducer(project, {
    type: "createStateNode",
    position,
    stateNodeId: `state-node-${id}`,
    boardId: `board-${id}`,
    variantId: `variant-${id}-root`,
    rootWidgetId: `${id}-root`,
    now: NOW,
    name,
  });
}

function addTransition(
  project: ProjectSnapshotV2,
  id: string,
  from: string,
  to: string,
): ProjectSnapshotV2 {
  return navigationMapReducer(project, {
    type: "createTransition",
    fromStateNodeId: from,
    toStateNodeId: to,
    transitionId: id,
  });
}

// Three nodes (alpha/beta/gamma), transitions alpha→beta and beta→gamma,
// one binding on transition-ab. Reused across cascade and transition tests.
function makeFixtureWithGraph(): ProjectSnapshotV2 {
  let project = makeFixture();
  project = addNode(project, "beta", { x: 200, y: 0 }, "Beta");
  project = addNode(project, "gamma", { x: 400, y: 0 }, "Gamma");
  project = addTransition(project, "transition-ab", "state-node-alpha", "state-node-beta");
  project = addTransition(project, "transition-bg", "state-node-beta", "state-node-gamma");
  return {
    ...project,
    transitionEventBindings: {
      "binding-ab": {
        id: "binding-ab",
        transitionId: "transition-ab",
        trigger: { kind: "system_event", eventType: "timer" },
        createdAt: NOW,
      },
    },
  };
}

describe("navigationMapReducer · state node CRUD", () => {
  it("createStateNode mints node+board+variant, extends order, and round-trips", () => {
    const next = addNode(makeFixture(), "new", { x: 100, y: 100 });
    expect(next.navigationMap.stateNodes["state-node-new"]).toBeDefined();
    expect(next.navigationMap.stateNodeOrder).toEqual(["state-node-alpha", "state-node-new"]);
    expect(next.stateBoardsById["board-new"]).toBeDefined();
    expect(next.variantsById["variant-new-root"].status).toBe("canonical");
    expect(next.widgetsById["new-root"]).toBeDefined();
    expect(parseProjectSnapshotV2(next).ok).toBe(true);
  });

  it("renameStateNode rejects empty input and dedupes collisions", () => {
    const project = makeFixture();
    const unchanged = navigationMapReducer(project, {
      type: "renameStateNode",
      stateNodeId: "state-node-alpha",
      name: "   ",
    });
    expect(unchanged).toBe(project);

    const withBeta = addNode(project, "beta", { x: 200, y: 0 }, "Alpha");
    const deduped = navigationMapReducer(withBeta, {
      type: "renameStateNode",
      stateNodeId: "state-node-beta",
      name: "State1",
    });
    expect(deduped.navigationMap.stateNodes["state-node-beta"].name).toBe("State1 2");
  });

  it("moveStateNode updates only the position field", () => {
    const project = makeFixture();
    const next = navigationMapReducer(project, {
      type: "moveStateNode",
      stateNodeId: "state-node-alpha",
      position: { x: 42, y: 42 },
    });
    const before = project.navigationMap.stateNodes["state-node-alpha"];
    const after = next.navigationMap.stateNodes["state-node-alpha"];
    expect(after.position).toEqual({ x: 42, y: 42 });
    expect({ ...after, position: before.position }).toEqual(before);
    expect(next.stateBoardsById).toBe(project.stateBoardsById);
    expect(next.variantsById).toBe(project.variantsById);
  });

  it("batchMoveStateNodes updates multiple positions in one pass", () => {
    const project = makeFixtureWithGraph();
    const next = navigationMapReducer(project, {
      type: "batchMoveStateNodes",
      updates: [
        { stateNodeId: "state-node-alpha", position: { x: 1, y: 2 } },
        { stateNodeId: "state-node-beta", position: { x: 3, y: 4 } },
      ],
    });
    expect(next.navigationMap.stateNodes["state-node-alpha"].position).toEqual({ x: 1, y: 2 });
    expect(next.navigationMap.stateNodes["state-node-beta"].position).toEqual({ x: 3, y: 4 });
    expect(next.navigationMap.stateNodes["state-node-gamma"]).toBe(
      project.navigationMap.stateNodes["state-node-gamma"],
    );
  });

  it("setInitialState updates the entry point but ignores unknown ids", () => {
    const project = makeFixtureWithGraph();
    const next = navigationMapReducer(project, { type: "setInitialState", stateNodeId: "state-node-beta" });
    expect(next.navigationMap.initialStateNodeId).toBe("state-node-beta");
    const ignored = navigationMapReducer(next, { type: "setInitialState", stateNodeId: "state-node-ghost" });
    expect(ignored).toBe(next);
  });

  it("toggleNavigationState flips the flag but refuses to demote the initial state", () => {
    const project = makeFixtureWithGraph();
    const toggled = navigationMapReducer(project, {
      type: "toggleNavigationState", stateNodeId: "state-node-beta", isNavigationState: false,
    });
    expect(toggled.navigationMap.stateNodes["state-node-beta"].isNavigationState).toBe(false);
    const guarded = navigationMapReducer(project, {
      type: "toggleNavigationState", stateNodeId: "state-node-alpha", isNavigationState: false,
    });
    expect(guarded).toBe(project);
  });

  it("assignStateNodeGroup adds and removes the node from screenGroups bidirectionally", () => {
    const withGroup: ProjectSnapshotV2 = {
      ...makeFixture(),
      screenGroups: {
        "screen-group-home": { id: "screen-group-home", name: "Home", color: "#ff0000", stateNodeIds: [] },
      },
      screenGroupOrder: ["screen-group-home"],
    };
    const assigned = navigationMapReducer(withGroup, {
      type: "assignStateNodeGroup",
      stateNodeId: "state-node-alpha",
      screenGroupId: "screen-group-home",
    });
    expect(assigned.navigationMap.stateNodes["state-node-alpha"].screenGroupId).toBe("screen-group-home");
    expect(assigned.screenGroups["screen-group-home"].stateNodeIds).toEqual(["state-node-alpha"]);

    const removed = navigationMapReducer(assigned, {
      type: "assignStateNodeGroup",
      stateNodeId: "state-node-alpha",
      screenGroupId: null,
    });
    expect(removed.navigationMap.stateNodes["state-node-alpha"].screenGroupId).toBeUndefined();
    expect(removed.screenGroups["screen-group-home"].stateNodeIds).toEqual([]);
  });
});

describe("navigationMapReducer · deleteStateNodes (INV-9)", () => {
  it("cascades across board, variants, widgets, transitions, bindings, and round-trips", () => {
    const project = makeFixtureWithGraph();
    const next = navigationMapReducer(project, {
      type: "deleteStateNodes",
      stateNodeIds: ["state-node-beta"],
    });
    expect(next.navigationMap.stateNodes["state-node-beta"]).toBeUndefined();
    expect(next.navigationMap.stateNodeOrder).not.toContain("state-node-beta");
    expect(next.stateBoardsById["board-beta"]).toBeUndefined();
    expect(next.variantsById["variant-beta-root"]).toBeUndefined();
    expect(next.widgetsById["beta-root"]).toBeUndefined();
    expect(next.navigationMap.transitions["transition-ab"]).toBeUndefined();
    expect(next.navigationMap.transitions["transition-bg"]).toBeUndefined();
    expect(next.navigationMap.transitionOrder).toEqual([]);
    expect(next.transitionEventBindings["binding-ab"]).toBeUndefined();
    expect(parseProjectSnapshotV2(next).ok).toBe(true);
  });

  it("refuses to empty the project when every remaining node is deleted", () => {
    const project = makeFixture();
    const result = navigationMapReducer(project, {
      type: "deleteStateNodes",
      stateNodeIds: ["state-node-alpha"],
    });
    expect(result).toBe(project);
  });

  it("reassigns initialStateNodeId when the current initial is deleted", () => {
    const project = makeFixtureWithGraph();
    const next = navigationMapReducer(project, {
      type: "deleteStateNodes",
      stateNodeIds: ["state-node-alpha"],
    });
    expect(next.navigationMap.stateNodes["state-node-alpha"]).toBeUndefined();
    expect(next.navigationMap.stateNodeOrder.length).toBeGreaterThan(0);
    expect(next.navigationMap.initialStateNodeId).toBe(next.navigationMap.stateNodeOrder[0]);
  });
});

describe("navigationMapReducer · transitions", () => {
  it("createTransition appends; rejects unknown endpoints, duplicates, and self-loops", () => {
    const project = makeFixtureWithGraph();
    const before = project.navigationMap.transitionOrder;
    const mk = (fromStateNodeId: string, toStateNodeId: string, transitionId?: string) =>
      navigationMapReducer(project, {
        type: "createTransition",
        fromStateNodeId,
        toStateNodeId,
        transitionId,
      });
    expect(mk("state-node-alpha", "state-node-ghost")).toBe(project);
    expect(mk("state-node-alpha", "state-node-beta")).toBe(project);
    expect(mk("state-node-alpha", "state-node-alpha")).toBe(project);

    const fresh = mk("state-node-gamma", "state-node-alpha", "transition-ga");
    expect(fresh.navigationMap.transitions["transition-ga"]).toBeDefined();
    expect(fresh.navigationMap.transitionOrder).toEqual([...before, "transition-ga"]);
  });

  it("deleteTransition removes the edge and purges attached bindings", () => {
    const project = makeFixtureWithGraph();
    const next = navigationMapReducer(project, {
      type: "deleteTransition",
      transitionId: "transition-ab",
    });
    expect(next.navigationMap.transitions["transition-ab"]).toBeUndefined();
    expect(next.navigationMap.transitionOrder).not.toContain("transition-ab");
    expect(next.transitionEventBindings["binding-ab"]).toBeUndefined();
  });

  it("updateTransitionLabel / updateTransitionWaypoints / reverseTransition each mutate only their target", () => {
    const project = makeFixtureWithGraph();
    const siblingBefore = project.navigationMap.transitions["transition-bg"];

    const labelled = navigationMapReducer(project, {
      type: "updateTransitionLabel", transitionId: "transition-ab", label: "Advance",
    });
    expect(labelled.navigationMap.transitions["transition-ab"].label).toBe("Advance");
    expect(labelled.navigationMap.transitions["transition-bg"]).toBe(siblingBefore);

    const waypoints = [{ x: 100, y: 50 }];
    const routed = navigationMapReducer(project, {
      type: "updateTransitionWaypoints", transitionId: "transition-ab", waypoints,
    });
    expect(routed.navigationMap.transitions["transition-ab"].waypoints).toEqual(waypoints);
    expect(routed.navigationMap.transitions["transition-ab"].label).toBeUndefined();

    const reversed = navigationMapReducer(project, {
      type: "reverseTransition", transitionId: "transition-ab",
    });
    const edge = reversed.navigationMap.transitions["transition-ab"];
    expect(edge.fromStateNodeId).toBe("state-node-beta");
    expect(edge.toStateNodeId).toBe("state-node-alpha");
    expect(reversed.transitionEventBindings).toBe(project.transitionEventBindings);
  });
});

describe("navigationMapReducer · viewport, tidy, unknown action", () => {
  it("setNavViewport updates navigationMap.viewport", () => {
    const next = navigationMapReducer(makeFixture(), {
      type: "setNavViewport",
      viewport: { x: 10, y: 20, zoom: 1.5 },
    });
    expect(next.navigationMap.viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
  });

  it("autoTidyNavMap parses cleanly and yields a new navigationMap reference", () => {
    const project = makeFixtureWithGraph();
    const next = navigationMapReducer(project, { type: "autoTidyNavMap" });
    expect(next.navigationMap).not.toBe(project.navigationMap);
    expect(parseNavigationMap(next.navigationMap).ok).toBe(true);
  });

  it("returns the same project reference for an unknown action type", () => {
    const project = makeFixture();
    const next = navigationMapReducer(project, { type: "bogus" } as unknown as NavMapAction);
    expect(next).toBe(project);
  });

  it("setStateNodeAppearance updates color and description; null clears them", () => {
    const base = addNode(makeFixture(), "beta", { x: 0, y: 0 }, "Beta");
    const withColor = navigationMapReducer(base, {
      type: "setStateNodeAppearance",
      stateNodeId: "state-node-beta",
      color: "#ff0066",
      description: "entry state",
    });
    expect(withColor.navigationMap.stateNodes["state-node-beta"].color).toBe("#ff0066");
    expect(withColor.navigationMap.stateNodes["state-node-beta"].description).toBe("entry state");
    const cleared = navigationMapReducer(withColor, {
      type: "setStateNodeAppearance",
      stateNodeId: "state-node-beta",
      color: null,
      description: null,
    });
    expect(cleared.navigationMap.stateNodes["state-node-beta"].color).toBeUndefined();
    expect(cleared.navigationMap.stateNodes["state-node-beta"].description).toBeUndefined();
  });
});
