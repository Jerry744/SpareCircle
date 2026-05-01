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

export function getScreenScopeId(stateNode: StateNode): string {
  return stateNode.screenGroupId ?? stateNode.id;
}

export function getScreenIdForStateNode(stateNode: StateNode): string {
  return getScreenScopeId(stateNode);
}

export function ensureScreenRootForScope(
  treeNodesById: Record<string, TreeNode>,
  screenScopeId: string,
  sectionId: string,
): Record<string, TreeNode> {
  const screenRootId = makeScreenRootId(screenScopeId);
  const existingRootNode = treeNodesById[screenRootId];
  const childrenIds = existingRootNode?.kind === "screen_root"
    ? [...(existingRootNode as ScreenRootNode).childrenIds, sectionId]
    : [sectionId];
  return {
    ...treeNodesById,
    [screenRootId]: {
      id: screenRootId,
      kind: "screen_root",
      parentId: null,
      childrenIds,
    } as ScreenRootNode,
  };
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

/** Get the canonical + draft frame root widget IDs for a StateSection.
 *  Note: Frame roots are Widget type "Screen" — this is the implementation
 *  detail that carries the frame semantics, not a reference to state machine Screen. */
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

  // Phase 1: walk the nav map and derive section indexes from existing tree nodes.
  // Variants without a state_section tree node are skipped — tree creation happens
  // only in reducer handlers (handleCreateVariant).
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
      const existingTreeNode = project.treeNodesById?.[sectionId];

      if (existingTreeNode?.kind !== "state_section") continue;
      const stateSection = existingTreeNode as StateSectionNode;
      // Children that are not the canonical root are draft frames.
      // All children are type "Screen" (frame roots in widget tree).
      const draftNodeIds = stateSection.childrenIds.filter(
        (cid) => cid !== variant.rootWidgetId && Boolean(project.widgetsById[cid]),
      );
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

      sectionIdByStateId[variant.id] = sectionId;
      sectionOrderByScreenId[screenId] = [...(sectionOrderByScreenId[screenId] ?? []), sectionId];

      const section = sectionsById[sectionId];
      // type "Screen" here is the frame root implementation detail
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
    const sectionChildIds = Object.values(treeNodesById)
      .filter((n): n is StateSectionNode => n.kind === "state_section" && n.parentId === screenRootId)
      .map((n) => n.id);
    // Merge existing root's children with newly created sections
    const existingChildren = existingRoot?.kind === "screen_root" ? (existingRoot as ScreenRootNode).childrenIds : [];
    const childIds = [...new Set([...existingChildren, ...sectionChildIds])];

    treeNodesById[screenRootId] = {
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
