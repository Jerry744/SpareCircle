import type { StyleToken } from "../types";
import { isRecord, isValidHexColorString } from "./helpers";

export function parseStyleToken(
  input: unknown,
  path: string,
): { ok: true; token: StyleToken } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const { id, name, type, value } = input;
  if (typeof id !== "string" || !id.trim()) return { ok: false, error: `${path}.id must be a non-empty string` };
  if (typeof name !== "string" || !name.trim()) return { ok: false, error: `${path}.name must be a non-empty string` };
  if (type !== "color") return { ok: false, error: `${path}.type is invalid` };
  if (typeof value !== "string" || !isValidHexColorString(value)) {
    return { ok: false, error: `${path}.value must be a valid hex color` };
  }

  return {
    ok: true,
    token: { id, name, type, value: value.trim() },
  };
}

export function parseStyleTokens(
  input: unknown,
): { ok: true; tokens: StyleToken[] } | { ok: false; error: string } {
  if (input === undefined) return { ok: true, tokens: [] };
  if (!Array.isArray(input)) return { ok: false, error: "Project.styleTokens must be an array" };

  const tokens: StyleToken[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (let index = 0; index < input.length; index += 1) {
    const parsed = parseStyleToken(input[index], `Project.styleTokens[${index}]`);
    if (!parsed.ok) return parsed;
    if (seenIds.has(parsed.token.id)) return { ok: false, error: `Project.styleTokens[${index}].id must be unique` };
    if (seenNames.has(parsed.token.name)) return { ok: false, error: `Project.styleTokens[${index}].name must be unique` };
    seenIds.add(parsed.token.id);
    seenNames.add(parsed.token.name);
    tokens.push(parsed.token);
  }

  return { ok: true, tokens };
}
