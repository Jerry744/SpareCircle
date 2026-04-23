import { describe, expect, it } from "vitest";
import { createEmptyProjectV2, parseProjectSnapshotV2 } from "../validation";
import { variantReducer } from "../reducer/variantReducer";
import { cloneVariant } from "../stateBoard/variantCloning";
import { reassignCanonicalAfterMutation } from "../stateBoard/variantHelpers";
import type { ProjectSnapshotV2 } from "../types/projectV2";
import type { WidgetNode } from "../types/widget";

const NOW = "2026-04-23T10:00:00.000Z";

function makeFixture(): ProjectSnapshotV2 {
  const project = createEmptyProjectV2({
    stateNodeId: "state-node-alpha",
    variantId: "variant-root",
    rootWidgetId: "screen-root",
    now: () => NOW,
  });
  const button: WidgetNode = {
    id: "button-a",
    name: "Button A",
    type: "Button",
    parentId: "screen-root",
    childrenIds: [],
    x: 10,
    y: 10,
    width: 80,
    height: 32,
    text: "Open",
    visible: true,
    eventBindings: {
      clicked: {
        event: "clicked",
        action: { type: "toggle_visibility", targetWidgetId: "button-a" },
      },
    },
  };
  return {
    ...project,
    widgetsById: {
      ...project.widgetsById,
      "screen-root": { ...project.widgetsById["screen-root"], childrenIds: ["button-a"] },
      "button-a": button,
    },
  };
}

describe("cloneVariant", () => {
  it("deep-clones a Variant subtree and rewrites widget-local references", () => {
    const result = cloneVariant({
      project: makeFixture(),
      sourceVariantId: "variant-root",
      newVariantId: "variant-copy",
      newVariantName: "Copy",
      idPrefix: "copy-root",
      now: NOW,
    });
    expect(result.newVariant.rootWidgetId).toBe("copy-root");
    const copiedButton = Object.values(result.newWidgets).find((widget) => widget.type === "Button");
    expect(copiedButton).toBeDefined();
    expect(copiedButton?.parentId).toBe("copy-root");
    expect(copiedButton?.eventBindings?.clicked?.action).toEqual({
      type: "toggle_visibility",
      targetWidgetId: copiedButton?.id,
    });
  });
});

describe("variantReducer", () => {
  it("creates blank and copied Variants while preserving canonical", () => {
    const project = makeFixture();
    const boardId = "board-alpha";
    const blank = variantReducer(project, {
      type: "createVariant",
      boardId,
      mode: "blank",
      name: "Blank",
      variantId: "variant-blank",
      rootWidgetId: "blank-root",
      now: NOW,
    });
    expect(blank.stateBoardsById[boardId].variantIds).toContain("variant-blank");
    expect(blank.variantsById["variant-blank"].status).toBe("draft");
    expect(blank.stateBoardsById[boardId].canonicalVariantId).toBe("variant-root");

    const copied = variantReducer(blank, {
      type: "duplicateVariant",
      variantId: "variant-root",
      variantIdOverride: "variant-copy",
      name: "Copy",
      now: NOW,
    });
    expect(copied.variantsById["variant-copy"].rootWidgetId).not.toBe("screen-root");
    expect(parseProjectSnapshotV2(copied).ok).toBe(true);
  });

  it("blocks deleting the final Variant and reassigns canonical on deletion", () => {
    const project = makeFixture();
    expect(variantReducer(project, { type: "deleteVariant", variantId: "variant-root" })).toBe(project);
    const boardId = "board-alpha";
    const withDraft = variantReducer(project, {
      type: "createVariant",
      boardId,
      mode: "blank",
      name: "Draft",
      variantId: "variant-draft",
      rootWidgetId: "draft-root",
      now: NOW,
    });
    const deleted = variantReducer(withDraft, { type: "deleteVariant", variantId: "variant-root" });
    expect(deleted.variantsById["variant-root"]).toBeUndefined();
    expect(deleted.stateBoardsById[boardId].canonicalVariantId).toBe("variant-draft");
    expect(parseProjectSnapshotV2(deleted).ok).toBe(true);
  });

  it("archives canonical by selecting the first non-archived Variant", () => {
    const project = variantReducer(makeFixture(), {
      type: "createVariant",
      boardId: "board-alpha",
      mode: "blank",
      name: "Draft",
      variantId: "variant-draft",
      rootWidgetId: "draft-root",
      now: NOW,
    });
    const archived = variantReducer(project, {
      type: "setVariantStatus",
      variantId: "variant-root",
      status: "archived",
      now: NOW,
    });
    expect(archived.stateBoardsById["board-alpha"].canonicalVariantId).toBe("variant-draft");
  });

  it("rejects invalid reorder payloads", () => {
    const project = makeFixture();
    const invalid = variantReducer(project, {
      type: "reorderVariants",
      boardId: "board-alpha",
      orderedIds: ["variant-root", "variant-root"],
    });
    expect(invalid).toBe(project);
  });
});

describe("reassignCanonicalAfterMutation", () => {
  it("falls back to archived only when no active Variant remains", () => {
    const project = makeFixture();
    const board = project.stateBoardsById["board-alpha"];
    const result = reassignCanonicalAfterMutation(board, [
      { ...project.variantsById["variant-root"], status: "archived" },
    ]);
    expect(result.canonicalVariantId).toBe("variant-root");
    expect(result.warning).toMatch(/No non-archived/);
  });
});
