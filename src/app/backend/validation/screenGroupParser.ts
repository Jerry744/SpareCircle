// ScreenGroup parser.
// Cross-references against StateNode membership are applied in
// `projectV2Parser.ts`; here we only validate shape and invariants that are
// self-contained.

import type { ScreenGroup } from "../types/screenGroup";
import { ID_PREFIX } from "../types/idPrefixes";
import { isRecord, isValidColorString } from "./helpers";
import type { ParseResult } from "./parseResult";
import { parseFail, parseOk } from "./parseResult";

export function parseScreenGroup(input: unknown, path: string): ParseResult<ScreenGroup> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);

  const { id, name, color, description, exportScreenName, stateNodeIds } = input;

  if (typeof id !== "string" || !id.startsWith(`${ID_PREFIX.screenGroup}-`)) {
    return parseFail(`${path}.id must start with "${ID_PREFIX.screenGroup}-"`);
  }
  if (typeof name !== "string" || !name.trim()) {
    return parseFail(`${path}.name must be a non-empty string`);
  }
  if (typeof color !== "string" || !isValidColorString(color)) {
    return parseFail(`${path}.color must be a valid hex color`);
  }
  if (description !== undefined && typeof description !== "string") {
    return parseFail(`${path}.description must be a string when provided`);
  }
  if (exportScreenName !== undefined && typeof exportScreenName !== "string") {
    return parseFail(`${path}.exportScreenName must be a string when provided`);
  }
  if (!Array.isArray(stateNodeIds)) {
    return parseFail(`${path}.stateNodeIds must be an array`);
  }
  const seen = new Set<string>();
  for (let index = 0; index < stateNodeIds.length; index += 1) {
    const value = stateNodeIds[index];
    if (typeof value !== "string" || !value.startsWith(`${ID_PREFIX.stateNode}-`)) {
      return parseFail(`${path}.stateNodeIds[${index}] must start with "${ID_PREFIX.stateNode}-"`);
    }
    if (seen.has(value)) {
      return parseFail(`${path}.stateNodeIds[${index}] "${value}" is duplicated`);
    }
    seen.add(value);
  }

  return parseOk({
    id,
    name,
    color,
    description,
    exportScreenName,
    stateNodeIds: [...stateNodeIds] as string[],
  });
}
