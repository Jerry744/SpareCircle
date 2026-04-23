import type { ProjectSnapshotV2 } from "../types/projectV2";
import type { StateBoard } from "../types/stateBoard";
import type { Variant } from "../types/variant";
import type { WidgetNode } from "../types/widget";

export interface BoardCanonicalView {
  board: StateBoard;
  canonicalVariant: Variant;
  rootWidget: WidgetNode;
}

export function listAllBoardsWithCanonical(
  project: ProjectSnapshotV2,
): BoardCanonicalView[] {
  const output: BoardCanonicalView[] = [];
  for (const board of Object.values(project.stateBoardsById)) {
    const variant = project.variantsById[board.canonicalVariantId];
    if (!variant) continue;
    const rootWidget = project.widgetsById[variant.rootWidgetId];
    if (!rootWidget) continue;
    output.push({ board, canonicalVariant: variant, rootWidget });
  }
  return output;
}

export function countWidgetsPerBoard(
  project: ProjectSnapshotV2,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const board of Object.values(project.stateBoardsById)) {
    const variant = project.variantsById[board.canonicalVariantId];
    if (!variant) {
      counts[board.id] = 0;
      continue;
    }
    counts[board.id] = countSubtreeWidgets(project.widgetsById, variant.rootWidgetId);
  }
  return counts;
}

function countSubtreeWidgets(
  widgetsById: Record<string, WidgetNode>,
  rootWidgetId: string,
): number {
  const root = widgetsById[rootWidgetId];
  if (!root) return 0;
  const visited = new Set<string>();
  const stack = [rootWidgetId];
  while (stack.length > 0) {
    const widgetId = stack.pop() as string;
    if (visited.has(widgetId)) continue;
    const widget = widgetsById[widgetId];
    if (!widget) continue;
    visited.add(widgetId);
    for (const childId of widget.childrenIds) stack.push(childId);
  }
  return visited.size;
}
