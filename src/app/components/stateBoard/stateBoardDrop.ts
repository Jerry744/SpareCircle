import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { StateBoard } from "../../backend/types/stateBoard";
import type { Point } from "../../backend/types/editor";
import { buildWidgetTree } from "../../backend/tree";
import { resolveWidgetDropTarget, type WidgetDropTarget } from "../canvasViewport/dropTarget";

export function resolveStateBoardWidgetDropTarget(params: {
  project: ProjectSnapshotV2;
  board: StateBoard;
  world: Point;
  fallbackVariantId?: string;
}): WidgetDropTarget | null {
  const { project, board, world, fallbackVariantId } = params;

  for (let index = board.variantIds.length - 1; index >= 0; index -= 1) {
    const variantId = board.variantIds[index];
    const variant = project.variantsById[variantId];
    const root = variant ? project.widgetsById[variant.rootWidgetId] : null;
    if (!variant || !root) continue;

    const withinFrame =
      world.x >= root.x &&
      world.x <= root.x + root.width &&
      world.y >= root.y &&
      world.y <= root.y + root.height;
    if (!withinFrame) continue;

    const rootTree = buildWidgetTree(project, variant.rootWidgetId);
    const target = resolveWidgetDropTarget({
      rootTree,
      world: { x: world.x - root.x, y: world.y - root.y },
    });
    if (!target) continue;
    return { ...target, variantId };
  }

  if (fallbackVariantId) {
    const fallbackVariant = project.variantsById[fallbackVariantId];
    const root = fallbackVariant ? project.widgetsById[fallbackVariant.rootWidgetId] : null;
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
