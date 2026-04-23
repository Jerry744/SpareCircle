import type { ProjectSnapshotV2 } from "../types/projectV2";
import type { StateBoard, StateBoardMeta } from "../types/stateBoard";
import type { StateNode } from "../types/navigationMap";
import type { Variant } from "../types/variant";
import type { WidgetNode } from "../types/widget";

export interface ResolvedBoardView {
  stateNode: StateNode;
  board: StateBoard;
  variant: Variant;
  rootWidget: WidgetNode;
  meta: StateBoardMeta;
}

export function resolveBoardView(
  project: ProjectSnapshotV2,
  stateNodeId: string,
  variantId?: string,
): ResolvedBoardView | null {
  const stateNode = project.navigationMap.stateNodes[stateNodeId];
  if (!stateNode) return null;
  const board = project.stateBoardsById[stateNode.boardId];
  if (!board) return null;
  const targetVariantId = variantId ?? board.canonicalVariantId;
  if (!targetVariantId) return null;
  const variant = project.variantsById[targetVariantId];
  if (!variant || variant.boardId !== board.id) return null;
  const rootWidget = project.widgetsById[variant.rootWidgetId];
  if (!rootWidget) return null;
  return { stateNode, board, variant, rootWidget, meta: board.meta };
}

export function getRootWidgetIdForVariant(
  project: ProjectSnapshotV2,
  variantId: string,
): string | null {
  const variant = project.variantsById[variantId];
  if (!variant) return null;
  return project.widgetsById[variant.rootWidgetId] ? variant.rootWidgetId : null;
}
