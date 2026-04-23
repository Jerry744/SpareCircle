import type { Point } from "../../backend/types/editor";
import { canContainChildren, flattenWidgetTree, type WidgetTreeNode } from "../../backend/tree";

export interface WidgetDropTarget {
  variantId?: string;
  rootWidgetId: string;
  parentId: string;
  localX: number;
  localY: number;
}

export function resolveWidgetDropTarget(params: {
  rootTree: WidgetTreeNode | null;
  world: Point;
}): WidgetDropTarget | null {
  const { rootTree, world } = params;
  if (!rootTree) return null;

  const allWidgets = flattenWidgetTree(rootTree);
  for (let index = allWidgets.length - 1; index >= 0; index -= 1) {
    const item = allWidgets[index];
    const withinBody =
      world.x >= item.absX &&
      world.x <= item.absX + item.widget.width &&
      world.y >= item.absY &&
      world.y <= item.absY + item.widget.height;
    if (!withinBody || !canContainChildren(item.widget.type)) continue;
    return {
      rootWidgetId: rootTree.id,
      parentId: item.widget.id,
      localX: Math.round(world.x - item.absX),
      localY: Math.round(world.y - item.absY),
    };
  }

  return {
    rootWidgetId: rootTree.id,
    parentId: rootTree.id,
    localX: Math.round(world.x),
    localY: Math.round(world.y),
  };
}
