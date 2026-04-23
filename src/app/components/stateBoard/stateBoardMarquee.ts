import { computeMarqueeHits } from "../canvasViewport/marquee";
import type { MarqueeState } from "../canvasViewport/types";
import type { WidgetTreeNode } from "../../backend/tree";

interface ScreenFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeStateBoardMarqueeSelection(params: {
  variantIds: string[];
  frameById: Record<string, ScreenFrame>;
  rootTreesByVariant: Record<string, WidgetTreeNode | null>;
  marquee: MarqueeState;
}): {
  variantIds: string[];
  widgetIdsByVariant: Record<string, string[]>;
} {
  const { variantIds, frameById, rootTreesByVariant, marquee } = params;
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
      .map((variantId) => [variantId, computeMarqueeHits(rootTreesByVariant[variantId] ?? null, marquee.startWorld, marquee.currentWorld)] as const)
      .filter(([, widgetIds]) => widgetIds.length > 0),
  );

  return { variantIds: hitVariantIds, widgetIdsByVariant };
}
