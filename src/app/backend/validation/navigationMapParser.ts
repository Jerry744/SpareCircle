// Navigation Map parser.
// Covers INV-1 (initialStateNodeId must exist) and INV-5 (transition endpoints
// must exist). See `dev-plan/interaction-design-framework/01-data-model.md` §4.

import type {
  NavigationMap,
  NavMapPoint,
  NavMapViewport,
  StateNode,
  Transition,
} from "../types/navigationMap";
import { DEFAULT_NAV_MAP_VIEWPORT } from "../types/navigationMap";
import { ID_PREFIX } from "../types/idPrefixes";
import { isRecord, isValidColorString } from "./helpers";
import { parseTransition } from "./transitionParser";
import type { ParseResult } from "./parseResult";
import { parseFail, parseOk } from "./parseResult";

function parsePoint(input: unknown, path: string): ParseResult<NavMapPoint> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);
  const { x, y } = input;
  if (typeof x !== "number" || !Number.isFinite(x)) return parseFail(`${path}.x must be a finite number`);
  if (typeof y !== "number" || !Number.isFinite(y)) return parseFail(`${path}.y must be a finite number`);
  return parseOk({ x, y });
}

function parseViewport(input: unknown, path: string): ParseResult<NavMapViewport> {
  if (input === undefined) return parseOk({ ...DEFAULT_NAV_MAP_VIEWPORT });
  if (!isRecord(input)) return parseFail(`${path} must be an object`);
  const { x, y, zoom } = input;
  if (typeof x !== "number" || !Number.isFinite(x)) return parseFail(`${path}.x must be a finite number`);
  if (typeof y !== "number" || !Number.isFinite(y)) return parseFail(`${path}.y must be a finite number`);
  if (typeof zoom !== "number" || !Number.isFinite(zoom) || zoom <= 0) {
    return parseFail(`${path}.zoom must be a positive finite number`);
  }
  return parseOk({ x, y, zoom });
}

function parseStateNode(input: unknown, path: string): ParseResult<StateNode> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);

  const { id, name, boardId } = input;
  if (typeof id !== "string" || !id.startsWith(`${ID_PREFIX.stateNode}-`)) {
    return parseFail(`${path}.id must start with "${ID_PREFIX.stateNode}-"`);
  }
  if (typeof name !== "string" || !name.trim()) return parseFail(`${path}.name must be a non-empty string`);
  if (typeof boardId !== "string" || !boardId.startsWith(`${ID_PREFIX.stateBoard}-`)) {
    return parseFail(`${path}.boardId must start with "${ID_PREFIX.stateBoard}-"`);
  }

  const positionResult = parsePoint(input.position, `${path}.position`);
  if (!positionResult.ok) return positionResult;

  const { description, color, screenGroupId, isNavigationState } = input;
  if (description !== undefined && typeof description !== "string") {
    return parseFail(`${path}.description must be a string when provided`);
  }
  if (color !== undefined && (typeof color !== "string" || !isValidColorString(color))) {
    return parseFail(`${path}.color must be a valid hex color when provided`);
  }
  if (screenGroupId !== undefined && (typeof screenGroupId !== "string" || !screenGroupId.trim())) {
    return parseFail(`${path}.screenGroupId must be a non-empty string when provided`);
  }
  if (typeof isNavigationState !== "boolean") {
    return parseFail(`${path}.isNavigationState must be a boolean`);
  }

  return parseOk({
    id,
    name,
    description,
    color,
    position: positionResult.value,
    boardId,
    screenGroupId,
    isNavigationState,
  });
}

function parseIdOrderArray(
  input: unknown,
  path: string,
  existingIds: Set<string>,
): ParseResult<string[]> {
  if (!Array.isArray(input)) return parseFail(`${path} must be an array`);
  const seen = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    const value = input[index];
    if (typeof value !== "string" || !value.trim()) {
      return parseFail(`${path}[${index}] must be a non-empty string`);
    }
    if (!existingIds.has(value)) {
      return parseFail(`${path}[${index}] "${value}" is not a known id`);
    }
    if (seen.has(value)) {
      return parseFail(`${path}[${index}] "${value}" is duplicated`);
    }
    seen.add(value);
  }
  for (const id of existingIds) {
    if (!seen.has(id)) return parseFail(`${path} is missing id "${id}"`);
  }
  return parseOk([...input]);
}

export function parseNavigationMap(input: unknown, path = "navigationMap"): ParseResult<NavigationMap> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);

  const stateNodesRaw = input.stateNodes;
  if (!isRecord(stateNodesRaw)) return parseFail(`${path}.stateNodes must be an object`);

  const stateNodes: Record<string, StateNode> = {};
  for (const [key, rawNode] of Object.entries(stateNodesRaw)) {
    const parsed = parseStateNode(rawNode, `${path}.stateNodes["${key}"]`);
    if (!parsed.ok) return parsed;
    if (parsed.value.id !== key) {
      return parseFail(`${path}.stateNodes["${key}"].id must equal the record key`);
    }
    stateNodes[key] = parsed.value;
  }

  const stateNodeIds = new Set(Object.keys(stateNodes));

  const stateNodeOrderResult = parseIdOrderArray(
    input.stateNodeOrder,
    `${path}.stateNodeOrder`,
    stateNodeIds,
  );
  if (!stateNodeOrderResult.ok) return stateNodeOrderResult;

  const transitionsRaw = input.transitions;
  if (!isRecord(transitionsRaw)) return parseFail(`${path}.transitions must be an object`);

  const transitions: Record<string, Transition> = {};
  for (const [key, rawTransition] of Object.entries(transitionsRaw)) {
    const parsed = parseTransition(rawTransition, `${path}.transitions["${key}"]`);
    if (!parsed.ok) return parsed;
    if (parsed.value.id !== key) {
      return parseFail(`${path}.transitions["${key}"].id must equal the record key`);
    }
    // INV-5: endpoints must reference existing nodes.
    if (!stateNodeIds.has(parsed.value.fromStateNodeId)) {
      return parseFail(
        `${path}.transitions["${key}"].fromStateNodeId "${parsed.value.fromStateNodeId}" is not a known state node`,
      );
    }
    if (!stateNodeIds.has(parsed.value.toStateNodeId)) {
      return parseFail(
        `${path}.transitions["${key}"].toStateNodeId "${parsed.value.toStateNodeId}" is not a known state node`,
      );
    }
    transitions[key] = parsed.value;
  }

  const transitionIds = new Set(Object.keys(transitions));
  const transitionOrderResult = parseIdOrderArray(
    input.transitionOrder,
    `${path}.transitionOrder`,
    transitionIds,
  );
  if (!transitionOrderResult.ok) return transitionOrderResult;

  const initialStateNodeId = input.initialStateNodeId;
  if (typeof initialStateNodeId !== "string" || !stateNodeIds.has(initialStateNodeId)) {
    // INV-1: initial state must exist.
    return parseFail(`${path}.initialStateNodeId must reference an existing state node`);
  }

  const viewportResult = parseViewport(input.viewport, `${path}.viewport`);
  if (!viewportResult.ok) return viewportResult;

  return parseOk({
    stateNodes,
    stateNodeOrder: stateNodeOrderResult.value,
    transitions,
    transitionOrder: transitionOrderResult.value,
    initialStateNodeId,
    viewport: viewportResult.value,
  });
}

// Best-effort recovery when a stale project references a deleted initial state.
// Falls back to the first node in insertion order; returns the original map
// untouched when no recovery is needed.
export function ensureInitialStateExists(map: NavigationMap): NavigationMap {
  if (map.stateNodes[map.initialStateNodeId]) return map;
  const fallback = map.stateNodeOrder.find((id) => map.stateNodes[id]);
  if (!fallback) return map;
  return { ...map, initialStateNodeId: fallback };
}
