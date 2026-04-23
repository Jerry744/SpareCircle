// StateNode CRUD handlers for v2 Navigation Map.
// Implements the handler list in `02-navigation-map.md` §4.5 and the
// cascade-delete invariant INV-9 from `01-data-model.md` §4. Functions are
// pure `(ProjectSnapshotV2, action) => ProjectSnapshotV2` and will be wired
// into the live reducer by the Phase 6 migration.

import type { WidgetNode } from "../types/widget";
import type { StateNode } from "../types/navigationMap";
import type { StateBoard } from "../types/stateBoard";
import type { Variant } from "../types/variant";
import type { ScreenGroup } from "../types/screenGroup";
import type { ProjectSnapshotV2 } from "../types/projectV2";
import { DEFAULT_STATE_BOARD_META } from "../types/stateBoard";
import { ID_PREFIX, makeBoardId, makeId } from "../types/idPrefixes";
import type { NavMapAction } from "./navMapActions";

// Prune a widget subtree rooted at `rootId` from `widgetsById`. Returns the
// same reference when nothing was removed so downstream memoization skips.
function pruneWidgetSubtree(
  widgetsById: Record<string, WidgetNode>,
  rootId: string,
): Record<string, WidgetNode> {
  const drop = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (drop.has(id) || !widgetsById[id]) continue;
    drop.add(id);
    for (const c of widgetsById[id].childrenIds) stack.push(c);
  }
  if (drop.size === 0) return widgetsById;
  const next: Record<string, WidgetNode> = {};
  for (const [id, w] of Object.entries(widgetsById)) if (!drop.has(id)) next[id] = w;
  return next;
}

function omitEntries<T>(record: Record<string, T>, keys: Set<string>): Record<string, T> {
  if (keys.size === 0) return record;
  const next: Record<string, T> = {};
  for (const [id, v] of Object.entries(record)) if (!keys.has(id)) next[id] = v;
  return next;
}

function replaceStateNode(project: ProjectSnapshotV2, id: string, node: StateNode): ProjectSnapshotV2 {
  return {
    ...project,
    navigationMap: {
      ...project.navigationMap,
      stateNodes: { ...project.navigationMap.stateNodes, [id]: node },
    },
  };
}

function makeUniqueStateNodeName(project: ProjectSnapshotV2, explicit: string | undefined): string {
  const existing = new Set(Object.values(project.navigationMap.stateNodes).map((n) => n.name));
  const trimmed = explicit?.trim();
  if (trimmed) {
    if (!existing.has(trimmed)) return trimmed;
    let c = 2;
    while (existing.has(`${trimmed} ${c}`)) c += 1;
    return `${trimmed} ${c}`;
  }
  let i = project.navigationMap.stateNodeOrder.length + 1;
  while (existing.has(`State ${i}`)) i += 1;
  return `State ${i}`;
}

export function handleCreateStateNode(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "createStateNode" }>,
): ProjectSnapshotV2 {
  const stateNodeId = action.stateNodeId ?? makeId(ID_PREFIX.stateNode);
  const boardId = action.boardId ?? makeBoardId(stateNodeId);
  const variantId = action.variantId ?? makeId(ID_PREFIX.variant);
  const rootWidgetId = action.rootWidgetId ?? `${stateNodeId}-root`;
  const createdAt = action.now ?? new Date().toISOString();
  const name = makeUniqueStateNodeName(project, action.name);
  const stateNode: StateNode = {
    id: stateNodeId, name, position: { ...action.position }, boardId,
    isNavigationState: action.isNavigationState ?? true,
    ...(action.color ? { color: action.color } : {}),
  };
  const board: StateBoard = {
    id: boardId, stateNodeId, meta: { ...DEFAULT_STATE_BOARD_META },
    variantIds: [variantId], canonicalVariantId: variantId,
  };
  const variant: Variant = {
    id: variantId, boardId, name: "Canonical", status: "canonical",
    rootWidgetId, createdAt, updatedAt: createdAt,
  };
  const rootWidget: WidgetNode = {
    id: rootWidgetId, name: `${name} Root`, type: "Screen", parentId: null, childrenIds: [],
    x: 0, y: 0, width: DEFAULT_STATE_BOARD_META.width, height: DEFAULT_STATE_BOARD_META.height,
    fill: DEFAULT_STATE_BOARD_META.fill, radius: 0, visible: true,
  };
  return {
    ...project,
    navigationMap: {
      ...project.navigationMap,
      stateNodes: { ...project.navigationMap.stateNodes, [stateNodeId]: stateNode },
      stateNodeOrder: [...project.navigationMap.stateNodeOrder, stateNodeId],
    },
    stateBoardsById: { ...project.stateBoardsById, [boardId]: board },
    variantsById: { ...project.variantsById, [variantId]: variant },
    widgetsById: { ...project.widgetsById, [rootWidgetId]: rootWidget },
  };
}

export function handleRenameStateNode(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "renameStateNode" }>,
): ProjectSnapshotV2 {
  const requested = action.name.trim();
  if (!requested) return project;
  const existing = project.navigationMap.stateNodes[action.stateNodeId];
  if (!existing) return project;
  const siblings = new Set<string>();
  for (const id of project.navigationMap.stateNodeOrder) {
    if (id === action.stateNodeId) continue;
    const s = project.navigationMap.stateNodes[id];
    if (s) siblings.add(s.name);
  }
  let finalName = requested;
  let c = 2;
  while (siblings.has(finalName)) { finalName = `${requested} ${c}`; c += 1; }
  if (finalName === existing.name) return project;
  return replaceStateNode(project, action.stateNodeId, { ...existing, name: finalName });
}

export function handleMoveStateNode(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "moveStateNode" }>,
): ProjectSnapshotV2 {
  const node = project.navigationMap.stateNodes[action.stateNodeId];
  if (!node) return project;
  if (node.position.x === action.position.x && node.position.y === action.position.y) return project;
  return replaceStateNode(project, action.stateNodeId, { ...node, position: { ...action.position } });
}

export function handleBatchMoveStateNodes(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "batchMoveStateNodes" }>,
): ProjectSnapshotV2 {
  if (action.updates.length === 0) return project;
  let changed = false;
  const nextNodes = { ...project.navigationMap.stateNodes };
  for (const u of action.updates) {
    const node = nextNodes[u.stateNodeId];
    if (!node) continue;
    if (node.position.x === u.position.x && node.position.y === u.position.y) continue;
    nextNodes[u.stateNodeId] = { ...node, position: { ...u.position } };
    changed = true;
  }
  if (!changed) return project;
  return { ...project, navigationMap: { ...project.navigationMap, stateNodes: nextNodes } };
}

export function handleSetInitialState(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "setInitialState" }>,
): ProjectSnapshotV2 {
  if (!project.navigationMap.stateNodes[action.stateNodeId]) return project;
  if (project.navigationMap.initialStateNodeId === action.stateNodeId) return project;
  return {
    ...project,
    navigationMap: { ...project.navigationMap, initialStateNodeId: action.stateNodeId },
  };
}

export function handleAssignStateNodeGroup(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "assignStateNodeGroup" }>,
): ProjectSnapshotV2 {
  const node = project.navigationMap.stateNodes[action.stateNodeId];
  if (!node) return project;
  const nextGroupId = action.screenGroupId ?? undefined;
  if (nextGroupId && !project.screenGroups[nextGroupId]) return project;
  if (node.screenGroupId === nextGroupId) return project;
  const groups: Record<string, ScreenGroup> = { ...project.screenGroups };
  if (node.screenGroupId) {
    const prev = groups[node.screenGroupId];
    if (prev) groups[node.screenGroupId] = {
      ...prev, stateNodeIds: prev.stateNodeIds.filter((id) => id !== action.stateNodeId),
    };
  }
  if (nextGroupId) {
    const target = groups[nextGroupId];
    if (target && !target.stateNodeIds.includes(action.stateNodeId)) {
      groups[nextGroupId] = { ...target, stateNodeIds: [...target.stateNodeIds, action.stateNodeId] };
    }
  }
  const nextNode: StateNode = { ...node };
  if (nextGroupId) nextNode.screenGroupId = nextGroupId;
  else delete nextNode.screenGroupId;
  return { ...replaceStateNode(project, action.stateNodeId, nextNode), screenGroups: groups };
}

export function handleSetStateNodeAppearance(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "setStateNodeAppearance" }>,
): ProjectSnapshotV2 {
  const node = project.navigationMap.stateNodes[action.stateNodeId];
  if (!node) return project;
  const nextColor =
    action.color === null ? undefined : action.color === undefined ? node.color : action.color;
  const nextDescription =
    action.description === null
      ? undefined
      : action.description === undefined
        ? node.description
        : action.description;
  if (nextColor === node.color && nextDescription === node.description) return project;
  const nextNode: StateNode = { ...node };
  if (nextColor === undefined) delete nextNode.color;
  else nextNode.color = nextColor;
  if (nextDescription === undefined) delete nextNode.description;
  else nextNode.description = nextDescription;
  return replaceStateNode(project, action.stateNodeId, nextNode);
}

export function handleToggleNavigationState(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "toggleNavigationState" }>,
): ProjectSnapshotV2 {
  const node = project.navigationMap.stateNodes[action.stateNodeId];
  if (!node) return project;
  if (node.isNavigationState === action.isNavigationState) return project;
  // INV-1 guard: the initial state must stay a navigation state so the
  // top-level map always has a visible entry point.
  if (!action.isNavigationState && project.navigationMap.initialStateNodeId === action.stateNodeId) {
    return project;
  }
  return replaceStateNode(project, action.stateNodeId, {
    ...node, isNavigationState: action.isNavigationState,
  });
}

interface CascadeDeletion {
  boards: Set<string>; variants: Set<string>; transitions: Set<string>;
  bindings: Set<string>; widgetsById: Record<string, WidgetNode>;
}

// Gather every id that must die with the given StateNodes plus the pruned
// widget tree. Factored out so `handleDeleteStateNodes` stays ≤ 60 lines.
function collectCascade(project: ProjectSnapshotV2, nodeIds: Set<string>): CascadeDeletion {
  const boards = new Set<string>();
  const variants = new Set<string>();
  let widgetsById = project.widgetsById;
  for (const sid of nodeIds) {
    const node = project.navigationMap.stateNodes[sid];
    if (!node) continue;
    boards.add(node.boardId);
    const board = project.stateBoardsById[node.boardId];
    if (!board) continue;
    for (const vid of board.variantIds) {
      variants.add(vid);
      const variant = project.variantsById[vid];
      if (variant) widgetsById = pruneWidgetSubtree(widgetsById, variant.rootWidgetId);
    }
  }
  const transitions = new Set<string>();
  for (const [id, t] of Object.entries(project.navigationMap.transitions)) {
    if (nodeIds.has(t.fromStateNodeId) || nodeIds.has(t.toStateNodeId)) transitions.add(id);
  }
  const bindings = new Set<string>();
  for (const [id, b] of Object.entries(project.transitionEventBindings)) {
    if (transitions.has(b.transitionId)) bindings.add(id);
  }
  return { boards, variants, transitions, bindings, widgetsById };
}

function pruneGroupMembership(
  groups: Record<string, ScreenGroup>, deleted: Set<string>,
): Record<string, ScreenGroup> {
  const next: Record<string, ScreenGroup> = {};
  for (const [id, g] of Object.entries(groups)) {
    const filtered = g.stateNodeIds.filter((nid) => !deleted.has(nid));
    next[id] = filtered.length === g.stateNodeIds.length ? g : { ...g, stateNodeIds: filtered };
  }
  return next;
}

// INV-9: cascade-delete Board, Variants, widgets, Transitions and bindings
// when StateNodes are removed. If the deletion would empty the map, return
// the project unchanged so the editor never loses its last entry point.
export function handleDeleteStateNodes(
  project: ProjectSnapshotV2,
  action: Extract<NavMapAction, { type: "deleteStateNodes" }>,
): ProjectSnapshotV2 {
  const nodeIds = new Set(
    action.stateNodeIds.filter((id) => Boolean(project.navigationMap.stateNodes[id])),
  );
  if (nodeIds.size === 0) return project;
  if (nodeIds.size >= project.navigationMap.stateNodeOrder.length) return project;
  const cascade = collectCascade(project, nodeIds);
  const nextNodeOrder = project.navigationMap.stateNodeOrder.filter((id) => !nodeIds.has(id));
  const nextTransitionOrder = project.navigationMap.transitionOrder.filter(
    (id) => !cascade.transitions.has(id),
  );
  // INV-1 repair: if the initial state vanished, fall back to the first
  // remaining node in insertion order (non-empty by the early return above).
  const nextInitial = nodeIds.has(project.navigationMap.initialStateNodeId)
    ? (nextNodeOrder[0] ?? project.navigationMap.initialStateNodeId)
    : project.navigationMap.initialStateNodeId;
  return {
    ...project,
    navigationMap: {
      ...project.navigationMap,
      stateNodes: omitEntries(project.navigationMap.stateNodes, nodeIds),
      stateNodeOrder: nextNodeOrder,
      transitions: omitEntries(project.navigationMap.transitions, cascade.transitions),
      transitionOrder: nextTransitionOrder,
      initialStateNodeId: nextInitial,
    },
    stateBoardsById: omitEntries(project.stateBoardsById, cascade.boards),
    variantsById: omitEntries(project.variantsById, cascade.variants),
    widgetsById: cascade.widgetsById,
    transitionEventBindings: omitEntries(project.transitionEventBindings, cascade.bindings),
    screenGroups: pruneGroupMembership(project.screenGroups, nodeIds),
  };
}
