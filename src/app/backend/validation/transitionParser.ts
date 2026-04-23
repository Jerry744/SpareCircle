// Transition parser.
// Endpoint-existence checks (INV-5) happen in `navigationMapParser.ts` where
// the surrounding StateNode map is in scope.

import type { Transition } from "../types/navigationMap";
import { ID_PREFIX } from "../types/idPrefixes";
import { isRecord } from "./helpers";
import type { ParseResult } from "./parseResult";
import { parseFail, parseOk } from "./parseResult";

function parseWaypoints(
  input: unknown,
  path: string,
): ParseResult<Transition["waypoints"]> {
  if (input === undefined) return parseOk(undefined);
  if (!Array.isArray(input)) return parseFail(`${path} must be an array when provided`);
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index];
    if (!isRecord(raw)) return parseFail(`${path}[${index}] must be an object`);
    const { x, y } = raw;
    if (typeof x !== "number" || !Number.isFinite(x)) {
      return parseFail(`${path}[${index}].x must be a finite number`);
    }
    if (typeof y !== "number" || !Number.isFinite(y)) {
      return parseFail(`${path}[${index}].y must be a finite number`);
    }
    points.push({ x, y });
  }
  return parseOk(points);
}

export function parseTransition(input: unknown, path: string): ParseResult<Transition> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);

  const { id, fromStateNodeId, toStateNodeId, label, eventBindingId } = input;
  if (typeof id !== "string" || !id.startsWith(`${ID_PREFIX.transition}-`)) {
    return parseFail(`${path}.id must start with "${ID_PREFIX.transition}-"`);
  }
  if (typeof fromStateNodeId !== "string" || !fromStateNodeId.startsWith(`${ID_PREFIX.stateNode}-`)) {
    return parseFail(`${path}.fromStateNodeId must start with "${ID_PREFIX.stateNode}-"`);
  }
  if (typeof toStateNodeId !== "string" || !toStateNodeId.startsWith(`${ID_PREFIX.stateNode}-`)) {
    return parseFail(`${path}.toStateNodeId must start with "${ID_PREFIX.stateNode}-"`);
  }
  if (label !== undefined && typeof label !== "string") {
    return parseFail(`${path}.label must be a string when provided`);
  }
  if (
    eventBindingId !== undefined &&
    (typeof eventBindingId !== "string" ||
      !eventBindingId.startsWith(`${ID_PREFIX.transitionEventBinding}-`))
  ) {
    return parseFail(
      `${path}.eventBindingId must start with "${ID_PREFIX.transitionEventBinding}-" when provided`,
    );
  }

  const waypointsResult = parseWaypoints(input.waypoints, `${path}.waypoints`);
  if (!waypointsResult.ok) return waypointsResult;

  return parseOk({
    id,
    fromStateNodeId,
    toStateNodeId,
    label,
    eventBindingId,
    waypoints: waypointsResult.value,
  });
}
