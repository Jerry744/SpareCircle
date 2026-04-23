import { describe, expect, it } from "vitest";
import { buildWidgetTree } from "../tree";
import { createEmptyProjectV2 } from "../validation";
import { resolveWidgetDropTarget } from "../../components/canvasViewport/dropTarget";
import { resolveStateBoardWidgetDropTarget } from "../../components/stateBoard/stateBoardDrop";
import type { ProjectSnapshotV2 } from "../types/projectV2";
import type { WidgetNode } from "../types/widget";

function makeBoardFixture(): ProjectSnapshotV2 {
  const base = createEmptyProjectV2({
    stateNodeId: "state-node-alpha",
    variantId: "variant-root",
    rootWidgetId: "screen-root",
    now: () => "2026-04-24T00:00:00.000Z",
  });

  return {
    ...base,
    stateBoardsById: {
      ...base.stateBoardsById,
      "board-alpha": {
        ...base.stateBoardsById["board-alpha"],
        variantIds: ["variant-root", "variant-draft"],
      },
    },
    variantsById: {
      ...base.variantsById,
      "variant-draft": {
        id: "variant-draft",
        boardId: "board-alpha",
        name: "Draft",
        status: "draft",
        rootWidgetId: "draft-root",
        createdAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
      },
    },
    widgetsById: {
      ...base.widgetsById,
      "screen-root": {
        ...base.widgetsById["screen-root"],
        x: 0,
        y: 0,
        childrenIds: ["panel-a"],
      },
      "panel-a": {
        id: "panel-a",
        name: "Panel A",
        type: "Panel",
        parentId: "screen-root",
        childrenIds: ["inner-button"],
        x: 20,
        y: 24,
        width: 180,
        height: 120,
        visible: true,
      } satisfies WidgetNode,
      "inner-button": {
        id: "inner-button",
        name: "Button",
        type: "Button",
        parentId: "panel-a",
        childrenIds: [],
        x: 16,
        y: 18,
        width: 96,
        height: 40,
        text: "Go",
        visible: true,
      } satisfies WidgetNode,
      "draft-root": {
        ...base.widgetsById["screen-root"],
        id: "draft-root",
        name: "Draft Root",
        x: 320,
        y: 40,
        childrenIds: [],
      },
    },
  };
}

describe("resolveWidgetDropTarget", () => {
  it("returns the deepest container hit in local screen space", () => {
    const project = makeBoardFixture();
    const rootTree = buildWidgetTree(project, "screen-root");
    const target = resolveWidgetDropTarget({
      rootTree,
      world: { x: 48, y: 52 },
    });
    expect(target).toEqual({
      rootWidgetId: "screen-root",
      parentId: "panel-a",
      localX: 28,
      localY: 28,
    });
  });
});

describe("resolveStateBoardWidgetDropTarget", () => {
  it("maps board coordinates into the correct Variant subtree and ignores blank space", () => {
    const project = makeBoardFixture();
    const board = project.stateBoardsById["board-alpha"];

    const canonicalHit = resolveStateBoardWidgetDropTarget({
      project,
      board,
      world: { x: 52, y: 58 },
    });
    expect(canonicalHit).toEqual({
      variantId: "variant-root",
      rootWidgetId: "screen-root",
      parentId: "panel-a",
      localX: 32,
      localY: 34,
    });

    const draftHit = resolveStateBoardWidgetDropTarget({
      project,
      board,
      world: { x: 360, y: 90 },
    });
    expect(draftHit).toEqual({
      variantId: "variant-draft",
      rootWidgetId: "draft-root",
      parentId: "draft-root",
      localX: 40,
      localY: 50,
    });

    expect(resolveStateBoardWidgetDropTarget({
      project,
      board,
      world: { x: 900, y: 900 },
    })).toBeNull();
  });

  it("falls back to the active variant root for board drops outside every screen and keeps negative local coords", () => {
    const project = makeBoardFixture();
    const board = project.stateBoardsById["board-alpha"];

    expect(resolveStateBoardWidgetDropTarget({
      project,
      board,
      world: { x: 280, y: -20 },
      fallbackVariantId: "variant-draft",
    })).toEqual({
      variantId: "variant-draft",
      rootWidgetId: "draft-root",
      parentId: "draft-root",
      localX: -40,
      localY: -60,
    });
  });
});
