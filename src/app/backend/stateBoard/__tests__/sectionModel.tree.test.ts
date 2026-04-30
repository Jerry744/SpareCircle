import { describe, it, expect } from "vitest";
import { createEmptyProjectV2 } from "../../validation/createEmptyProjectV2";
import { deriveSectionIndexes, makeScreenRootId, makeSectionId } from "../sectionModel";
import type { ProjectSnapshotV2, StateSectionNode, ScreenRootNode } from "../../types/projectV2";
import type { WidgetNode } from "../../types/widget";
import { parseProjectSnapshotV2 } from "../../validation/projectV2Parser";

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

describe("tree - createEmptyProjectV2", () => {
  it("produces a valid tree with ScreenRootNode and StateSectionNode", () => {
    const project = makeFixture();
    const screenRootId = makeScreenRootId("state-node-alpha");
    const root = project.treeNodesById?.[screenRootId];
    expect(root).toBeDefined();
    expect(root?.kind).toBe("screen_root");
    expect(root?.parentId).toBeNull();

    const sectionId = makeSectionId("variant-root");
    const section = project.treeNodesById?.[sectionId];
    expect(section).toBeDefined();
    expect(section?.kind).toBe("state_section");
    expect((section as StateSectionNode).screenId).toBe("state-node-alpha");
    expect((section as StateSectionNode).stateId).toBe("variant-root");
    expect((section as StateSectionNode).childrenIds).toContain("screen-root");
  });
});

describe("tree - deriveSectionIndexes", () => {
  it("derives sectionsById from treeNodesById", () => {
    const project = makeFixture();
    const sectionId = makeSectionId("variant-root");
    const projectWithoutOldSections: ProjectSnapshotV2 = {
      ...project,
      sectionsById: {},
      sectionOrderByScreenId: {},
      sectionIdByStateId: {},
      screenTreeByScreenId: {},
      screenIdByRootWidgetId: {},
    };
    const derived = deriveSectionIndexes(projectWithoutOldSections);
    expect(derived.sectionsById[sectionId]).toBeDefined();
    expect(derived.sectionsById[sectionId].draftNodeIds).toEqual([]);
    expect(derived.sectionIdByStateId["variant-root"]).toBe(sectionId);
    expect(derived.treeNodesById[sectionId]).toBeDefined();
  });

  it("preserves existing tree node data when tree is present", () => {
    const project = makeFixture();
    const sectionId = makeSectionId("variant-root");
    const modifiedTree = {
      ...project.treeNodesById,
      [sectionId]: {
        ...project.treeNodesById[sectionId] as StateSectionNode,
        name: "Custom Section Name",
      },
    };
    const modProject = { ...project, treeNodesById: modifiedTree };
    const derived = deriveSectionIndexes(modProject);
    expect(derived.sectionsById[sectionId].name).toBe("Custom Section Name");
  });
});

describe("tree - ScreenRootNode invariants", () => {
  it("each screen has exactly one ScreenRootNode", () => {
    const project = makeFixture();
    const screenRootId = makeScreenRootId("state-node-alpha");
    const roots = Object.values(project.treeNodesById ?? {}).filter((n) => n.kind === "screen_root");
    expect(roots.length).toBe(1);
    expect(roots[0].id).toBe(screenRootId);
  });

  it("StateSectionNode only hangs under ScreenRootNode", () => {
    const project = makeFixture();
    for (const node of Object.values(project.treeNodesById ?? {})) {
      if (node.kind === "state_section") {
        const parent = project.treeNodesById?.[node.parentId ?? ""];
        expect(parent?.kind).toBe("screen_root");
      }
    }
  });
});

describe("tree - parser requires treeNodesById", () => {
  it("rejects project without treeNodesById", () => {
    const result = parseProjectSnapshotV2({
      schemaVersion: 2,
      projectName: "test",
      navigationMap: { stateNodes: {}, stateNodeOrder: [], transitions: {}, transitionOrder: [], initialStateNodeId: "", viewport: { x: 0, y: 0, zoom: 1 } },
      stateBoardsById: {},
      variantsById: {},
      widgetsById: {},
      transitionEventBindings: {},
      screenGroups: {},
      screenGroupOrder: [],
      styleTokens: [],
      assets: {},
    });
    expect(result.ok).toBe(false);
  });
});
