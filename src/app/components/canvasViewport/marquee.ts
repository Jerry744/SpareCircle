import type { WidgetTreeNode } from "../../backend/editorStore";
import { flattenWidgetTree } from "../../backend/editorStore";
import type { Point } from "../../backend/editorStore";

/**
 * Pure hit-test for a marquee selection.
 *
 * Direction-sensitive: dragging down-right (dx>=0 && dy>=0) uses "contains"
 * semantics (widget fully inside rect); otherwise "intersects" semantics.
 * Screens and hidden widgets are excluded.
 */
export function computeMarqueeHits(
  rootTree: WidgetTreeNode | null,
  startWorld: Point,
  currentWorld: Point,
): string[] {
  if (!rootTree) {
    return [];
  }

  const dx = currentWorld.x - startWorld.x;
  const dy = currentWorld.y - startWorld.y;
  const minX = Math.min(startWorld.x, currentWorld.x);
  const maxX = Math.max(startWorld.x, currentWorld.x);
  const minY = Math.min(startWorld.y, currentWorld.y);
  const maxY = Math.max(startWorld.y, currentWorld.y);
  const useContains = dx >= 0 && dy >= 0;

  const allWidgets = flattenWidgetTree(rootTree);
  const hitIds: string[] = [];
  for (const item of allWidgets) {
    if (item.widget.type === "Screen" || item.widget.visible === false) {
      continue;
    }

    const wL = item.absX;
    const wR = item.absX + item.widget.width;
    const wT = item.absY;
    const wB = item.absY + item.widget.height;
    if (useContains) {
      if (wL >= minX && wR <= maxX && wT >= minY && wB <= maxY) {
        hitIds.push(item.widget.id);
      }
    } else if (wL < maxX && wR > minX && wT < maxY && wB > minY) {
      hitIds.push(item.widget.id);
    }
  }

  return hitIds;
}
