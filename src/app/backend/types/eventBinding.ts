// TransitionEventBinding domain types.
// Corresponds to `dev-plan/interaction-design-framework/01-data-model.md` §3.5.
// This model is *new* and does NOT replace the existing widget-local
// `WidgetEventBindings` defined in `./event.ts`. The legacy model stays
// so the v1 editor keeps working; the v2 migration lifts legacy bindings
// into TransitionEventBinding records (see module 11-migration).

import type { WidgetEventType } from "./event";

export type SystemEventType =
  | "timer"
  | "sensor_input"
  | "callback"
  | "lifecycle_enter"
  | "lifecycle_leave"
  | "custom";

export const SYSTEM_EVENT_TYPES: SystemEventType[] = [
  "timer",
  "sensor_input",
  "callback",
  "lifecycle_enter",
  "lifecycle_leave",
  "custom",
];

export interface WidgetEventTrigger {
  kind: "widget_event";
  widgetId: string;
  eventType: WidgetEventType;
}

export interface SystemEventTrigger {
  kind: "system_event";
  eventType: SystemEventType;
  // Free-form payload preserved verbatim. Values are limited to string/number
  // so JSON round-trips remain stable across platforms.
  payload?: Record<string, string | number>;
}

export type TransitionTriggerKind = WidgetEventTrigger | SystemEventTrigger;

export interface TransitionEventBinding {
  id: string;
  transitionId: string;
  trigger: TransitionTriggerKind;
  // Free-text condition authored by engineers; never parsed by the platform.
  // Used to document preconditions that cannot be encoded structurally yet.
  guard?: string;
  createdAt: string;
}
