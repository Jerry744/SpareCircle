import type { ProjectSnapshotCore, Section } from "../types/projectV2";
import type { StateNode } from "../types/navigationMap";

export function makeSectionId(stateId: string): string {
  return stateId.startsWith("variant-")
    ? `section-${stateId.slice("variant-".length)}`
    : stateId.startsWith("state-node-")
      ? `section-${stateId.slice("state-node-".length)}`
    : `section-${stateId}`;
}

export function getScreenIdForStateNode(stateNode: StateNode): string {
  return stateNode.screenGroupId ?? stateNode.id;
}

export function deriveSectionIndexes<T extends ProjectSnapshotCore>(project: T): Pick<
  ProjectSnapshotCore,
  "sectionsById" | "sectionOrderByScreenId" | "sectionIdByStateId" | "screenTreeByScreenId" | "screenIdByRootWidgetId"
> {
  const sectionsById: Record<string, Section> = {};
  const sectionOrderByScreenId: Record<string, string[]> = {};
  const sectionIdByStateId: Record<string, string> = {};
  const screenTreeByScreenId: Record<string, { rootWidgetIds: string[] }> = {};
  const screenIdByRootWidgetId: Record<string, string> = {};

  let order = 0;
  project.navigationMap.stateNodeOrder.forEach((stateNodeId) => {
    const stateNode = project.navigationMap.stateNodes[stateNodeId];
    if (!stateNode) return;
    const board = project.stateBoardsById[stateNode.boardId];
    if (!board) return;
    const screenId = getScreenIdForStateNode(stateNode);
    for (const variantId of board.variantIds) {
      const variant = project.variantsById[variantId];
      if (!variant) continue;
      const sectionId = makeSectionId(variant.id);
      const existingSection = project.sectionsById?.[sectionId];
      sectionsById[sectionId] = {
        id: sectionId,
        screenId,
        stateId: variant.id,
        name: existingSection?.name?.trim() || `${variant.name} Section`,
        canonicalFrameId: variant.rootWidgetId,
        draftNodeIds: (existingSection?.draftNodeIds ?? []).filter((nodeId) => (
          nodeId !== variant.rootWidgetId && Boolean(project.widgetsById[nodeId])
        )),
        order,
      };
      sectionIdByStateId[variant.id] = sectionId;
      sectionOrderByScreenId[screenId] = [...(sectionOrderByScreenId[screenId] ?? []), sectionId];
      const draftScreenRootIds = sectionsById[sectionId].draftNodeIds
        .filter((nodeId) => project.widgetsById[nodeId]?.type === "Screen");
      screenTreeByScreenId[screenId] = {
        rootWidgetIds: [...(screenTreeByScreenId[screenId]?.rootWidgetIds ?? []), variant.rootWidgetId, ...draftScreenRootIds],
      };
      screenIdByRootWidgetId[variant.rootWidgetId] = screenId;
      for (const rootWidgetId of draftScreenRootIds) screenIdByRootWidgetId[rootWidgetId] = screenId;
      order += 1;
    }
  });

  return {
    sectionsById,
    sectionOrderByScreenId,
    sectionIdByStateId,
    screenTreeByScreenId,
    screenIdByRootWidgetId,
  };
}

export function syncSectionIndexes<T extends ProjectSnapshotCore>(project: T): T {
  return {
    ...project,
    ...deriveSectionIndexes(project),
  };
}
