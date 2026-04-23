// Compatibility re-export shim. Domain types live under ./types/.
// Legacy v1 model:
export * from "./types/widget";
export * from "./types/event";
export * from "./types/style";
export * from "./types/asset";
export * from "./types/project";
export * from "./types/editor";

// v2 state-machine model (introduced in Phase 1 – 01-data-model.md).
// These types are additive; the runtime still reads/writes v1 until
// later phases migrate the reducer/persistence layer.
export * from "./types/idPrefixes";
export * from "./types/navigationMap";
export * from "./types/navMapSelection";
export * from "./types/stateBoard";
export * from "./types/variant";
export * from "./types/screenGroup";
export {
  type SystemEventType,
  type WidgetEventTrigger,
  type SystemEventTrigger,
  type TransitionTriggerKind,
  type TransitionEventBinding,
  SYSTEM_EVENT_TYPES,
} from "./types/eventBinding";
export * from "./types/snapshot";
export * from "./types/mode";
export * from "./types/zoomLevel";
export * from "./types/projectV2";
