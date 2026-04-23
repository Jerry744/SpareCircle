import type { ProjectSnapshotV2 } from "../types/projectV2";
import type { StateBoard } from "../types/stateBoard";
import type { Variant } from "../types/variant";

export function isCanonical(board: StateBoard, variant: Variant): boolean {
  return board.canonicalVariantId === variant.id;
}

export function pickFallbackCanonical(
  board: StateBoard,
  variants: Variant[],
): Variant | null {
  if (variants.length === 0) return null;
  const byId = new Map(variants.map((item) => [item.id, item]));
  const existing = byId.get(board.canonicalVariantId);
  if (existing) return existing;
  return (
    variants.find((item) => item.status === "canonical") ??
    variants.find((item) => item.status === "draft") ??
    variants[0]
  );
}

export function reassignCanonicalAfterMutation(
  board: StateBoard,
  variants: Variant[],
): { canonicalVariantId: string; warning?: string } {
  const existing = variants.find(
    (item) => item.id === board.canonicalVariantId && item.status !== "archived",
  );
  if (existing) return { canonicalVariantId: existing.id };

  const active = variants.find((item) => item.status !== "archived");
  if (active) {
    return {
      canonicalVariantId: active.id,
      warning: "Canonical Variant was reassigned to the first non-archived Variant.",
    };
  }

  const fallback = variants[0];
  return fallback
    ? {
        canonicalVariantId: fallback.id,
        warning: "No non-archived Variant remains; Canonical points to an archived Variant.",
      }
    : { canonicalVariantId: board.canonicalVariantId, warning: "No Variant remains on this StateBoard." };
}

export function ensureCanonicalInvariant(
  project: ProjectSnapshotV2,
  boardId: string,
): ProjectSnapshotV2 {
  const board = project.stateBoardsById[boardId];
  if (!board) return project;
  const variants = board.variantIds
    .map((variantId) => project.variantsById[variantId])
    .filter((item): item is Variant => Boolean(item));
  const fallback = pickFallbackCanonical(board, variants);
  if (!fallback || fallback.id === board.canonicalVariantId) return project;
  return {
    ...project,
    stateBoardsById: {
      ...project.stateBoardsById,
      [boardId]: {
        ...board,
        canonicalVariantId: fallback.id,
      },
    },
  };
}
