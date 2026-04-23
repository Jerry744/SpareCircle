import { describe, expect, it } from "vitest";
import { createEmptyProjectV2 } from "../validation";
import { resolveBoardView } from "../stateBoard/boardResolver";
import {
  ensureCanonicalInvariant,
  pickFallbackCanonical,
} from "../stateBoard/variantHelpers";
import {
  countWidgetsPerBoard,
  listAllBoardsWithCanonical,
} from "../stateBoard/crossReference";

describe("resolveBoardView", () => {
  it("resolves canonical variant by default", () => {
    const project = createEmptyProjectV2({
      projectName: "phase3",
      stateNodeId: "state-node-a",
      variantId: "variant-a-root",
      rootWidgetId: "screen-a",
    });
    const view = resolveBoardView(project, "state-node-a");
    expect(view).not.toBeNull();
    expect(view?.variant.id).toBe("variant-a-root");
    expect(view?.rootWidget.id).toBe("screen-a");
  });

  it("returns null for missing variant", () => {
    const project = createEmptyProjectV2({
      projectName: "phase3",
      stateNodeId: "state-node-a",
      variantId: "variant-a-root",
      rootWidgetId: "screen-a",
    });
    expect(resolveBoardView(project, "state-node-a", "variant-missing")).toBeNull();
  });
});

describe("variantHelpers", () => {
  it("pickFallbackCanonical prefers canonical, then draft", () => {
    const project = createEmptyProjectV2({
      projectName: "phase3",
      stateNodeId: "state-node-a",
      variantId: "variant-a-root",
      rootWidgetId: "screen-a",
    });
    const board = Object.values(project.stateBoardsById)[0];
    const variants = board.variantIds
      .map((id) => project.variantsById[id])
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    expect(pickFallbackCanonical(board, variants)?.id).toBe("variant-a-root");
  });

  it("ensureCanonicalInvariant rewrites broken canonical id", () => {
    const project = createEmptyProjectV2({
      projectName: "phase3",
      stateNodeId: "state-node-a",
      variantId: "variant-a-root",
      rootWidgetId: "screen-a",
    });
    const boardId = Object.keys(project.stateBoardsById)[0];
    const broken = {
      ...project,
      stateBoardsById: {
        ...project.stateBoardsById,
        [boardId]: {
          ...project.stateBoardsById[boardId],
          canonicalVariantId: "variant-missing",
        },
      },
    };
    const repaired = ensureCanonicalInvariant(broken, boardId);
    expect(repaired.stateBoardsById[boardId].canonicalVariantId).toBe(
      "variant-a-root",
    );
  });
});

describe("crossReference", () => {
  it("lists canonical board views and counts widgets", () => {
    const project = createEmptyProjectV2({
      projectName: "phase3",
      stateNodeId: "state-node-a",
      variantId: "variant-a-root",
      rootWidgetId: "screen-a",
    });
    const list = listAllBoardsWithCanonical(project);
    expect(list).toHaveLength(1);
    expect(list[0].board.id).toBe("board-a");
    expect(countWidgetsPerBoard(project)["board-a"]).toBeGreaterThan(0);
  });
});
