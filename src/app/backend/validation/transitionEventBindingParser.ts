// TransitionEventBinding parser.
// Checks trigger payload shape and id format; existence of the referenced
// transition/widget (INV-6, INV-7) and the uniqueness rule (INV-8) are
// enforced in `projectV2Parser.ts` where the surrounding maps are available.

import type {
  SystemEventTrigger,
  TransitionEventBinding,
  TransitionTriggerKind,
  WidgetEventTrigger,
} from "../types/eventBinding";
import { SYSTEM_EVENT_TYPES } from "../types/eventBinding";
import { ID_PREFIX } from "../types/idPrefixes";
import { isRecord, isWidgetEventType } from "./helpers";
import type { ParseResult } from "./parseResult";
import { parseFail, parseOk } from "./parseResult";

function parsePayload(
  input: unknown,
  path: string,
): ParseResult<Record<string, string | number> | undefined> {
  if (input === undefined) return parseOk(undefined);
  if (!isRecord(input)) return parseFail(`${path} must be an object when provided`);
  const normalized: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      normalized[key] = value;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      normalized[key] = value;
      continue;
    }
    return parseFail(`${path}.${key} must be a string or finite number`);
  }
  return parseOk(normalized);
}

function parseTrigger(input: unknown, path: string): ParseResult<TransitionTriggerKind> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);
  const { kind } = input;
  if (kind === "widget_event") {
    const { widgetId, eventType } = input;
    if (typeof widgetId !== "string" || !widgetId.trim()) {
      return parseFail(`${path}.widgetId must be a non-empty string`);
    }
    if (!isWidgetEventType(eventType)) {
      return parseFail(`${path}.eventType must be a known widget event type`);
    }
    const trigger: WidgetEventTrigger = { kind: "widget_event", widgetId, eventType };
    return parseOk(trigger);
  }
  if (kind === "system_event") {
    const { eventType } = input;
    if (
      typeof eventType !== "string" ||
      !SYSTEM_EVENT_TYPES.includes(eventType as (typeof SYSTEM_EVENT_TYPES)[number])
    ) {
      return parseFail(`${path}.eventType must be one of ${SYSTEM_EVENT_TYPES.join(", ")}`);
    }
    const payloadResult = parsePayload(input.payload, `${path}.payload`);
    if (!payloadResult.ok) return payloadResult;
    const trigger: SystemEventTrigger = {
      kind: "system_event",
      eventType: eventType as SystemEventTrigger["eventType"],
      payload: payloadResult.value,
    };
    return parseOk(trigger);
  }
  return parseFail(`${path}.kind must be "widget_event" or "system_event"`);
}

export function parseTransitionEventBinding(
  input: unknown,
  path: string,
): ParseResult<TransitionEventBinding> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);

  const { id, transitionId, guard, createdAt } = input;
  if (typeof id !== "string" || !id.startsWith(`${ID_PREFIX.transitionEventBinding}-`)) {
    return parseFail(`${path}.id must start with "${ID_PREFIX.transitionEventBinding}-"`);
  }
  if (typeof transitionId !== "string" || !transitionId.startsWith(`${ID_PREFIX.transition}-`)) {
    return parseFail(`${path}.transitionId must start with "${ID_PREFIX.transition}-"`);
  }
  if (guard !== undefined && typeof guard !== "string") {
    return parseFail(`${path}.guard must be a string when provided`);
  }
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) {
    return parseFail(`${path}.createdAt must be a valid ISO-8601 timestamp`);
  }

  const triggerResult = parseTrigger(input.trigger, `${path}.trigger`);
  if (!triggerResult.ok) return triggerResult;

  return parseOk({
    id,
    transitionId,
    trigger: triggerResult.value,
    guard,
    createdAt,
  });
}
