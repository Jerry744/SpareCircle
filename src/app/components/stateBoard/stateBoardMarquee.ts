import type { MarqueeState } from "../canvasViewport/types";
import { flattenWidgetTree, type WidgetTreeNode } from "../../backend/tree";

interface ScreenFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeStateBoardMarqueeSelection(params: {
  variantIds: string[];
  frameById: Record<string, ScreenFrame>;
  rootTreesByVariant: Record<string, WidgetTreeNode | null | Array<WidgetTreeNode | null>>;
  ignoredWidgetIds?: Set<string>;
  includeScreenRoots?: boolean;
  marquee: MarqueeState;
}): {
  variantIds: string[];
  widgetIdsByVariant: Record<string, string[]>;
} {
  const { variantIds, frameById, rootTreesByVariant, ignoredWidgetIds = new Set(), includeScreenRoots = false, marquee } = params;
  const dx = marquee.currentWorld.x - marquee.startWorld.x;
  const dy = marquee.currentWorld.y - marquee.startWorld.y;
  const minX = Math.min(marquee.startWorld.x, marquee.currentWorld.x);
  const maxX = Math.max(marquee.startWorld.x, marquee.currentWorld.x);
  const minY = Math.min(marquee.startWorld.y, marquee.currentWorld.y);
  const maxY = Math.max(marquee.startWorld.y, marquee.currentWorld.y);
  const useContains = dx >= 0 && dy >= 0;

  const hitVariantIds = variantIds.filter((variantId) => {
    const frame = frameById[variantId];
    if (!frame) return false;
    const left = frame.x;
    const right = frame.x + frame.width;
    const top = frame.y;
    const bottom = frame.y + frame.height;
    if (useContains) {
      return left >= minX && right <= maxX && top >= minY && bottom <= maxY;
    }
    return left < maxX && right > minX && top < maxY && bottom > minY;
  });

  const widgetIdsByVariant = Object.fromEntries(
    variantIds
      .map((variantId) => [variantId, computeMarqueeHits(rootTreesByVariant[variantId] ?? null, marquee, ignoredWidgetIds, includeScreenRoots)] as const)
      .filter(([, widgetIds]) => widgetIds.length > 0),
  );

  return { variantIds: hitVariantIds, widgetIdsByVariant };
}

function computeMarqueeHits(
  roots: WidgetTreeNode | null | Array<WidgetTreeNode | null>,
  marquee: MarqueeState,
  ignoredWidgetIds: Set<string>,
  includeScreenRoots: boolean,
): string[] {
  const rootList = Array.isArray(roots) ? roots : [roots];
  const dx = marquee.currentWorld.x - marquee.startWorld.x;
  const dy = marquee.currentWorld.y - marquee.startWorld.y;
  const minX = Math.min(marquee.startWorld.x, marquee.currentWorld.x);
  const maxX = Math.max(marquee.startWorld.x, marquee.currentWorld.x);
  const minY = Math.min(marquee.startWorld.y, marquee.currentWorld.y);
  const maxY = Math.max(marquee.startWorld.y, marquee.currentWorld.y);
  const useContains = dx >= 0 && dy >= 0;
  const hitIds: string[] = [];

  for (const root of rootList) {
    if (!root) continue;
    for (const item of flattenWidgetTree(root)) {
      if (ignoredWidgetIds.has(item.widget.id) || item.widget.visible === false) continue;
      if (!includeScreenRoots && item.widget.type === "Screen") continue;
      const left = item.absX;
      const right = item.absX + item.widget.width;
      const top = item.absY;
      const bottom = item.absY + item.widget.height;
      if (useContains) {
        if (left >= minX && right <= maxX && top >= minY && bottom <= maxY) hitIds.push(item.widget.id);
      } else if (left < maxX && right > minX && top < maxY && bottom > minY) {
        hitIds.push(item.widget.id);
      }
    }
  }

  return Array.from(new Set(hitIds));
}
