import {
  KNOWN_WIDGET_EVENTS,
  type EventBinding,
  type WidgetEventBindings,
} from "../types";
import { isRecord, isWidgetEventType, isWidgetActionType } from "./helpers";

export function parseEventBinding(
  input: unknown,
  path: string,
): { ok: true; binding: EventBinding } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const event = input.event;
  if (!isWidgetEventType(event)) {
    return { ok: false, error: `${path}.event is invalid` };
  }

  const action = input.action;
  if (!isRecord(action) || !isWidgetActionType(action.type)) {
    return { ok: false, error: `${path}.action.type is invalid` };
  }

  if (action.type === "switch_screen") {
    if (typeof action.targetScreenId !== "string" || !action.targetScreenId.trim()) {
      return { ok: false, error: `${path}.action.targetScreenId must be a non-empty string` };
    }
    return {
      ok: true,
      binding: {
        event,
        action: { type: "switch_screen", targetScreenId: action.targetScreenId },
      },
    };
  }

  if (typeof action.targetWidgetId !== "string" || !action.targetWidgetId.trim()) {
    return { ok: false, error: `${path}.action.targetWidgetId must be a non-empty string` };
  }

  return {
    ok: true,
    binding: {
      event,
      action: { type: "toggle_visibility", targetWidgetId: action.targetWidgetId },
    },
  };
}

export function parseEventBindingsMap(
  input: unknown,
  path: string,
): { ok: true; eventBindings: WidgetEventBindings | undefined } | { ok: false; error: string } {
  if (input === undefined) {
    return { ok: true, eventBindings: undefined };
  }
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object when provided` };
  }

  const eventBindings: WidgetEventBindings = {};
  for (const event of KNOWN_WIDGET_EVENTS) {
    const bindingRaw = input[event];
    if (bindingRaw === undefined) continue;

    const parsed = parseEventBinding(bindingRaw, `${path}.${event}`);
    if (!parsed.ok) return parsed;
    if (parsed.binding.event !== event) {
      return { ok: false, error: `${path}.${event}.event must match its map key` };
    }
    eventBindings[event] = parsed.binding;
  }

  return {
    ok: true,
    eventBindings: Object.keys(eventBindings).length > 0 ? eventBindings : undefined,
  };
}
