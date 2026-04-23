// Navigation Map selection model (Phase 2 · 02-navigation-map.md §6).
//
// Kept separate from the v1 `selectedWidgetIds` so the two selection
// spaces never collide while the editor holds both Level 0 (NavMap) and
// Level 1 (StateBoard) state. Downstream Inspector components branch on
// `kind` to pick which panel to render.

export type NavMapSelectionKind = "none" | "node" | "transition" | "mixed";

export interface NavMapSelection {
  kind: NavMapSelectionKind;
  nodeIds: string[];
  transitionIds: string[];
}

export const EMPTY_NAV_MAP_SELECTION: NavMapSelection = {
  kind: "none",
  nodeIds: [],
  transitionIds: [],
};

export function makeNavMapSelection(
  nodeIds: string[],
  transitionIds: string[],
): NavMapSelection {
  const uniqueNodes = Array.from(new Set(nodeIds.filter(Boolean)));
  const uniqueTransitions = Array.from(new Set(transitionIds.filter(Boolean)));
  const hasNodes = uniqueNodes.length > 0;
  const hasTransitions = uniqueTransitions.length > 0;
  let kind: NavMapSelectionKind = "none";
  if (hasNodes && hasTransitions) kind = "mixed";
  else if (hasNodes) kind = "node";
  else if (hasTransitions) kind = "transition";
  return { kind, nodeIds: uniqueNodes, transitionIds: uniqueTransitions };
}

export function isSelectionEmpty(selection: NavMapSelection): boolean {
  return selection.kind === "none";
}

export function isNodeSelected(selection: NavMapSelection, nodeId: string): boolean {
  return selection.nodeIds.includes(nodeId);
}

export function isTransitionSelected(
  selection: NavMapSelection,
  transitionId: string,
): boolean {
  return selection.transitionIds.includes(transitionId);
}
