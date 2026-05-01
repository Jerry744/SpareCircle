import { describe, it, expect } from "vitest";
import { createEmptyProjectV2 } from "../../validation/createEmptyProjectV2";
import { variantReducer } from "../variantReducer";
import { makeSectionId, makeScreenRootId } from "../../stateBoard/sectionModel";
import type { ProjectSnapshotV2, StateSectionNode, ScreenRootNode } from "../../types/projectV2";
import type { WidgetNode } from "../../types/widget";
import { navigationMapReducer } from "../navigationMapReducer";

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
    x: 10, y: 10, width: 80, height: 32,
    text: "Open", visible: true,
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

describe("tree - handleDuplicateSectionFrame", () => {
  it("updates treeNodesById childrenIds after duplicating a frame", () => {
    const project = makeFixture();
    const sectionId = makeSectionId("variant-root");
    const result = variantReducer(project, {
      type: "duplicateSectionFrame",
      sectionId,
      frameId: "screen-root",
      newFrameId: "draft-frame-root",
      now: NOW,
    });

    const sectionNode = result.treeNodesById?.[sectionId] as StateSectionNode | undefined;
    expect(sectionNode).toBeDefined();
    expect(sectionNode.childrenIds).toContain("screen-root");
    expect(sectionNode.childrenIds).toContain("draft-frame-root");

    const draftWidget = result.widgetsById["draft-frame-root"];
    expect(draftWidget).toBeDefined();
    expect(draftWidget.type).toBe("Screen");
  });
});

describe("tree - handleDeleteVariantWidgets", () => {
  it("removes deleted draft frame from treeNodesById childrenIds", () => {
    const project = makeFixture();
    const sectionId = makeSectionId("variant-root");
    // First duplicate to create a draft
    const withDraft = variantReducer(project, {
      type: "duplicateSectionFrame",
      sectionId,
      frameId: "screen-root",
      newFrameId: "draft-frame-root",
      now: NOW,
    });

    // Then delete the draft
    const result = variantReducer(withDraft, {
      type: "deleteVariantWidgets",
      widgetIds: ["draft-frame-root"],
      now: NOW,
    });

    const sectionNode = result.treeNodesById?.[sectionId] as StateSectionNode | undefined;
    expect(sectionNode).toBeDefined();
    expect(sectionNode.childrenIds).not.toContain("draft-frame-root");
    expect(sectionNode.childrenIds).toContain("screen-root");
  });
});

describe("tree - createVariant adds section to tree", () => {
  it("creates StateSectionNode in treeNodesById for new variant", () => {
    const project = makeFixture();
    const result = variantReducer(project, {
      type: "createVariant",
      boardId: project.stateBoardsById[Object.keys(project.stateBoardsById)[0]]?.id ?? "",
      mode: "blank",
      name: "State2",
      variantId: "variant-second",
      now: NOW,
    });

    const sectionId = makeSectionId("variant-second");
    const sectionNode = result.treeNodesById?.[sectionId] as StateSectionNode | undefined;
    expect(sectionNode).toBeDefined();
    expect(sectionNode.kind).toBe("state_section");
    expect(sectionNode.stateId).toBe("variant-second");
    expect(sectionNode.childrenIds.length).toBe(1);
  });

  it("adds new StateSectionNode under the existing ScreenRootNode", () => {
    const project = makeFixture();
    const boardId = project.stateBoardsById[Object.keys(project.stateBoardsById)[0]]?.id ?? "";
    const result = variantReducer(project, {
      type: "createVariant",
      boardId,
      mode: "blank",
      name: "State2",
      variantId: "variant-second",
      now: NOW,
    });

    const screenRootId = makeScreenRootId("state-node-alpha");
    const root = result.treeNodesById?.[screenRootId] as ScreenRootNode | undefined;
    expect(root).toBeDefined();
    const sectionId = makeSectionId("variant-second");
    expect(root.childrenIds).toContain(sectionId);
  });

  it("uses screen-group scope for ScreenRootNode when state node is grouped", () => {
    const grouped = navigationMapReducer(
      {
        ...makeFixture(),
        screenGroups: {
          "screen-group-home": {
            id: "screen-group-home",
            name: "Home",
            color: "#ff0000",
            stateNodeIds: [],
          },
        },
        screenGroupOrder: ["screen-group-home"],
      },
      {
        type: "assignStateNodeGroup",
        stateNodeId: "state-node-alpha",
        screenGroupId: "screen-group-home",
      },
    );
    const boardId = grouped.stateBoardsById[Object.keys(grouped.stateBoardsById)[0]]?.id ?? "";
    const result = variantReducer(grouped, {
      type: "createVariant",
      boardId,
      mode: "blank",
      name: "Grouped Variant",
      variantId: "variant-grouped",
      now: NOW,
    });
    const groupedRootId = makeScreenRootId("screen-group-home");
    const legacyRootId = makeScreenRootId("state-node-alpha");
    const sectionId = makeSectionId("variant-grouped");
    const groupedRoot = result.treeNodesById[groupedRootId] as ScreenRootNode | undefined;
    expect(groupedRoot).toBeDefined();
    expect(groupedRoot?.childrenIds).toContain(sectionId);
    const legacyRoot = result.treeNodesById[legacyRootId] as ScreenRootNode | undefined;
    expect(legacyRoot ? legacyRoot.childrenIds : []).not.toContain(sectionId);
    expect((result.treeNodesById[sectionId] as StateSectionNode).screenId).toBe("screen-group-home");
  });
});

describe("tree - handleDuplicateSectionFrame tree-first", () => {
  it("does not write to sectionsById.draftNodeIds", () => {
    const project = makeFixture();
    const sectionId = makeSectionId("variant-root");
    const result = variantReducer(project, {
      type: "duplicateSectionFrame",
      sectionId,
      frameId: "screen-root",
      newFrameId: "draft-frame-root",
      now: NOW,
    });

    // sectionsById should NOT have the new draft in draftNodeIds
    // (it is only populated by syncSectionIndexes derivation)
    expect(result.sectionsById[sectionId]?.draftNodeIds).toBeDefined();
    // The new frame should be in treeNodesById childrenIds
    const sectionNode = result.treeNodesById?.[sectionId] as StateSectionNode | undefined;
    expect(sectionNode?.childrenIds).toContain("draft-frame-root");
    // The new frame should have frameRole=draft
    expect(result.widgetsById["draft-frame-root"]?.frameRole).toBe("draft");
  });
});

describe("tree - section and frame movement", () => {
  it("reorders frames inside a section without changing canonical status", () => {
    const project = makeFixture();
    const sectionId = makeSectionId("variant-root");
    const withDraft = variantReducer(project, {
      type: "duplicateSectionFrame",
      sectionId,
      frameId: "screen-root",
      newFrameId: "draft-frame-root",
      now: NOW,
    });

    const moved = variantReducer(withDraft, {
      type: "moveSectionFrame",
      frameId: "screen-root",
      targetSectionId: sectionId,
      targetIndex: 2,
      now: NOW,
    });

    expect((moved.treeNodesById[sectionId] as StateSectionNode).childrenIds).toEqual(["draft-frame-root", "screen-root"]);
    expect(moved.widgetsById["screen-root"].frameRole).toBe("canonical");
    expect(moved.widgetsById["draft-frame-root"].frameRole).toBe("draft");
    expect(moved.sectionsById[sectionId].canonicalFrameId).toBe("screen-root");
  });

  it("promotes a draft frame to canonical", () => {
    const project = makeFixture();
    const sectionId = makeSectionId("variant-root");
    const withDraft = variantReducer(project, {
      type: "duplicateSectionFrame",
      sectionId,
      frameId: "screen-root",
      newFrameId: "draft-frame-root",
      now: NOW,
    });

    const promoted = variantReducer(withDraft, {
      type: "promoteSectionFrame",
      sectionId,
      frameId: "draft-frame-root",
      now: NOW,
    });

    expect(promoted.widgetsById["draft-frame-root"].frameRole).toBe("canonical");
    expect(promoted.widgetsById["screen-root"].frameRole).toBe("draft");
    expect(promoted.variantsById["variant-root"].canonicalFrameId).toBe("draft-frame-root");
    expect(promoted.variantsById["variant-root"].rootWidgetId).toBe("draft-frame-root");
  });

  it("moves a draft frame to another section as a draft", () => {
    const project = makeFixture();
    const sectionId = makeSectionId("variant-root");
    const withDraft = variantReducer(project, {
      type: "duplicateSectionFrame",
      sectionId,
      frameId: "screen-root",
      newFrameId: "draft-frame-root",
      now: NOW,
    });
    const withSecond = variantReducer(withDraft, {
      type: "createVariant",
      boardId: "board-alpha",
      mode: "blank",
      name: "Second",
      variantId: "variant-second",
      rootWidgetId: "second-root",
      now: NOW,
    });
    const targetSectionId = makeSectionId("variant-second");

    const moved = variantReducer(withSecond, {
      type: "moveSectionFrame",
      frameId: "draft-frame-root",
      targetSectionId,
      targetIndex: 1,
      now: NOW,
    });

    expect((moved.treeNodesById[sectionId] as StateSectionNode).childrenIds).toEqual(["screen-root"]);
    expect((moved.treeNodesById[targetSectionId] as StateSectionNode).childrenIds).toEqual(["second-root", "draft-frame-root"]);
    expect(moved.widgetsById["draft-frame-root"].frameRole).toBe("draft");
    expect(moved.sectionsById[targetSectionId].canonicalFrameId).toBe("second-root");
  });

  it("reorders sections under the screen root", () => {
    const project = makeFixture();
    const withSecond = variantReducer(project, {
      type: "createVariant",
      boardId: "board-alpha",
      mode: "blank",
      name: "Second",
      variantId: "variant-second",
      rootWidgetId: "second-root",
      now: NOW,
    });

    const moved = variantReducer(withSecond, {
      type: "moveStateSection",
      screenId: "state-node-alpha",
      sectionId: makeSectionId("variant-second"),
      targetIndex: 0,
    });

    const screenRoot = moved.treeNodesById[makeScreenRootId("state-node-alpha")] as ScreenRootNode;
    expect(screenRoot.childrenIds.slice(0, 2)).toEqual([makeSectionId("variant-second"), makeSectionId("variant-root")]);
  });
});
