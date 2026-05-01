// Variant parser.
// INV-4 (rootWidgetId must point to a Screen widget with parentId=null) is
// enforced in `projectV2Parser.ts` because it requires the widgetsById map.

import type { Variant, VariantStatus } from "../types/variant";
import { VARIANT_STATUSES } from "../types/variant";
import { ID_PREFIX } from "../types/idPrefixes";
import { isRecord } from "./helpers";
import type { ParseResult } from "./parseResult";
import { parseFail, parseOk } from "./parseResult";

function isVariantStatus(value: unknown): value is VariantStatus {
  return typeof value === "string" && VARIANT_STATUSES.includes(value as VariantStatus);
}

function parseIsoTimestamp(value: unknown, path: string): ParseResult<string> {
  if (typeof value !== "string" || !value.trim()) {
    return parseFail(`${path} must be a non-empty ISO-8601 timestamp string`);
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return parseFail(`${path} must be a valid ISO-8601 timestamp`);
  }
  return parseOk(value);
}

export function parseVariant(input: unknown, path: string): ParseResult<Variant> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);

  const { id, boardId, name, status, rootWidgetId, canonicalFrameId, description } = input;

  if (typeof id !== "string" || !id.startsWith(`${ID_PREFIX.variant}-`)) {
    return parseFail(`${path}.id must start with "${ID_PREFIX.variant}-"`);
  }
  if (typeof boardId !== "string" || !boardId.startsWith(`${ID_PREFIX.stateBoard}-`)) {
    return parseFail(`${path}.boardId must start with "${ID_PREFIX.stateBoard}-"`);
  }
  if (typeof name !== "string" || !name.trim()) {
    return parseFail(`${path}.name must be a non-empty string`);
  }
  if (!isVariantStatus(status)) {
    return parseFail(`${path}.status must be one of ${VARIANT_STATUSES.join(", ")}`);
  }
  const canonicalFrameIdValue = typeof canonicalFrameId === "string" && canonicalFrameId.trim()
    ? canonicalFrameId
    : typeof rootWidgetId === "string" && rootWidgetId.trim()
      ? rootWidgetId
      : null;
  if (!canonicalFrameIdValue) {
    return parseFail(`${path}.canonicalFrameId must be a non-empty string`);
  }
  if (rootWidgetId !== undefined && (typeof rootWidgetId !== "string" || !rootWidgetId.trim())) {
    return parseFail(`${path}.rootWidgetId must be a non-empty string when provided`);
  }
  if (typeof rootWidgetId === "string" && rootWidgetId.trim() && rootWidgetId !== canonicalFrameIdValue) {
    return parseFail(`${path}.rootWidgetId must equal ${path}.canonicalFrameId during migration`);
  }
  if (description !== undefined && typeof description !== "string") {
    return parseFail(`${path}.description must be a string when provided`);
  }

  const createdAtResult = parseIsoTimestamp(input.createdAt, `${path}.createdAt`);
  if (!createdAtResult.ok) return createdAtResult;
  const updatedAtResult = parseIsoTimestamp(input.updatedAt, `${path}.updatedAt`);
  if (!updatedAtResult.ok) return updatedAtResult;

  return parseOk({
    id,
    boardId,
    name,
    status,
    canonicalFrameId: canonicalFrameIdValue,
    rootWidgetId: typeof rootWidgetId === "string" && rootWidgetId.trim() ? rootWidgetId : canonicalFrameIdValue,
    description,
    createdAt: createdAtResult.value,
    updatedAt: updatedAtResult.value,
  });
}
