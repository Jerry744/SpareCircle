export type WidgetEventType = "clicked" | "pressed" | "value_changed";
export type WidgetActionType = "switch_screen" | "toggle_visibility";

export interface SwitchScreenAction {
  type: "switch_screen";
  targetScreenId: string;
}

export interface ToggleVisibilityAction {
  type: "toggle_visibility";
  targetWidgetId: string;
}

export type WidgetEventAction = SwitchScreenAction | ToggleVisibilityAction;

export interface EventBinding {
  event: WidgetEventType;
  action: WidgetEventAction;
}

export type WidgetEventBindings = Partial<Record<WidgetEventType, EventBinding>>;

export const KNOWN_WIDGET_EVENTS: WidgetEventType[] = ["clicked", "pressed", "value_changed"];
export const KNOWN_WIDGET_ACTIONS: WidgetActionType[] = ["switch_screen", "toggle_visibility"];
