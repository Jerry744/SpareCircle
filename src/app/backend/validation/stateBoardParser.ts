// StateBoard parser.
// Enforces INV-3 (canonicalVariantId must live inside variantIds). The
// stronger form of INV-3 that also checks variantsById membership is applied
// in `projectV2Parser.ts` where the Variants map is in scope.

import type { StateBoard, StateBoardMeta } from "../types/stateBoard";
import type { Variant } from "../types/variant";
import { ID_PREFIX } from "../types/idPrefixes";
import { isRecord, isValidColorString } from "./helpers";
import type { ParseResult } from "./parseResult";
import { parseFail, parseOk } from "./parseResult";

function parseMeta(input: unknown, path: string): ParseResult<StateBoardMeta> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);
  const { width, height, fill } = input;
  if (typeof width !== "number" || !Number.isFinite(width) || width < 24) {
    return parseFail(`${path}.width must be a number >= 24`);
  }
  if (typeof height !== "number" || !Number.isFinite(height) || height < 24) {
    return parseFail(`${path}.height must be a number >= 24`);
  }
  if (fill !== undefined && (typeof fill !== "string" || !isValidColorString(fill))) {
    return parseFail(`${path}.fill must be a valid hex color when provided`);
  }
  return parseOk({ width, height, fill });
}

export function parseStateBoard(input: unknown, path: string): ParseResult<StateBoard> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);

  const { id, stateNodeId, variantIds, canonicalVariantId, notes } = input;

  if (typeof id !== "string" || !id.startsWith(`${ID_PREFIX.stateBoard}-`)) {
    return parseFail(`${path}.id must start with "${ID_PREFIX.stateBoard}-"`);
  }
  if (typeof stateNodeId !== "string" || !stateNodeId.startsWith(`${ID_PREFIX.stateNode}-`)) {
    return parseFail(`${path}.stateNodeId must start with "${ID_PREFIX.stateNode}-"`);
  }
  if (!Array.isArray(variantIds) || variantIds.length === 0) {
    return parseFail(`${path}.variantIds must be a non-empty array`);
  }
  const seen = new Set<string>();
  for (let index = 0; index < variantIds.length; index += 1) {
    const value = variantIds[index];
    if (typeof value !== "string" || !value.startsWith(`${ID_PREFIX.variant}-`)) {
      return parseFail(`${path}.variantIds[${index}] must start with "${ID_PREFIX.variant}-"`);
    }
    if (seen.has(value)) {
      return parseFail(`${path}.variantIds[${index}] "${value}" is duplicated`);
    }
    seen.add(value);
  }
  if (typeof canonicalVariantId !== "string" || !seen.has(canonicalVariantId)) {
    // INV-3 (structural half): canonicalVariantId must be part of the list.
    return parseFail(`${path}.canonicalVariantId must be one of variantIds`);
  }
  if (notes !== undefined && typeof notes !== "string") {
    return parseFail(`${path}.notes must be a string when provided`);
  }

  const metaResult = parseMeta(input.meta, `${path}.meta`);
  if (!metaResult.ok) return metaResult;

  return parseOk({
    id,
    stateNodeId,
    meta: metaResult.value,
    variantIds: [...variantIds] as string[],
    canonicalVariantId,
    notes,
  });
}

// Recovery helper used by migrations: if the canonical pointer is stale
// (e.g. the Variant was archived elsewhere), pick the first Variant as a
// deterministic fallback. Returns the original board unchanged when the
// canonical pointer is still consistent.
export function ensureCanonicalVariant(board: StateBoard, variants: Variant[]): StateBoard {
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const canonical = byId.get(board.canonicalVariantId);
  if (canonical && canonical.boardId === board.id) return board;
  const fallback = board.variantIds.find((id) => byId.get(id)?.boardId === board.id);
  if (!fallback) return board;
  return { ...board, canonicalVariantId: fallback };
}
