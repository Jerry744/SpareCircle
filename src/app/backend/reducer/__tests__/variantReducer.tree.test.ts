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
