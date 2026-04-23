import { describe, expect, it } from "vitest";
import { buildWidgetTree } from "../../../backend/tree";
import { createEmptyProjectV2 } from "../../../backend/validation";
import type { ProjectSnapshotV2 } from "../../../backend/types/projectV2";
import type { WidgetNode } from "../../../backend/types/widget";
import { computeStateBoardMarqueeSelection } from "../stateBoardMarquee";
import { normalizeStateBoardSelection } from "../stateBoardSelection";

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
        childrenIds: ["button-a"],
      },
      "button-a": {
        id: "button-a",
        name: "Button A",
        type: "Button",
        parentId: "screen-root",
        childrenIds: [],
        x: 40,
        y: 40,
        width: 60,
        height: 30,
        text: "Open",
        visible: true,
      } satisfies WidgetNode,
      "draft-root": {
        ...base.widgetsById["screen-root"],
        id: "draft-root",
        x: 320,
        y: 0,
        childrenIds: [],
      },
    },
  };
}

describe("stateBoardMarquee", () => {
  it("captures screens and widgets together so callers can normalize into mixed selection", () => {
    const project = makeProject();
    const selection = computeStateBoardMarqueeSelection({
      variantIds: ["variant-root", "variant-draft"],
      frameById: {
        "variant-root": { x: 0, y: 0, width: 480, height: 320 },
        "variant-draft": { x: 320, y: 0, width: 480, height: 320 },
      },
      rootTreesByVariant: {
        "variant-root": buildWidgetTree(project, "screen-root"),
        "variant-draft": buildWidgetTree(project, "draft-root"),
      },
      marquee: {
        startWorld: { x: -10, y: -10 },
        currentWorld: { x: 500, y: 340 },
        additive: false,
      },
    });

    expect(normalizeStateBoardSelection(selection)).toEqual({
      kind: "mixed",
      variantIds: ["variant-root"],
      widgetIdsByVariant: {
        "variant-root": ["button-a"],
      },
    });
  });
});
