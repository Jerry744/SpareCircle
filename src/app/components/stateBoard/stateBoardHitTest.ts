import type { Point } from "../../backend/editorStore";
import { flattenWidgetTree, type WidgetTreeNode } from "../../backend/tree";
import type { WidgetNode } from "../../backend/types/widget";

export interface StateBoardWidgetHit {
  variantId: string;
  widget: WidgetTreeNode;
  absX: number;
  absY: number;
  mode: "body" | "resize";
}

export function getStateBoardWidgetHit(
  variantIds: string[],
  rootTreesByVariant: Record<string, WidgetTreeNode | null>,
  selectedWidgetIds: string[],
  point: Point,
): StateBoardWidgetHit | null {
  for (let variantIndex = variantIds.length - 1; variantIndex >= 0; variantIndex -= 1) {
    const variantId = variantIds[variantIndex];
    const rootTree = rootTreesByVariant[variantId];
    if (!rootTree) continue;

    const items = flattenWidgetTree(rootTree);
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item.widget.type === "Screen" || item.widget.visible === false) continue;

      const withinBody =
        point.x >= item.absX &&
        point.x <= item.absX + item.widget.width &&
        point.y >= item.absY &&
        point.y <= item.absY + item.widget.height;
      if (!withinBody) continue;

      const inResizeHandle =
        selectedWidgetIds.includes(item.widget.id) &&
        point.x >= item.absX + item.widget.width - 12 &&
        point.y >= item.absY + item.widget.height - 12;

      return {
        variantId,
        widget: item.widget,
        absX: item.absX,
        absY: item.absY,
        mode: inResizeHandle ? "resize" : "body",
      };
    }
  }

  return null;
}

export function filterTopLevelWidgetIds(
  widgetIds: string[],
  widgetsById: Record<string, WidgetNode>,
): string[] {
  const selected = new Set(widgetIds);
  return widgetIds.filter((id) => {
    let parentId = widgetsById[id]?.parentId ?? null;
    while (parentId) {
      if (selected.has(parentId)) return false;
      parentId = widgetsById[parentId]?.parentId ?? null;
    }
    return true;
  });
}
