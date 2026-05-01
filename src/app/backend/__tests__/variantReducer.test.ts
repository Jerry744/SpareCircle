import { describe, expect, it } from "vitest";
import { createEmptyProjectV2, parseProjectSnapshotV2 } from "../validation";
import { variantReducer } from "../reducer/variantReducer";
import { cloneVariant } from "../stateBoard/variantCloning";
import { reassignCanonicalAfterMutation } from "../stateBoard/variantHelpers";
import type { ProjectSnapshotV2, StateSectionNode } from "../types/projectV2";
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
    expect(blank.sectionsById["section-root"].canonicalFrameId).toBe("screen-root");
    expect(blank.sectionsById["section-blank"].canonicalFrameId).toBe("blank-root");
    expect(blank.sectionsById["section-blank"].draftNodeIds).toEqual([]);
    // Tree consistency: draftNodeIds matches tree children minus canonical
    const blankSection = blank.treeNodesById?.["section-blank"] as StateSectionNode | undefined;
    expect(blankSection).toBeDefined();
    expect(blankSection.childrenIds).toContain("blank-root");

    const copied = variantReducer(blank, {
      type: "duplicateVariant",
      variantId: "variant-root",
      variantIdOverride: "variant-copy",
      name: "Copy",
      now: NOW,
    });
    expect(copied.variantsById["variant-copy"].rootWidgetId).not.toBe("screen-root");
    expect(copied.sectionsById["section-copy"].canonicalFrameId).toBe(copied.variantsById["variant-copy"].rootWidgetId);
    // Tree consistency: duplicated variant gets a state_section node
    const copySection = copied.treeNodesById?.["section-copy"] as StateSectionNode | undefined;
    expect(copySection).toBeDefined();
    expect(copySection.childrenIds).toContain(copied.variantsById["variant-copy"].rootWidgetId);
    expect(parseProjectSnapshotV2(copied).ok).toBe(true);
  });

  it("keeps one section per board state and can mark that state canonical", () => {
    const project = variantReducer(makeFixture(), {
      type: "createVariant",
      boardId: "board-alpha",
      mode: "blank",
      name: "Draft",
      variantId: "variant-draft",
      rootWidgetId: "draft-root",
      now: NOW,
    });
    const rebound = variantReducer(project, {
      type: "bindCanonicalFrame",
      sectionId: "section-draft",
      canonicalFrameId: "draft-root",
      now: NOW,
    });
    expect(rebound.stateBoardsById["board-alpha"].canonicalVariantId).toBe("variant-draft");
    expect(rebound.sectionsById["section-draft"].canonicalFrameId).toBe("draft-root");
    expect(rebound.sectionsById["section-root"].canonicalFrameId).toBe("screen-root");

    const rejected = variantReducer(rebound, {
      type: "bindCanonicalFrame",
      sectionId: "section-draft",
      canonicalFrameId: "foreign-root",
      now: NOW,
    });
    expect(rejected).toBe(rebound);
    expect(parseProjectSnapshotV2(rebound).ok).toBe(true);
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

  it("moves screen frames and syncs resolution across every Variant root", () => {
    let project = variantReducer(makeFixture(), {
      type: "createVariant",
      boardId: "board-alpha",
      mode: "blank",
      name: "Draft",
      variantId: "variant-draft",
      rootWidgetId: "draft-root",
      now: NOW,
    });
    project = variantReducer(project, {
      type: "moveVariantScreen",
      variantId: "variant-draft",
      position: { x: 640, y: 40 },
      now: NOW,
    });
    expect(project.widgetsById["draft-root"].x).toBe(640);
    expect(project.widgetsById["draft-root"].y).toBe(40);

    const resized = variantReducer(project, {
      type: "setBoardResolution",
      boardId: "board-alpha",
      width: 800,
      height: 480,
      now: NOW,
    });
    expect(resized.stateBoardsById["board-alpha"].meta).toMatchObject({ width: 800, height: 480 });
    expect(resized.widgetsById["screen-root"]).toMatchObject({ width: 800, height: 480 });
    expect(resized.widgetsById["draft-root"]).toMatchObject({ width: 800, height: 480 });
    expect(parseProjectSnapshotV2(resized).ok).toBe(true);
  });

  it("moves and hides widgets inside the full state hierarchy without changing schema", () => {
    const base = makeFixture();
    const project = {
      ...base,
      widgetsById: {
        ...base.widgetsById,
        "screen-root": { ...base.widgetsById["screen-root"], childrenIds: ["panel-a", "button-a"] },
        "panel-a": {
          id: "panel-a",
          name: "Panel A",
          type: "Panel",
          parentId: "screen-root",
          childrenIds: [],
          x: 0,
          y: 0,
          width: 120,
          height: 80,
          visible: true,
        } satisfies WidgetNode,
        "button-a": { ...base.widgetsById["button-a"], parentId: "screen-root" },
      },
    };
    const moved = variantReducer(project, {
      type: "moveVariantWidget",
      widgetId: "button-a",
      targetParentId: "panel-a",
      targetIndex: 0,
      now: NOW,
    });
    expect(moved.widgetsById["button-a"].parentId).toBe("panel-a");
    expect(moved.widgetsById["panel-a"].childrenIds).toEqual(["button-a"]);
    expect(moved.widgetsById["screen-root"].childrenIds).toEqual(["panel-a"]);

    const hidden = variantReducer(moved, {
      type: "setVariantWidgetVisibility",
      widgetId: "button-a",
      visible: false,
      now: NOW,
    });
    expect(hidden.widgetsById["button-a"].visible).toBe(false);
    expect(parseProjectSnapshotV2(hidden).ok).toBe(true);
  });

  it("updates widget positions for canvas dragging and supports multi-select payloads", () => {
    const base = makeFixture();
    const project = {
      ...base,
      widgetsById: {
        ...base.widgetsById,
        "screen-root": { ...base.widgetsById["screen-root"], childrenIds: ["button-a", "button-b"] },
        "button-b": {
          id: "button-b",
          name: "Button B",
          type: "Button",
          parentId: "screen-root",
          childrenIds: [],
          x: 120,
          y: 24,
          width: 80,
          height: 32,
          text: "Next",
          visible: true,
        } satisfies WidgetNode,
      },
    };

    const moved = variantReducer(project, {
      type: "setVariantWidgetPositions",
      positions: {
        "button-a": { x: 18, y: 22 },
        "button-b": { x: 132, y: 36 },
      },
      now: NOW,
    });

    expect(moved.widgetsById["button-a"]).toMatchObject({ x: 18, y: 22 });
    expect(moved.widgetsById["button-b"]).toMatchObject({ x: 132, y: 36 });
    expect(parseProjectSnapshotV2(moved).ok).toBe(true);
  });

  it("duplicates selected widgets as one V2 reducer operation", () => {
    const project = makeFixture();
    const duplicated = variantReducer(project, {
      type: "duplicateVariantWidgets",
      variantId: "variant-root",
      widgetIds: ["button-a"],
      rootWidgetIds: ["button-copy"],
      offset: { x: 16, y: 16 },
      now: NOW,
    });

    expect(duplicated.widgetsById["button-copy"]).toMatchObject({
      parentId: "screen-root",
      type: "Button",
      x: 26,
      y: 26,
    });
    expect(duplicated.widgetsById["screen-root"].childrenIds).toEqual(["button-a", "button-copy"]);
    expect(parseProjectSnapshotV2(duplicated).ok).toBe(true);
  });

  it("inserts widgets into the targeted Variant subtree and rejects cross-variant parents", () => {
    const project = variantReducer(makeFixture(), {
      type: "createVariant",
      boardId: "board-alpha",
      mode: "blank",
      name: "Draft",
      variantId: "variant-draft",
      rootWidgetId: "draft-root",
      now: NOW,
    });

    const withPanel = {
      ...project,
      widgetsById: {
        ...project.widgetsById,
        "draft-root": { ...project.widgetsById["draft-root"], childrenIds: ["draft-panel"] },
        "draft-panel": {
          id: "draft-panel",
          name: "Draft Panel",
          type: "Panel",
          parentId: "draft-root",
          childrenIds: [],
          x: 40,
          y: 24,
          width: 200,
          height: 120,
          visible: true,
        } satisfies WidgetNode,
      },
    };

    const inserted = variantReducer(withPanel, {
      type: "insertVariantWidget",
      variantId: "variant-draft",
      parentId: "draft-panel",
      widgetType: "Button",
      position: { x: -18, y: 26 },
      widgetId: "draft-button",
      now: NOW,
    });
    expect(inserted.widgetsById["draft-panel"].childrenIds).toEqual(["draft-button"]);
    expect(inserted.widgetsById["draft-button"]).toMatchObject({
      parentId: "draft-panel",
      type: "Button",
      x: -18,
      y: 26,
    });

    const rejected = variantReducer(inserted, {
      type: "insertVariantWidget",
      variantId: "variant-draft",
      parentId: "screen-root",
      widgetType: "Label",
      position: { x: 10, y: 10 },
      widgetId: "bad-cross-variant",
      now: NOW,
    });
    expect(rejected).toBe(inserted);
    expect(parseProjectSnapshotV2(inserted).ok).toBe(true);
  });

  it("moves widgets across sections inside one StateBoard", () => {
    const project = variantReducer(makeFixture(), {
      type: "createVariant",
      boardId: "board-alpha",
      mode: "blank",
      name: "Draft",
      variantId: "variant-draft",
      rootWidgetId: "draft-root",
      now: NOW,
    });

    const moved = variantReducer(project, {
      type: "moveVariantWidget",
      widgetId: "button-a",
      targetParentId: "draft-root",
      targetIndex: 0,
      now: NOW,
    });

    expect(moved.widgetsById["button-a"].parentId).toBe("draft-root");
    expect(moved.widgetsById["screen-root"].childrenIds).toEqual([]);
    expect(moved.widgetsById["draft-root"].childrenIds).toEqual(["button-a"]);
    expect(parseProjectSnapshotV2(moved).ok).toBe(true);
  });

  it("duplicates a state frame inside the same section as a non-canonical draft frame", () => {
    const project = makeFixture();
    const duplicated = variantReducer(project, {
      type: "duplicateSectionFrame",
      sectionId: "section-root",
      frameId: "screen-root",
      newFrameId: "draft-frame-root",
      offset: { x: 40, y: 40 },
      now: NOW,
    });

    expect(duplicated.stateBoardsById["board-alpha"].canonicalVariantId).toBe("variant-root");
    expect(duplicated.variantsById["variant-root"].rootWidgetId).toBe("screen-root");
    expect(duplicated.sectionsById["section-root"].canonicalFrameId).toBe("screen-root");
    expect(duplicated.sectionsById["section-root"].draftNodeIds).toContain("draft-frame-root");
    // Tree: childrenIds must contain the new draft frame
    const dupSection = duplicated.treeNodesById?.["section-root"] as StateSectionNode | undefined;
    expect(dupSection).toBeDefined();
    expect(dupSection.childrenIds).toContain("draft-frame-root");
    expect(duplicated.widgetsById["draft-frame-root"]).toMatchObject({
      type: "Screen",
      parentId: null,
      x: 40,
      y: 40,
    });
    expect(parseProjectSnapshotV2(duplicated).ok).toBe(true);
  });

  it("moves widgets directly under a section as independent draft nodes", () => {
    const project = makeFixture();
    const moved = variantReducer(project, {
      type: "moveVariantWidget",
      widgetId: "button-a",
      targetParentId: "section-root",
      targetIndex: 0,
      now: NOW,
    });

    expect(moved.widgetsById["button-a"].parentId).toBeNull();
    expect(moved.widgetsById["screen-root"].childrenIds).toEqual([]);
    expect(moved.sectionsById["section-root"].draftNodeIds).toEqual(["button-a"]);
    // Tree consistency: widget moves under section root should appear in childrenIds
    const movedSection = moved.treeNodesById?.["section-root"] as StateSectionNode | undefined;
    expect(movedSection).toBeDefined();
    expect(movedSection.childrenIds).toContain("button-a");
    expect(parseProjectSnapshotV2(moved).ok).toBe(true);
  });

  it("deletes regular widgets and non-canonical draft frames", () => {
    const withDraftFrame = variantReducer(makeFixture(), {
      type: "duplicateSectionFrame",
      sectionId: "section-root",
      frameId: "screen-root",
      newFrameId: "draft-frame-root",
      offset: { x: 40, y: 40 },
      now: NOW,
    });
    const deletedDraft = variantReducer(withDraftFrame, {
      type: "deleteVariantWidgets",
      widgetIds: ["draft-frame-root"],
      now: NOW,
    });
    expect(deletedDraft.widgetsById["draft-frame-root"]).toBeUndefined();
    expect(deletedDraft.sectionsById["section-root"].draftNodeIds).not.toContain("draft-frame-root");
    // Tree consistency: deleted draft removed from childrenIds
    const deletedSection = deletedDraft.treeNodesById?.["section-root"] as StateSectionNode | undefined;
    expect(deletedSection).toBeDefined();
    expect(deletedSection.childrenIds).not.toContain("draft-frame-root");
    expect(parseProjectSnapshotV2(deletedDraft).ok).toBe(true);

    const deletedWidget = variantReducer(makeFixture(), {
      type: "deleteVariantWidgets",
      widgetIds: ["button-a"],
      now: NOW,
    });
    expect(deletedWidget.widgetsById["button-a"]).toBeUndefined();
    expect(deletedWidget.widgetsById["screen-root"].childrenIds).toEqual([]);
    expect(parseProjectSnapshotV2(deletedWidget).ok).toBe(true);
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
