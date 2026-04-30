import type { ProjectSnapshotCore, Section, StateSection, TreeNode, ScreenRootNode, StateSectionNode } from "../types/projectV2";
import type { StateNode } from "../types/navigationMap";
import { ID_PREFIX, makeId } from "../types/idPrefixes";

export function makeSectionId(stateId: string): string {
  return stateId.startsWith("variant-")
    ? `section-${stateId.slice("variant-".length)}`
    : stateId.startsWith("state-node-")
      ? `section-${stateId.slice("state-node-".length)}`
    : `section-${stateId}`;
}

export function makeScreenRootId(screenId: string): string {
  return `${ID_PREFIX.screenRoot}-${screenId}`;
}

export function getScreenIdForStateNode(stateNode: StateNode): string {
  return stateNode.screenGroupId ?? stateNode.id;
}

/** Resolve a node ID from treeNodesById first, then widgetsById. */
export function resolveTreeNode<T extends ProjectSnapshotCore>(project: T, nodeId: string): TreeNode | undefined {
  return project.treeNodesById?.[nodeId];
}

/** Get the ScreenRootNode for a screenId, if it exists. */
export function getScreenRootNode<T extends ProjectSnapshotCore>(project: T, screenId: string): ScreenRootNode | undefined {
  const id = makeScreenRootId(screenId);
  const node = project.treeNodesById?.[id];
  return node?.kind === "screen_root" ? (node as ScreenRootNode) : undefined;
}

/** Get the canonical + draft frame root widget IDs for a StateSection. */
export function getStateSectionFrameBuckets<T extends ProjectSnapshotCore>(
  project: T,
  stateSectionId: string,
): { canonical: string | undefined; draft: string[] } {
  const section = project.treeNodesById?.[stateSectionId];
  if (!section || section.kind !== "state_section") return { canonical: undefined, draft: [] };
  const stateSection = section as StateSectionNode;
  const children = stateSection.childrenIds;
  const canonical = children.find((childId) => project.widgetsById[childId]?.frameRole === "canonical");
  const draft = children.filter((childId) => project.widgetsById[childId]?.frameRole === "draft");
  return { canonical, draft };
}

export function deriveSectionIndexes<T extends ProjectSnapshotCore>(project: T): Pick<
  ProjectSnapshotCore,
  "sectionsById" | "sectionOrderByScreenId" | "sectionIdByStateId" | "screenTreeByScreenId" | "screenIdByRootWidgetId" | "treeNodesById"
> {
  const sectionsById: Record<string, Section> = {};
  const sectionOrderByScreenId: Record<string, string[]> = {};
  const sectionIdByStateId: Record<string, string> = {};
  const screenTreeByScreenId: Record<string, { rootWidgetIds: string[] }> = {};
  const screenIdByRootWidgetId: Record<string, string> = {};
  const treeNodesById: Record<string, TreeNode> = {};
  const screenRootIds = new Set<string>();

  // Phase 1: walk the nav map to ensure every variant has a section entry.
  // Populate treeNodesById for any variant that doesn't already have one.
  let order = 0;
  project.navigationMap.stateNodeOrder.forEach((stateNodeId) => {
    const stateNode = project.navigationMap.stateNodes[stateNodeId];
    if (!stateNode) return;
    const board = project.stateBoardsById[stateNode.boardId];
    if (!board) return;
    const screenId = getScreenIdForStateNode(stateNode);
    const screenRootId = makeScreenRootId(screenId);
    screenRootIds.add(screenRootId);

    for (const variantId of board.variantIds) {
      const variant = project.variantsById[variantId];
      if (!variant) continue;
      const sectionId = makeSectionId(variant.id);
      const existingSection = project.sectionsById?.[sectionId];
      const existingTreeNode = project.treeNodesById?.[sectionId];

      // If tree node already exists for this section, keep it as source of truth
      // but merge draft IDs from sectionsById (handlers still write to sectionsById).
      if (existingTreeNode?.kind === "state_section") {
        const stateSection = existingTreeNode as StateSectionNode;
        const storedDraftIds = existingSection?.draftNodeIds ?? [];
        const treeDraftIds = stateSection.childrenIds.filter(
          (cid) => cid !== variant.rootWidgetId && Boolean(project.widgetsById[cid]),
        );
        // Use sectionsById draft list as primary when it has entries that exist,
        // falling back to tree childrenIds for backward compat.
        const draftNodeIds = storedDraftIds.length > 0
          ? storedDraftIds.filter((nid) => nid !== variant.rootWidgetId && Boolean(project.widgetsById[nid]))
          : treeDraftIds;
        sectionsById[sectionId] = {
          id: sectionId,
          screenId: stateSection.screenId,
          stateId: stateSection.stateId,
          name: stateSection.name,
          canonicalFrameId: variant.rootWidgetId,
          draftNodeIds,
          order,
        };
        treeNodesById[sectionId] = stateSection;
      } else {
        // Create new tree node from variant/section data
        const draftNodeIds = (existingSection?.draftNodeIds ?? []).filter(
          (nodeId) => nodeId !== variant.rootWidgetId && Boolean(project.widgetsById[nodeId]),
        );
        sectionsById[sectionId] = {
          id: sectionId,
          screenId,
          stateId: variant.id,
          name: existingSection?.name?.trim() || `${variant.name} Section`,
          canonicalFrameId: variant.rootWidgetId,
          draftNodeIds,
          order,
        };
        treeNodesById[sectionId] = {
          id: sectionId,
          kind: "state_section",
          parentId: screenRootId,
          childrenIds: [variant.rootWidgetId, ...draftNodeIds],
          screenId,
          stateId: variant.id,
          name: sectionsById[sectionId].name,
          sectionId,
          x: 0, y: 0, width: 320, height: 480,
          layoutMode: "auto",
        } as StateSectionNode;
      }

      sectionIdByStateId[variant.id] = sectionId;
      sectionOrderByScreenId[screenId] = [...(sectionOrderByScreenId[screenId] ?? []), sectionId];

      const section = sectionsById[sectionId];
      const draftScreenRootIds = section.draftNodeIds.filter(
        (nodeId) => project.widgetsById[nodeId]?.type === "Screen",
      );
      screenTreeByScreenId[screenId] = {
        rootWidgetIds: [...(screenTreeByScreenId[screenId]?.rootWidgetIds ?? []), variant.rootWidgetId, ...draftScreenRootIds],
      };
      screenIdByRootWidgetId[variant.rootWidgetId] = screenId;
      for (const rootWidgetId of draftScreenRootIds) screenIdByRootWidgetId[rootWidgetId] = screenId;
      order += 1;
    }
  });

  // Phase 2: create ScreenRootNodes
  for (const screenRootId of screenRootIds) {
    const existingRoot = project.treeNodesById?.[screenRootId];
    const childIds = Object.values(treeNodesById)
      .filter((n): n is StateSectionNode => n.kind === "state_section" && n.parentId === screenRootId)
      .map((n) => n.id);

    treeNodesById[screenRootId] = existingRoot?.kind === "screen_root"
      ? (existingRoot as ScreenRootNode)
      : {
          id: screenRootId,
          kind: "screen_root",
          parentId: null,
          childrenIds: childIds,
        } as ScreenRootNode;
  }

  return {
    sectionsById,
    sectionOrderByScreenId,
    sectionIdByStateId,
    screenTreeByScreenId,
    screenIdByRootWidgetId,
    treeNodesById,
  };
}

export function syncSectionIndexes<T extends ProjectSnapshotCore>(project: T): T {
  return {
    ...project,
    ...deriveSectionIndexes(project),
  };
}
