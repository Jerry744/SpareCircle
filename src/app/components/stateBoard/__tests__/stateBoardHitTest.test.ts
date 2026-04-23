import { describe, expect, it } from "vitest";
import { buildWidgetTree } from "../../../backend/tree";
import { createEmptyProjectV2 } from "../../../backend/validation";
import type { ProjectSnapshotV2 } from "../../../backend/types/projectV2";
import type { WidgetNode } from "../../../backend/types/widget";
import { filterTopLevelWidgetIds, getStateBoardWidgetHit } from "../stateBoardHitTest";

function makeProject(): ProjectSnapshotV2 {
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
        childrenIds: ["button-a"],
        x: 20,
        y: 24,
        width: 180,
        height: 120,
        visible: true,
      } satisfies WidgetNode,
      "button-a": {
        id: "button-a",
        name: "Button A",
        type: "Button",
        parentId: "panel-a",
        childrenIds: [],
        x: 16,
        y: 18,
        width: 96,
        height: 40,
        text: "Open",
        visible: true,
      } satisfies WidgetNode,
      "draft-root": {
        ...base.widgetsById["screen-root"],
        id: "draft-root",
        name: "Draft Root",
        x: 320,
        y: 0,
        childrenIds: ["draft-button"],
      },
      "draft-button": {
        id: "draft-button",
        name: "Draft Button",
        type: "Button",
        parentId: "draft-root",
        childrenIds: [],
        x: 30,
        y: 20,
        width: 90,
        height: 36,
        text: "Next",
        visible: true,
      } satisfies WidgetNode,
    },
  };
}

describe("stateBoardHitTest", () => {
  it("returns the topmost widget hit across variants and detects resize handles", () => {
    const project = makeProject();
    const rootTreesByVariant = {
      "variant-root": buildWidgetTree(project, "screen-root"),
      "variant-draft": buildWidgetTree(project, "draft-root"),
    };

    expect(getStateBoardWidgetHit(
      ["variant-root", "variant-draft"],
      rootTreesByVariant,
      [],
      { x: 42, y: 46 },
    )?.widget.id).toBe("button-a");

    const resizeHit = getStateBoardWidgetHit(
      ["variant-root", "variant-draft"],
      rootTreesByVariant,
      ["draft-button"],
      { x: 320 + 30 + 90 - 4, y: 20 + 36 - 4 },
    );
    expect(resizeHit?.variantId).toBe("variant-draft");
    expect(resizeHit?.mode).toBe("resize");
  });

  it("filters nested selections down to top-level draggable widgets", () => {
    const project = makeProject();
    expect(filterTopLevelWidgetIds(["panel-a", "button-a"], project.widgetsById)).toEqual(["panel-a"]);
    expect(filterTopLevelWidgetIds(["button-a", "draft-button"], project.widgetsById)).toEqual(["button-a", "draft-button"]);
  });
});
