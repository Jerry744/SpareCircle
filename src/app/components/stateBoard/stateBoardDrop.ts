import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { StateBoard } from "../../backend/types/stateBoard";
import type { Point } from "../../backend/types/editor";
import { buildWidgetTree } from "../../backend/tree";
import { getScreenIdForStateNode, makeScreenRootId } from "../../backend/stateBoard/sectionModel";
import { resolveWidgetDropTarget, type WidgetDropTarget } from "../canvasViewport/dropTarget";

export function resolveStateBoardWidgetDropTarget(params: {
  project: ProjectSnapshotV2;
  board: StateBoard;
  world: Point;
  fallbackVariantId?: string;
}): WidgetDropTarget | null {
  const { project, board, world, fallbackVariantId } = params;

  const stateNode = project.navigationMap.stateNodes[board.stateNodeId];
  const screenId = stateNode ? getScreenIdForStateNode(stateNode) : board.stateNodeId;
  const screenRoot = project.treeNodesById[makeScreenRootId(screenId)];
  const frameEntries: Array<{ frameId: string; variantId: string }> = [];
  if (screenRoot?.kind === "screen_root") {
    for (const sectionId of screenRoot.childrenIds) {
      const section = project.treeNodesById[sectionId];
      if (section?.kind !== "state_section") continue;
      for (const frameId of section.childrenIds) frameEntries.push({ frameId, variantId: section.stateId });
    }
  }
  const listedFrameIds = new Set(frameEntries.map((entry) => entry.frameId));
  for (const variantId of board.variantIds) {
    const variant = project.variantsById[variantId];
    const frameId = variant ? variant.canonicalFrameId || variant.rootWidgetId : null;
    if (frameId && !listedFrameIds.has(frameId)) frameEntries.push({ frameId, variantId });
  }

  for (let index = frameEntries.length - 1; index >= 0; index -= 1) {
    const { frameId, variantId } = frameEntries[index];
    const root = project.widgetsById[frameId];
    if (!root) continue;

    const withinFrame =
      world.x >= root.x &&
      world.x <= root.x + root.width &&
      world.y >= root.y &&
      world.y <= root.y + root.height;
    if (!withinFrame) continue;

    const rootTree = buildWidgetTree(project, frameId);
    const target = resolveWidgetDropTarget({
      rootTree,
      world: { x: world.x - root.x, y: world.y - root.y },
    });
    if (!target) continue;
    return { ...target, variantId };
  }

  if (fallbackVariantId) {
    const fallbackVariant = project.variantsById[fallbackVariantId];
    const root = fallbackVariant ? project.widgetsById[fallbackVariant.canonicalFrameId || fallbackVariant.rootWidgetId] : null;
    if (fallbackVariant && root && board.variantIds.includes(fallbackVariant.id)) {
      return {
        variantId: fallbackVariant.id,
        rootWidgetId: root.id,
        parentId: root.id,
        localX: Math.round(world.x - root.x),
        localY: Math.round(world.y - root.y),
      };
    }
  }

  return null;
}
