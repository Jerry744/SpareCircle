import type { ProjectSnapshotV2 } from "../types/projectV2";
import type { StateBoard } from "../types/stateBoard";
import type { Variant, VariantStatus } from "../types/variant";
import type { WidgetNode } from "../types/widget";
import { DEFAULT_STATE_BOARD_META } from "../types/stateBoard";
import { ID_PREFIX, makeId } from "../types/idPrefixes";
import { cloneVariant } from "../stateBoard/variantCloning";
import { reassignCanonicalAfterMutation } from "../stateBoard/variantHelpers";
import { touchVariant } from "./helpers";
import type { VariantAction } from "./variantActions";

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

function makeBlankRoot(id: string, name: string): WidgetNode {
  return {
    id,
    name: `${name} Root`,
    type: "Screen",
    parentId: null,
    childrenIds: [],
    x: 0,
    y: 0,
    width: DEFAULT_STATE_BOARD_META.width,
    height: DEFAULT_STATE_BOARD_META.height,
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
    return {
      ...project,
      stateBoardsById: { ...project.stateBoardsById, [board.id]: { ...board, variantIds: [...board.variantIds, variantId] } },
      variantsById: { ...project.variantsById, [variantId]: newVariant },
      widgetsById: { ...project.widgetsById, ...newWidgets },
    };
  }
  const rootWidgetId = action.rootWidgetId ?? `${variantId}-root`;
  const variant: Variant = { id: variantId, boardId: board.id, name, status: "draft", rootWidgetId, createdAt: now, updatedAt: now };
  return {
    ...project,
    stateBoardsById: { ...project.stateBoardsById, [board.id]: { ...board, variantIds: [...board.variantIds, variantId] } },
    variantsById: { ...project.variantsById, [variantId]: variant },
    widgetsById: { ...project.widgetsById, [rootWidgetId]: makeBlankRoot(rootWidgetId, name) },
  };
}

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
  return {
    ...project,
    stateBoardsById: { ...project.stateBoardsById, [board.id]: { ...nextBoard, canonicalVariantId: reassigned.canonicalVariantId } },
    variantsById,
    widgetsById: pruneWidgetSubtree(project.widgetsById, variant.rootWidgetId),
  };
}

export function variantReducer(project: ProjectSnapshotV2, action: VariantAction): ProjectSnapshotV2 {
  switch (action.type) {
    case "createVariant": return handleCreateVariant(project, action);
    case "renameVariant": return handleRenameVariant(project, action);
    case "duplicateVariant": return handleCreateVariant(project, {
      type: "createVariant", boardId: project.variantsById[action.variantId]?.boardId ?? "",
      mode: "copy_of", sourceVariantId: action.variantId, name: action.name, variantId: action.variantIdOverride, now: action.now,
    });
    case "setCanonicalVariant": return handleSetCanonicalVariant(project, action);
    case "setVariantStatus": return handleSetVariantStatus(project, action);
    case "reorderVariants": return handleReorderVariants(project, action);
    case "deleteVariant": return handleDeleteVariant(project, action);
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return project;
    }
  }
}
