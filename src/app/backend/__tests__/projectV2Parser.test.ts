import { describe, expect, it } from "vitest";
import {
  createEmptyProjectV2,
  parseNavigationMap,
  parseProjectSnapshotV2,
  parseStateBoard,
  parseVariant,
  parseTransitionEventBinding,
  parseScreenGroup,
} from "../validation";
import { runProjectV2CrossRefChecks } from "../validation";
import type { ProjectSnapshotV2 } from "../types/projectV2";
import { CURRENT_PROJECT_SCHEMA_VERSION_V2 } from "../types/projectV2";
import {
  getIncomingTransitions,
  getOutgoingTransitions,
  isStateOrphan,
  listOrphanStateNodes,
  findShortestPath,
} from "../navigation/graph";

// Helpers -------------------------------------------------------------------

function makeFixture(): ProjectSnapshotV2 {
  return createEmptyProjectV2({
    projectName: "fixture.lvproj",
    stateNodeId: "state-node-alpha",
    variantId: "variant-root",
    rootWidgetId: "screen-1-root",
    now: () => "2026-04-23T10:00:00.000Z",
  });
}

// Shape + factory -----------------------------------------------------------

describe("createEmptyProjectV2", () => {
  it("produces a v2 schema with one canonical variant and matching board", () => {
    const project = makeFixture();

    expect(project.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION_V2);
    expect(Object.keys(project.navigationMap.stateNodes)).toEqual(["state-node-alpha"]);
    expect(project.navigationMap.initialStateNodeId).toBe("state-node-alpha");
    const board = project.stateBoardsById["board-alpha"];
    expect(board).toBeDefined();
    expect(board.canonicalVariantId).toBe("variant-root");
    expect(project.variantsById["variant-root"].status).toBe("canonical");
    expect(project.widgetsById["screen-1-root"].type).toBe("Screen");
    expect(project.widgetsById["screen-1-root"].parentId).toBeNull();
    expect(project.sectionIdByStateId["variant-root"]).toBe("section-root");
    expect(project.sectionsById["section-root"].canonicalFrameId).toBe("screen-1-root");
    expect(project.screenTreeByScreenId["state-node-alpha"].rootWidgetIds).toEqual(["screen-1-root"]);
  });

  it("passes round-trip through parseProjectSnapshotV2", () => {
    const project = makeFixture();
    const result = parseProjectSnapshotV2(project);
    expect(result.ok).toBe(true);
  });

  it("migrates legacy v2 snapshots that do not contain sections", () => {
    const project = makeFixture();
    const legacy = { ...project } as Record<string, unknown>;
    delete legacy.sectionsById;
    delete legacy.sectionOrderByScreenId;
    delete legacy.sectionIdByStateId;
    delete legacy.screenTreeByScreenId;
    delete legacy.screenIdByRootWidgetId;
    const result = parseProjectSnapshotV2(legacy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sectionsById["section-root"].canonicalFrameId).toBe("screen-1-root");
    }
  });
});

// Navigation Map parser -----------------------------------------------------

describe("parseNavigationMap", () => {
  it("rejects a missing initialStateNodeId (INV-1)", () => {
    const project = makeFixture();
    const broken = {
      ...project.navigationMap,
      initialStateNodeId: "state-node-does-not-exist",
    };
    const result = parseNavigationMap(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/initialStateNodeId/);
  });

  it("rejects a transition whose endpoint is not a state node (INV-5)", () => {
    const project = makeFixture();
    const broken = {
      ...project.navigationMap,
      transitions: {
        "transition-a": {
          id: "transition-a",
          fromStateNodeId: "state-node-alpha",
          toStateNodeId: "state-node-ghost",
        },
      },
      transitionOrder: ["transition-a"],
    };
    const result = parseNavigationMap(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/toStateNodeId/);
  });
});

// StateBoard parser (INV-3 structural half) --------------------------------

describe("parseStateBoard", () => {
  it("requires canonicalVariantId to be in variantIds", () => {
    const result = parseStateBoard(
      {
        id: "board-alpha",
        stateNodeId: "state-node-alpha",
        meta: { width: 320, height: 240 },
        variantIds: ["variant-a"],
        canonicalVariantId: "variant-ghost",
      },
      "board",
    );
    expect(result.ok).toBe(false);
  });
});

// Variant parser ------------------------------------------------------------

describe("parseVariant", () => {
  it("rejects unknown status values", () => {
    const result = parseVariant(
      {
        id: "variant-1",
        boardId: "board-alpha",
        name: "Draft",
        status: "published",
        rootWidgetId: "screen-1-root",
        createdAt: "2026-04-23T10:00:00.000Z",
        updatedAt: "2026-04-23T10:00:00.000Z",
      },
      "variant",
    );
    expect(result.ok).toBe(false);
  });
});

// Transition event binding parser -------------------------------------------

describe("parseTransitionEventBinding", () => {
  it("accepts a valid widget_event trigger", () => {
    const result = parseTransitionEventBinding(
      {
        id: "binding-1",
        transitionId: "transition-1",
        trigger: { kind: "widget_event", widgetId: "Button1", eventType: "clicked" },
        createdAt: "2026-04-23T10:00:00.000Z",
      },
      "binding",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects unknown system event types", () => {
    const result = parseTransitionEventBinding(
      {
        id: "binding-1",
        transitionId: "transition-1",
        trigger: { kind: "system_event", eventType: "quantum_entanglement" },
        createdAt: "2026-04-23T10:00:00.000Z",
      },
      "binding",
    );
    expect(result.ok).toBe(false);
  });
});

// ScreenGroup parser --------------------------------------------------------

describe("parseScreenGroup", () => {
  it("rejects duplicate state node ids in membership", () => {
    const result = parseScreenGroup(
      {
        id: "screen-group-1",
        name: "Home",
        color: "#ff0000",
        stateNodeIds: ["state-node-alpha", "state-node-alpha"],
      },
      "group",
    );
    expect(result.ok).toBe(false);
  });
});

// Cross-reference invariants -----------------------------------------------

describe("runProjectV2CrossRefChecks", () => {
  it("flags INV-4 when a Variant rootWidget is not a Screen", () => {
    const project = makeFixture();
    project.widgetsById["screen-1-root"] = {
      ...project.widgetsById["screen-1-root"],
      type: "Label",
    };
    const result = runProjectV2CrossRefChecks(project);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Screen/);
  });

  it("flags duplicate or stale canonical section bindings", () => {
    const project = makeFixture();
    project.sectionsById["section-root"] = {
      ...project.sectionsById["section-root"],
      canonicalFrameId: "screen-ghost",
    };
    const result = runProjectV2CrossRefChecks(project);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/canonicalFrameId/);
  });

  it("flags Variant root resolution mismatches against the StateBoard", () => {
    const project = makeFixture();
    project.widgetsById["screen-1-root"] = {
      ...project.widgetsById["screen-1-root"],
      width: project.stateBoardsById["board-alpha"].meta.width + 1,
    };
    const result = runProjectV2CrossRefChecks(project);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/resolution/);
  });

  it("flags INV-8 when two bindings target the same Transition", () => {
    const project = makeFixture();
    const transitionId = "transition-demo";
    project.navigationMap.transitions[transitionId] = {
      id: transitionId,
      fromStateNodeId: "state-node-alpha",
      toStateNodeId: "state-node-alpha",
    };
    project.navigationMap.transitionOrder.push(transitionId);
    project.transitionEventBindings["binding-1"] = {
      id: "binding-1",
      transitionId,
      trigger: { kind: "system_event", eventType: "timer" },
      createdAt: "2026-04-23T10:00:00.000Z",
    };
    project.transitionEventBindings["binding-2"] = {
      id: "binding-2",
      transitionId,
      trigger: { kind: "system_event", eventType: "timer" },
      createdAt: "2026-04-23T10:00:00.000Z",
    };
    const result = runProjectV2CrossRefChecks(project);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/more than one EventBinding/);
  });

  it("flags inconsistent ScreenGroup membership", () => {
    const project = makeFixture();
    project.screenGroups["screen-group-1"] = {
      id: "screen-group-1",
      name: "Home",
      color: "#ff0000",
      stateNodeIds: ["state-node-alpha"],
    };
    project.screenGroupOrder.push("screen-group-1");
    // StateNode does NOT declare the group → cross-ref should complain.
    const result = runProjectV2CrossRefChecks(project);
    expect(result.ok).toBe(false);
  });
});

// navigation/graph helpers --------------------------------------------------

describe("navigation/graph", () => {
  it("resolves incoming/outgoing transitions and shortest paths", () => {
    const project = makeFixture();
    project.navigationMap.stateNodes["state-node-beta"] = {
      id: "state-node-beta",
      name: "Beta",
      position: { x: 200, y: 0 },
      boardId: "board-beta",
      isNavigationState: true,
    };
    project.navigationMap.stateNodeOrder.push("state-node-beta");
    project.navigationMap.transitions["transition-ab"] = {
      id: "transition-ab",
      fromStateNodeId: "state-node-alpha",
      toStateNodeId: "state-node-beta",
    };
    project.navigationMap.transitionOrder.push("transition-ab");

    expect(getOutgoingTransitions(project.navigationMap, "state-node-alpha")).toHaveLength(1);
    expect(getIncomingTransitions(project.navigationMap, "state-node-beta")).toHaveLength(1);
    expect(
      findShortestPath(project.navigationMap, "state-node-alpha", "state-node-beta"),
    ).toEqual(["state-node-alpha", "state-node-beta"]);
    expect(isStateOrphan(project.navigationMap, "state-node-beta")).toBe(false);
    expect(listOrphanStateNodes(project.navigationMap)).toHaveLength(0);
  });
});
