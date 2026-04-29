import type { ProjectSnapshotCore, Section } from "../types/projectV2";
import type { StateNode } from "../types/navigationMap";

export function makeSectionId(stateId: string): string {
  return stateId.startsWith("state-node-")
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

  project.navigationMap.stateNodeOrder.forEach((stateId, order) => {
    const stateNode = project.navigationMap.stateNodes[stateId];
    if (!stateNode) return;
    const board = project.stateBoardsById[stateNode.boardId];
    if (!board) return;
    const screenId = getScreenIdForStateNode(stateNode);
    const sectionId = makeSectionId(stateId);
    const variants = board.variantIds
      .map((variantId) => project.variantsById[variantId])
      .filter(Boolean);
    const canonicalVariant = project.variantsById[board.canonicalVariantId] ?? variants[0];
    if (!canonicalVariant) return;
    const rootWidgetIds = variants.map((variant) => variant.rootWidgetId);
    const draftNodeIds = rootWidgetIds.filter((rootWidgetId) => rootWidgetId !== canonicalVariant.rootWidgetId);

    const existingSection = project.sectionsById?.[sectionId];
    sectionsById[sectionId] = {
      id: sectionId,
      screenId,
      stateId,
      name: existingSection?.name?.trim() || `${stateNode.name} Section`,
      canonicalFrameId: canonicalVariant.rootWidgetId,
      draftNodeIds,
      order,
    };
    sectionIdByStateId[stateId] = sectionId;
    sectionOrderByScreenId[screenId] = [...(sectionOrderByScreenId[screenId] ?? []), sectionId];
    screenTreeByScreenId[screenId] = {
      rootWidgetIds: [...(screenTreeByScreenId[screenId]?.rootWidgetIds ?? []), ...rootWidgetIds],
    };
    for (const rootWidgetId of rootWidgetIds) {
      screenIdByRootWidgetId[rootWidgetId] = screenId;
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
