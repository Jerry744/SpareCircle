/**
 * Domain mutation handlers for variant reducer actions.
 *
 * This module contains pure state transitions that operate on `ProjectSnapshotV2`.
 * Callers are expected to perform action routing in `variantReducer.ts`.
 *
 * Conventions:
 * - Return the original `project` object when no logical change is made.
 * - Use `touchVariant` when a mutation should refresh variant timestamps.
 * - Keep section index synchronization at reducer level via `syncIfChanged`.
 */
import type { ProjectSnapshotV2, StateSectionNode, ScreenRootNode, TreeNode } from "../types/projectV2";
import type { StateBoard } from "../types/stateBoard";
import type { Variant, VariantStatus } from "../types/variant";
import type { WidgetNode } from "../types/widget";
import { CONTAINER_WIDGET_TYPES, INSERTABLE_WIDGET_TYPES } from "../types/widget";
import { DEFAULT_STATE_BOARD_META } from "../types/stateBoard";
import { ID_PREFIX, makeId } from "../types/idPrefixes";
import { cloneVariant } from "../stateBoard/variantCloning";
import { reassignCanonicalAfterMutation } from "../stateBoard/variantHelpers";
import {
  syncSectionIndexes,
  makeSectionId,
  getScreenScopeId,
  ensureScreenRootForScope,
  makeScreenRootId,
} from "../stateBoard/sectionModel";
import { createWidgetNode } from "../widgets";
import { touchVariant } from "./helpers";
import type { VariantAction } from "./variantActions";

export function syncIfChanged(project: ProjectSnapshotV2, next: ProjectSnapshotV2): ProjectSnapshotV2 {
  return next === project ? project : syncSectionIndexes(next);
}

function uniqueVariantName(project: ProjectSnapshotV2, board: StateBoard, requested: string | undefined): string {
  const base = requested?.trim() || "Variant";
  const names = new Set(board.variantIds.map((id) => project.variantsById[id]?.name).filter(Boolean));
  if (!names.has(base)) return base;
  let index = 2;
  while (names.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

function pruneWidgetSubtree(widgetsById: Record<string, WidgetNode>, rootId: string): Record<string, WidgetNode> {
  const drop = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    const widget = widgetsById[id];
    if (!widget || drop.has(id)) continue;
    drop.add(id);
    for (const childId of widget.childrenIds) stack.push(childId);
  }
  const next: Record<string, WidgetNode> = {};
  for (const [id, widget] of Object.entries(widgetsById)) if (!drop.has(id)) next[id] = widget;
  return next;
}

function collectWidgetSubtreeIds(widgetsById: Record<string, WidgetNode>, rootId: string): Set<string> {
  const ids = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (ids.has(id)) continue;
    const widget = widgetsById[id];
    if (!widget) continue;
    ids.add(id);
    for (const childId of widget.childrenIds) stack.push(childId);
  }
  return ids;
}

function collectVariantWidgetIds(project: ProjectSnapshotV2, variantId: string): Set<string> {
  const ids = new Set<string>();
  const variant = project.variantsById[variantId];
  if (!variant) return ids;
  const canonicalIds = collectWidgetSubtreeIds(project.widgetsById, variant.rootWidgetId);
  for (const id of canonicalIds) ids.add(id);
  for (const node of Object.values(project.treeNodesById ?? {})) {
    if (node.kind === "state_section" && node.stateId === variantId) {
      for (const childId of node.childrenIds) {
        if (childId !== variant.rootWidgetId) {
          const draftIds = collectWidgetSubtreeIds(project.widgetsById, childId);
          for (const id of draftIds) ids.add(id);
        }
      }
    }
  }
  return ids;
}

/**
 * Finds the owning variant for a widget, including section draft trees.
 * Returns null when the widget does not belong to any known variant subtree.
 */
function findVariantIdForWidget(project: ProjectSnapshotV2, widgetId: string): string | null {
  for (const variant of Object.values(project.variantsById)) {
    if (collectWidgetSubtreeIds(project.widgetsById, variant.rootWidgetId).has(widgetId)) return variant.id;
  }
  for (const node of Object.values(project.treeNodesById ?? {})) {
    if (node.kind !== "state_section") continue;
    for (const childId of node.childrenIds) {
      if (childId !== project.variantsById[node.stateId]?.rootWidgetId &&
          collectWidgetSubtreeIds(project.widgetsById, childId).has(widgetId)) {
        return node.stateId;
      }
    }
  }
  return null;
}

function findSectionIdForRoot(project: ProjectSnapshotV2, rootWidgetId: string): string | null {
  for (const node of Object.values(project.treeNodesById ?? {})) {
    if (node.kind === "state_section" && node.childrenIds.includes(rootWidgetId)) return node.id;
  }
  return null;
}

/**
 * Rewrites event bindings during clone so internal references follow the new id map.
 * Non-supported binding types are intentionally dropped to avoid stale references.
 */
function rewriteClonedBindings(widget: WidgetNode, idMap: Map<string, string>): WidgetNode {
  if (!widget.eventBindings) return widget;
  const eventBindings: Record<string, NonNullable<(typeof widget.eventBindings)[keyof typeof widget.eventBindings]>> = {};
  for (const [event, binding] of Object.entries(widget.eventBindings)) {
    if (!binding) continue;
    if (binding.action.type === "toggle_visibility") {
      eventBindings[event] = {
        ...binding,
        action: {
          ...binding.action,
          targetWidgetId: idMap.get(binding.action.targetWidgetId) ?? binding.action.targetWidgetId,
        },
      };
    }
  }
  return Object.keys(eventBindings).length > 0
    ? { ...widget, eventBindings: eventBindings as WidgetNode["eventBindings"] }
    : { ...widget, eventBindings: undefined };
}

function makeCloneWidgetId(used: Set<string>, sourceId: string, override?: string): string {
  if (override && !used.has(override)) {
    used.add(override);
    return override;
  }
  const base = sourceId.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "") || "widget";
  let index = 1;
  while (used.has(`${base}-${index}`)) index += 1;
  const id = `${base}-${index}`;
  used.add(id);
  return id;
}

function filterTopLevelWidgetIds(project: ProjectSnapshotV2, widgetIds: string[]): string[] {
  const selected = new Set(widgetIds);
  return widgetIds.filter((id) => {
    let parentId = project.widgetsById[id]?.parentId ?? null;
    while (parentId) {
      if (selected.has(parentId)) return false;
      parentId = project.widgetsById[parentId]?.parentId ?? null;
    }
    return true;
  });
}

function removeWidgetSubtrees(
  widgetsById: Record<string, WidgetNode>,
  rootIds: string[],
): { widgetsById: Record<string, WidgetNode>; deletedIds: Set<string> } {
  const deletedIds = new Set<string>();
  for (const rootId of rootIds) {
    for (const id of collectWidgetSubtreeIds(widgetsById, rootId)) deletedIds.add(id);
  }
  const nextWidgetsById: Record<string, WidgetNode> = {};
  for (const [id, widget] of Object.entries(widgetsById)) {
    if (deletedIds.has(id)) continue;
    const childrenIds = widget.childrenIds.filter((childId) => !deletedIds.has(childId));
    nextWidgetsById[id] = childrenIds.length === widget.childrenIds.length ? widget : { ...widget, childrenIds };
  }
  return { widgetsById: nextWidgetsById, deletedIds };
}

function makeRootFromMeta(id: string, name: string, width: number, height: number): WidgetNode {
  return {
    id,
    name: `${name} Root`,
    type: "Screen",
    parentId: null,
    childrenIds: [],
    x: 0,
    y: 0,
    width,
    height,
    fill: DEFAULT_STATE_BOARD_META.fill,
    radius: 0,
    visible: true,
  };
}

export function handleCreateVariant(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "createVariant" }>,
): ProjectSnapshotV2 {
  const board = project.stateBoardsById[action.boardId];
  if (!board) return project;
  const variantId = action.variantId ?? makeId(ID_PREFIX.variant);
  if (project.variantsById[variantId]) return project;
  const name = uniqueVariantName(project, board, action.name);
  const now = action.now ?? new Date().toISOString();
  const rootX = board.variantIds.length * (board.meta.width + 80);
  // Derive screen root for tree node creation
  const stateNode = project.navigationMap.stateNodes[board.stateNodeId];
  const screenId = stateNode ? getScreenScopeId(stateNode) : board.stateNodeId;
  const screenRootId = makeScreenRootId(screenId);

  if (action.mode !== "blank") {
    const sourceVariantId = action.mode === "copy_of" ? action.sourceVariantId : board.canonicalVariantId;
    if (!sourceVariantId || !project.variantsById[sourceVariantId]) return project;
    const { newVariant, newWidgets } = cloneVariant({
      project,
      sourceVariantId,
      newVariantName: name,
      newVariantId: variantId,
      now,
      idPrefix: action.rootWidgetId,
    });
    const movedRoot = newVariant.rootWidgetId ? newWidgets[newVariant.rootWidgetId] : undefined;
    if (movedRoot) newWidgets[movedRoot.id] = { ...movedRoot, x: rootX, y: 0, width: board.meta.width, height: board.meta.height, frameRole: "canonical" };

    // Tree: create StateSectionNode under existing ScreenRootNode
    const sectionId = makeSectionId(variantId);
    const treeWithRoot = ensureScreenRootForScope(project.treeNodesById, screenId, sectionId);
    const clonedRootWidgetId = newVariant.rootWidgetId;
    const treeNodesById: Record<string, TreeNode> = {
      ...project.treeNodesById,
      ...treeWithRoot,
      [sectionId]: {
        id: sectionId, kind: "state_section", parentId: screenRootId,
        childrenIds: clonedRootWidgetId ? [clonedRootWidgetId] : [],
        screenId, stateId: variantId, name: `${name} Section`, sectionId,
        x: 0, y: 0, width: board.meta.width, height: board.meta.height, layoutMode: "auto",
      } as StateSectionNode,
    };
    return {
      ...project,
      stateBoardsById: { ...project.stateBoardsById, [board.id]: { ...board, variantIds: [...board.variantIds, variantId] } },
      variantsById: { ...project.variantsById, [variantId]: newVariant },
      widgetsById: { ...project.widgetsById, ...newWidgets },
      treeNodesById,
    };
  }
  const rootWidgetId = action.rootWidgetId ?? `${variantId}-root`;
  const variant: Variant = { id: variantId, boardId: board.id, name, status: "draft", rootWidgetId, createdAt: now, updatedAt: now };

  // Tree: create StateSectionNode under existing ScreenRootNode
  const sectionId = makeSectionId(variantId);
  const treeWithRoot = ensureScreenRootForScope(project.treeNodesById, screenId, sectionId);
  const treeNodesById: Record<string, TreeNode> = {
    ...treeWithRoot,
    [sectionId]: {
      id: sectionId, kind: "state_section", parentId: screenRootId, childrenIds: [rootWidgetId],
      screenId, stateId: variantId, name: `${name} Section`, sectionId,
      x: 0, y: 0, width: board.meta.width, height: board.meta.height, layoutMode: "auto",
    } as StateSectionNode,
  };
  return {
    ...project,
    stateBoardsById: { ...project.stateBoardsById, [board.id]: { ...board, variantIds: [...board.variantIds, variantId] } },
    variantsById: { ...project.variantsById, [variantId]: variant },
      widgetsById: {
        ...project.widgetsById,
        [rootWidgetId]: { ...makeRootFromMeta(rootWidgetId, name, board.meta.width, board.meta.height), x: rootX, frameRole: "canonical" },
      },
    treeNodesById,
  };
}

/** Renames a variant with board-local unique name enforcement. */
export function handleRenameVariant(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "renameVariant" }>,
): ProjectSnapshotV2 {
  const variant = project.variantsById[action.variantId];
  if (!variant) return project;
  const board = project.stateBoardsById[variant.boardId];
  if (!board) return project;
  const name = uniqueVariantName(project, { ...board, variantIds: board.variantIds.filter((id) => id !== variant.id) }, action.name);
  if (name === variant.name) return project;
  const next = { ...project, variantsById: { ...project.variantsById, [variant.id]: { ...variant, name } } };
  return touchVariant(next, variant.id, action.now);
}

/** Sets canonical variant for a board and normalizes statuses across board variants. */
export function handleSetCanonicalVariant(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "setCanonicalVariant" }>,
): ProjectSnapshotV2 {
  const board = project.stateBoardsById[action.boardId];
  const variant = project.variantsById[action.variantId];
  if (!board || !variant || variant.boardId !== board.id || !board.variantIds.includes(variant.id)) return project;
  const nextVariants: Record<string, Variant> = { ...project.variantsById };
  for (const id of board.variantIds) {
    const current = nextVariants[id];
    if (!current) continue;
    const status: VariantStatus = id === variant.id ? "canonical" : current.status === "canonical" ? "draft" : current.status;
    nextVariants[id] = status === current.status ? current : { ...current, status };
  }
  const next = {
    ...project,
    stateBoardsById: { ...project.stateBoardsById, [board.id]: { ...board, canonicalVariantId: variant.id } },
    variantsById: nextVariants,
  };
  return touchVariant(next, variant.id, action.now);
}

/** Updates variant status and reassigns canonical variant when needed. */
export function handleSetVariantStatus(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "setVariantStatus" }>,
): ProjectSnapshotV2 {
  const variant = project.variantsById[action.variantId];
  if (!variant || variant.status === action.status) return project;
  const board = project.stateBoardsById[variant.boardId];
  if (!board) return project;
  let next: ProjectSnapshotV2 = {
    ...project,
    variantsById: { ...project.variantsById, [variant.id]: { ...variant, status: action.status } },
  };
  if (variant.id === board.canonicalVariantId && action.status === "archived") {
    const variants = board.variantIds.map((id) => next.variantsById[id]).filter((item): item is Variant => Boolean(item));
    const reassigned = reassignCanonicalAfterMutation(board, variants);
    next = { ...next, stateBoardsById: { ...next.stateBoardsById, [board.id]: { ...board, canonicalVariantId: reassigned.canonicalVariantId } } };
  }
  return touchVariant(next, variant.id, action.now);
}

export function handleReorderVariants(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "reorderVariants" }>,
): ProjectSnapshotV2 {
  const board = project.stateBoardsById[action.boardId];
  if (!board || action.orderedIds.length !== board.variantIds.length) return project;
  const expected = new Set(board.variantIds);
  if (!action.orderedIds.every((id) => expected.has(id)) || new Set(action.orderedIds).size !== expected.size) return project;
  if (action.orderedIds.every((id, index) => id === board.variantIds[index])) return project;
  return { ...project, stateBoardsById: { ...project.stateBoardsById, [board.id]: { ...board, variantIds: [...action.orderedIds] } } };
}

/** Deletes a variant and prunes its widget subtree while preserving board invariants. */
export function handleDeleteVariant(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "deleteVariant" }>,
): ProjectSnapshotV2 {
  const variant = project.variantsById[action.variantId];
  if (!variant) return project;
  const board = project.stateBoardsById[variant.boardId];
  if (!board || board.variantIds.length <= 1) return project;
  const nextVariantIds = board.variantIds.filter((id) => id !== variant.id);
  const variantsById = { ...project.variantsById };
  delete variantsById[variant.id];
  const nextBoard = { ...board, variantIds: nextVariantIds };
  const reassigned = reassignCanonicalAfterMutation(
    variant.id === board.canonicalVariantId ? { ...nextBoard, canonicalVariantId: variant.id } : nextBoard,
    nextVariantIds.map((id) => variantsById[id]).filter((item): item is Variant => Boolean(item)),
  );

  // Clean up tree node for deleted variant
  const sectionId = makeSectionId(variant.id);
  const treeNodesById = { ...project.treeNodesById };
  delete treeNodesById[sectionId];
  for (const [nodeId, node] of Object.entries(treeNodesById)) {
    if (node.kind === "screen_root" && (node as ScreenRootNode).childrenIds.includes(sectionId)) {
      treeNodesById[nodeId] = {
        ...node,
        childrenIds: (node as ScreenRootNode).childrenIds.filter((cid) => cid !== sectionId),
      };
    }
  }

  return {
    ...project,
    stateBoardsById: { ...project.stateBoardsById, [board.id]: { ...nextBoard, canonicalVariantId: reassigned.canonicalVariantId } },
    variantsById,
    widgetsById: pruneWidgetSubtree(project.widgetsById, variant.rootWidgetId),
    treeNodesById,
  };
}

export function handleMoveVariantScreen(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "moveVariantScreen" }>,
): ProjectSnapshotV2 {
  const variant = project.variantsById[action.variantId];
  if (!variant) return project;
  const root = project.widgetsById[variant.rootWidgetId];
  if (!root) return project;
  if (root.x === action.position.x && root.y === action.position.y) return project;
  const next: ProjectSnapshotV2 = {
    ...project,
    widgetsById: {
      ...project.widgetsById,
      [root.id]: { ...root, x: action.position.x, y: action.position.y },
    },
  };
  return touchVariant(next, variant.id, action.now);
}

/**
 * Inserts a widget into a variant subtree.
 * Guardrails:
 * - Parent must be a container widget.
 * - Parent must belong to the target variant tree.
 */
export function handleInsertVariantWidget(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "insertVariantWidget" }>,
): ProjectSnapshotV2 {
  const variant = project.variantsById[action.variantId];
  const parent = project.widgetsById[action.parentId];
  if (!variant || !parent || !INSERTABLE_WIDGET_TYPES.includes(action.widgetType)) return project;
  if (action.widgetId && project.widgetsById[action.widgetId]) return project;
  if (!CONTAINER_WIDGET_TYPES.has(parent.type)) return project;

  const variantWidgetIds = collectWidgetSubtreeIds(project.widgetsById, variant.rootWidgetId);
  if (!variantWidgetIds.has(parent.id)) return project;

  const widget = createWidgetNode(
    project,
    action.widgetType,
    Math.round(action.position.x),
    Math.round(action.position.y),
    action.widgetId,
  );
  const nextChildrenIds = [...parent.childrenIds, widget.id];
  const next: ProjectSnapshotV2 = {
    ...project,
    widgetsById: {
      ...project.widgetsById,
      [parent.id]: { ...parent, childrenIds: nextChildrenIds },
      [widget.id]: { ...widget, parentId: parent.id },
    },
  };
  return touchVariant(next, variant.id, action.now);
}

/**
 * Moves a widget between variant/section containers within the same board.
 * Prevents cycles and preserves ordering semantics for same-parent moves.
 */
export function handleMoveVariantWidget(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "moveVariantWidget" }>,
): ProjectSnapshotV2 {
  const widget = project.widgetsById[action.widgetId];
  const targetParent = project.widgetsById[action.targetParentId];
  const targetTreeNode = !targetParent ? project.treeNodesById?.[action.targetParentId] : undefined;
  const targetSection = targetTreeNode?.kind === "state_section" ? targetTreeNode : undefined;
  if (!widget || (!targetParent && !targetSection)) return project;
  if (targetParent && !CONTAINER_WIDGET_TYPES.has(targetParent.type)) return project;

  const owningVariantId = findVariantIdForWidget(project, widget.id);
  const targetVariantId = targetSection?.stateId ?? (targetParent ? findVariantIdForWidget(project, targetParent.id) : null);
  if (!owningVariantId || !targetVariantId) return project;

  const owningVariant = project.variantsById[owningVariantId];
  const targetVariant = project.variantsById[targetVariantId];
  if (!owningVariant || !targetVariant || owningVariant.boardId !== targetVariant.boardId) return project;
  if (widget.id === owningVariant.rootWidgetId) return project;
  if (widget.type === "Screen") return project;

  const sourceParent = widget.parentId ? project.widgetsById[widget.parentId] : null;
  const sourceSectionId = widget.parentId ? null : findSectionIdForRoot(project, widget.id);
  if (!sourceParent && !sourceSectionId) return project;

  const descendants = collectWidgetSubtreeIds(project.widgetsById, widget.id);
  if (targetParent && descendants.has(targetParent.id)) return project;

  const sourceSectionNode = sourceSectionId ? (project.treeNodesById?.[sourceSectionId]) : undefined;
  const sourceSiblings = sourceParent?.childrenIds ?? (sourceSectionNode?.kind === "state_section" ? sourceSectionNode.childrenIds : []);
  const sourceIndex = sourceSiblings.indexOf(widget.id);
  if (sourceIndex < 0) return project;

  const targetSiblings = targetParent?.childrenIds ?? targetSection?.childrenIds ?? [];
  const normalizedTargetIndex = Math.max(0, Math.min(action.targetIndex, targetSiblings.length));
  const sameParent = (sourceParent?.id ?? sourceSectionId) === (targetParent?.id ?? targetSection?.id);
  const adjustedTargetIndex = sameParent && sourceIndex < normalizedTargetIndex
    ? normalizedTargetIndex - 1
    : normalizedTargetIndex;
  if (sameParent && sourceIndex === adjustedTargetIndex) return project;

  const nextSourceChildren = [...sourceSiblings];
  nextSourceChildren.splice(sourceIndex, 1);
  const nextTargetChildren = sameParent ? nextSourceChildren : [...targetSiblings];
  nextTargetChildren.splice(adjustedTargetIndex, 0, widget.id);

  const widgetsById = { ...project.widgetsById };
  if (sourceParent) widgetsById[sourceParent.id] = { ...sourceParent, childrenIds: sameParent ? nextTargetChildren : nextSourceChildren };
  if (targetParent) widgetsById[targetParent.id] = { ...targetParent, childrenIds: nextTargetChildren };
  widgetsById[widget.id] = { ...widget, parentId: targetParent?.id ?? null };

  // Update treeNodesById for section children
  const treeNodesById = project.treeNodesById ? { ...project.treeNodesById } : {};
  if (sourceSectionId) {
    const srcNode = treeNodesById[sourceSectionId];
    if (srcNode && srcNode.kind === "state_section") {
      const nextIds = srcNode.childrenIds.filter((cid) => cid !== widget.id);
      if (nextIds.length !== srcNode.childrenIds.length) {
        treeNodesById[sourceSectionId] = { ...srcNode, childrenIds: nextIds };
      }
    }
  }
  if (targetSection && targetSection.id !== sourceSectionId) {
    const tgtNode = treeNodesById[targetSection.id] as typeof targetSection | undefined;
    if (tgtNode) {
      treeNodesById[targetSection.id] = {
        ...tgtNode,
        childrenIds: tgtNode.childrenIds.includes(widget.id) ? tgtNode.childrenIds : [...tgtNode.childrenIds, widget.id],
      };
    }
  }

  const next: ProjectSnapshotV2 = {
    ...project,
    widgetsById,
    treeNodesById,
  };
  return touchVariant(touchVariant(next, owningVariantId, action.now), targetVariantId, action.now);
}

/** Duplicates a section frame subtree and remaps ids/bindings to the cloned nodes. */
export function handleDuplicateSectionFrame(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "duplicateSectionFrame" }>,
): ProjectSnapshotV2 {
  const sectionNode = project.treeNodesById?.[action.sectionId];
  const section = sectionNode?.kind === "state_section" ? sectionNode : undefined;
  const variant = section ? project.variantsById[section.stateId] : undefined;
  const sourceRoot = project.widgetsById[action.frameId];
  if (!section || !variant || !sourceRoot || sourceRoot.type !== "Screen") return project;
  const sourceIds = [...collectWidgetSubtreeIds(project.widgetsById, sourceRoot.id)];
  const used = new Set(Object.keys(project.widgetsById));
  const idMap = new Map<string, string>();
  idMap.set(sourceRoot.id, makeCloneWidgetId(used, sourceRoot.id, action.newFrameId));
  for (const sourceId of sourceIds) {
    if (!idMap.has(sourceId)) idMap.set(sourceId, makeCloneWidgetId(used, sourceId));
  }

  const offset = action.offset ?? { x: 40, y: 40 };
  const newWidgets: Record<string, WidgetNode> = {};
  for (const sourceId of sourceIds) {
    const source = project.widgetsById[sourceId];
    const newId = idMap.get(sourceId);
    if (!source || !newId) continue;
    const isRoot = sourceId === sourceRoot.id;
    const cloned: WidgetNode = {
      ...source,
      id: newId,
      parentId: isRoot ? null : source.parentId ? idMap.get(source.parentId) ?? null : null,
      childrenIds: source.childrenIds.map((childId) => idMap.get(childId)).filter((id): id is string => Boolean(id)),
      x: isRoot ? source.x + offset.x : source.x,
      y: isRoot ? source.y + offset.y : source.y,
      ...(isRoot ? { frameRole: "draft" as const } : {}),
    };
    newWidgets[newId] = rewriteClonedBindings(cloned, idMap);
  }
  const newFrameId = idMap.get(sourceRoot.id);
  if (!newFrameId) return project;
  const next: ProjectSnapshotV2 = {
    ...project,
    widgetsById: { ...project.widgetsById, ...newWidgets },
    treeNodesById: {
      ...project.treeNodesById,
      [section.id]: {
        ...section,
        childrenIds: [...section.childrenIds, newFrameId],
      },
    },
  };
  return touchVariant(next, variant.id, action.now);
}

/** Deletes selected widget subtrees and updates affected sections/variants metadata. */
export function handleDeleteVariantWidgets(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "deleteVariantWidgets" }>,
): ProjectSnapshotV2 {
  const variantRootIds = new Set(Object.values(project.variantsById).map((variant) => variant.rootWidgetId));
  const roots = filterTopLevelWidgetIds(project, action.widgetIds)
    .filter((widgetId) => Boolean(project.widgetsById[widgetId]) && !variantRootIds.has(widgetId));
  if (roots.length === 0) return project;

  const touchedVariantIds = new Set<string>();
  for (const rootId of roots) {
    const variantId = findVariantIdForWidget(project, rootId);
    if (variantId) touchedVariantIds.add(variantId);
  }

  const { widgetsById, deletedIds } = removeWidgetSubtrees(project.widgetsById, roots);
  const treeNodesById = project.treeNodesById ? { ...project.treeNodesById } : {};
  for (const [nodeId, node] of Object.entries(treeNodesById)) {
    if (node.kind === "state_section") {
      const nextChildrenIds = node.childrenIds.filter((cid) => !deletedIds.has(cid));
      if (nextChildrenIds.length !== node.childrenIds.length) {
        treeNodesById[nodeId] = { ...node, childrenIds: nextChildrenIds };
      }
    }
  }

  let next: ProjectSnapshotV2 = {
    ...project,
    widgetsById,
    treeNodesById,
  };
  for (const variantId of touchedVariantIds) next = touchVariant(next, variantId, action.now);
  return next;
}

/** Duplicates selected widgets under target parent with id remapping and optional offset. */
export function handleDuplicateVariantWidgets(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "duplicateVariantWidgets" }>,
): ProjectSnapshotV2 {
  const variant = project.variantsById[action.variantId];
  if (!variant) return project;
  const variantWidgetIds = collectVariantWidgetIds(project, variant.id);
  const roots = filterTopLevelWidgetIds(project, action.widgetIds)
    .filter((widgetId) => variantWidgetIds.has(widgetId) && project.widgetsById[widgetId]?.type !== "Screen");
  if (roots.length === 0) return project;

  const targetParentId = action.targetParentId ?? project.widgetsById[roots[0]]?.parentId ?? variant.rootWidgetId;
  const targetParent = project.widgetsById[targetParentId];
  if (!targetParent || !variantWidgetIds.has(targetParent.id) || !CONTAINER_WIDGET_TYPES.has(targetParent.type)) return project;

  const sourceIds = roots.flatMap((rootId) => [...collectWidgetSubtreeIds(project.widgetsById, rootId)]);
  const used = new Set(Object.keys(project.widgetsById));
  const idMap = new Map<string, string>();
  roots.forEach((rootId, index) => {
    idMap.set(rootId, makeCloneWidgetId(used, rootId, action.rootWidgetIds?.[index]));
  });
  for (const sourceId of sourceIds) {
    if (!idMap.has(sourceId)) idMap.set(sourceId, makeCloneWidgetId(used, sourceId));
  }

  const newWidgets: Record<string, WidgetNode> = {};
  const offset = action.offset ?? { x: 16, y: 16 };
  for (const sourceId of sourceIds) {
    const source = project.widgetsById[sourceId];
    const newId = idMap.get(sourceId);
    if (!source || !newId) continue;
    const isRoot = roots.includes(sourceId);
    const cloned: WidgetNode = {
      ...source,
      id: newId,
      parentId: isRoot ? targetParent.id : source.parentId ? idMap.get(source.parentId) ?? targetParent.id : targetParent.id,
      childrenIds: source.childrenIds.map((childId) => idMap.get(childId)).filter((id): id is string => Boolean(id)),
      x: isRoot ? source.x + offset.x : source.x,
      y: isRoot ? source.y + offset.y : source.y,
    };
    newWidgets[newId] = rewriteClonedBindings(cloned, idMap);
  }

  const newRootIds = roots.map((rootId) => idMap.get(rootId)).filter((id): id is string => Boolean(id));
  const nextChildrenIds = [...targetParent.childrenIds];
  nextChildrenIds.splice(action.targetIndex ?? nextChildrenIds.length, 0, ...newRootIds);
  const next: ProjectSnapshotV2 = {
    ...project,
    widgetsById: {
      ...project.widgetsById,
      ...newWidgets,
      [targetParent.id]: { ...targetParent, childrenIds: nextChildrenIds },
    },
  };
  return touchVariant(next, variant.id, action.now);
}

/** Batch-updates widget positions, enforcing that all widgets belong to one variant. */
export function handleSetVariantWidgetPositions(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "setVariantWidgetPositions" }>,
): ProjectSnapshotV2 {
  const entries = Object.entries(action.positions);
  if (entries.length === 0) return project;

  let owningVariantId: string | null = null;
  let changed = false;
  const nextWidgetsById = { ...project.widgetsById };

  for (const [widgetId, position] of entries) {
    const widget = nextWidgetsById[widgetId];
    if (!widget) return project;

    const variantId = findVariantIdForWidget(project, widgetId);
    if (!variantId) return project;

    if (owningVariantId && owningVariantId !== variantId) return project;
    owningVariantId = variantId;

    const nextX = Math.round(position.x);
    const nextY = Math.round(position.y);
    if (widget.x === nextX && widget.y === nextY) continue;

    nextWidgetsById[widgetId] = {
      ...widget,
      x: nextX,
      y: nextY,
    };
    changed = true;
  }

  if (!changed || !owningVariantId) return project;
  return touchVariant({ ...project, widgetsById: nextWidgetsById }, owningVariantId, action.now);
}

export function handleSetVariantWidgetVisibility(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "setVariantWidgetVisibility" }>,
): ProjectSnapshotV2 {
  const widget = project.widgetsById[action.widgetId];
  if (!widget || widget.type === "Screen" || widget.visible === action.visible) return project;
  const variantId = findVariantIdForWidget(project, widget.id);
  if (!variantId) return project;
  const next: ProjectSnapshotV2 = {
    ...project,
    widgetsById: {
      ...project.widgetsById,
      [widget.id]: { ...widget, visible: action.visible },
    },
  };
  return touchVariant(next, variantId, action.now);
}

export function handleRenameWidget(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "renameWidget" }>,
): ProjectSnapshotV2 {
  const widget = project.widgetsById[action.widgetId];
  if (!widget || widget.name === action.name) return project;
  const variantId = findVariantIdForWidget(project, widget.id);
  let next: ProjectSnapshotV2 = {
    ...project,
    widgetsById: {
      ...project.widgetsById,
      [widget.id]: { ...widget, name: action.name },
    },
  };
  // P7: sync section name when canonical frame is renamed and section still uses default name
  if (variantId) {
    const variant = project.variantsById[variantId];
    if (variant?.rootWidgetId === widget.id) {
      const sectionId = makeSectionId(variant.id);
      const sectionNode = project.treeNodesById?.[sectionId];
      if (sectionNode?.kind === "state_section") {
        const stripSuffix = (n: string) => n.endsWith(" Root") ? n.slice(0, -5) : n;
        const oldDefault = `${stripSuffix(widget.name)} Section`;
        if (sectionNode.name === oldDefault) {
          const newDefault = `${stripSuffix(action.name)} Section`;
          next = {
            ...next,
            treeNodesById: {
              ...next.treeNodesById,
              [sectionId]: { ...sectionNode, name: newDefault },
            },
          };
        }
      }
    }
  }
  return variantId ? touchVariant(next, variantId, action.now) : next;
}

/** Updates board resolution and applies new dimensions to every frame (canonical + draft). */
export function handleSetBoardResolution(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "setBoardResolution" }>,
): ProjectSnapshotV2 {
  const board = project.stateBoardsById[action.boardId];
  if (!board || action.width <= 0 || action.height <= 0) return project;
  if (board.meta.width === action.width && board.meta.height === action.height) return project;
  const widgetsById = { ...project.widgetsById };
  const variantsById = { ...project.variantsById };
  for (const variantId of board.variantIds) {
    const variant = variantsById[variantId];
    const root = variant ? widgetsById[variant.rootWidgetId] : undefined;
    if (!variant || !root) continue;
    widgetsById[root.id] = { ...root, width: action.width, height: action.height };
    variantsById[variant.id] = {
      ...variant,
      updatedAt: action.now ?? new Date().toISOString(),
    };
    // Also resize draft frames in this variant's section
    const sectionId = makeSectionId(variant.id);
    const sectionNode = project.treeNodesById?.[sectionId];
    if (sectionNode?.kind === "state_section") {
      for (const childId of sectionNode.childrenIds) {
        if (childId !== variant.rootWidgetId) {
          const draftRoot = widgetsById[childId];
          if (draftRoot) widgetsById[childId] = { ...draftRoot, width: action.width, height: action.height };
        }
      }
    }
  }
  return {
    ...project,
    stateBoardsById: {
      ...project.stateBoardsById,
      [board.id]: { ...board, meta: { ...board.meta, width: action.width, height: action.height } },
    },
    variantsById,
    widgetsById,
  };
}

export function handleCreateSection(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "createSection" }>,
): ProjectSnapshotV2 {
  if (!project.variantsById[action.stateId]) return project;
  const sectionId = makeSectionId(action.stateId);
  const node = project.treeNodesById?.[sectionId];
  if (!action.name?.trim() || !node || node.kind !== "state_section") return project;
  return syncSectionIndexes({
    ...project,
    treeNodesById: {
      ...project.treeNodesById,
      [sectionId]: { ...node, name: action.name.trim() },
    },
  });
}

export function handleRenameSection(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "renameSection" }>,
): ProjectSnapshotV2 {
  const node = project.treeNodesById?.[action.sectionId];
  const name = action.name.trim();
  if (!node || node.kind !== "state_section" || !name || (node as StateSectionNode).name === name) return project;
  return {
    ...project,
    treeNodesById: {
      ...project.treeNodesById,
      [action.sectionId]: { ...node, name },
    },
  };
}

/** Binds section's canonical frame by promoting its variant to board canonical. */
export function handleBindCanonicalFrame(
  project: ProjectSnapshotV2,
  action: Extract<VariantAction, { type: "bindCanonicalFrame" }>,
): ProjectSnapshotV2 {
  const node = project.treeNodesById?.[action.sectionId];
  if (!node || node.kind !== "state_section") return project;
  const stateSection = node as StateSectionNode;
  const variant = project.variantsById[stateSection.stateId];
  if (!variant || variant.rootWidgetId !== action.canonicalFrameId) return project;
  const board = project.stateBoardsById[variant.boardId];
  if (!board) return project;
  return syncSectionIndexes(handleSetCanonicalVariant(project, {
    type: "setCanonicalVariant",
    boardId: board.id,
    variantId: variant.id,
    now: action.now,
  }));
}
