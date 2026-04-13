export type WidgetType = "Screen" | "Container" | "Panel" | "Label" | "Button" | "Slider" | "Switch" | "Image";

export type EditableWidgetProperty = "x" | "y" | "width" | "height" | "text" | "fill" | "textColor" | "visible";
export type EditableWidgetPropertyValue = string | number | boolean;
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

export type StyleTokenType = "color";

export interface StyleToken {
  id: string;
  name: string;
  type: StyleTokenType;
  value: string;
}

export interface WidgetNode {
  id: string;
  name: string;
  type: WidgetType;
  parentId: string | null;
  childrenIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fill?: string;
  fillTokenId?: string;
  textColor?: string;
  textColorTokenId?: string;
  radius?: number;
  visible?: boolean;
  locked?: boolean;
  eventBindings?: WidgetEventBindings;
}

export interface ScreenMeta {
  width: number;
  height: number;
  fill?: string;
}

export interface ScreenModel {
  id: string;
  name: string;
  rootNodeId: string;
  meta: ScreenMeta;
}

export interface ProjectSnapshot {
  screens: ScreenModel[];
  activeScreenId: string;
  widgetsById: Record<string, WidgetNode>;
  styleTokens: StyleToken[];
}

export type HydrateProjectResult = { ok: true } | { ok: false; error: string };
export type ExportLvglResult = { ok: true; fileName: string } | { ok: false; error: string };

export interface HistoryState {
  past: ProjectSnapshot[];
  future: ProjectSnapshot[];
}

export interface Point {
  // World-space point used by canvas interactions.
  x: number;
  y: number;
}

export interface InteractionState {
  kind: "move" | "resize";
  widgetIds: string[];
  pointerStart: Point;
  startProject: ProjectSnapshot;
  handle?: "se";
}

export interface EditorState {
  project: ProjectSnapshot;
  selectedWidgetIds: string[];
  history: HistoryState;
  interaction: InteractionState | null;
}

export interface EditorBackendValue {
  state: EditorState;
  actions: {
    selectWidget: (widgetId: string, additive?: boolean) => void;
    clearSelection: () => void;
    setActiveScreen: (screenId: string) => void;
    createScreen: () => void;
    renameScreen: (screenId: string, name: string) => void;
    duplicateScreen: (screenId: string) => void;
    deleteScreen: (screenId: string) => void;
    beginInteraction: (kind: "move" | "resize", widgetIds: string[], pointer: Point, handle?: "se") => void;
    updateInteraction: (pointer: Point) => void;
    commitInteraction: () => void;
    cancelInteraction: () => void;
    addWidget: (parentId: string, widgetType: WidgetType, x: number, y: number) => void;
    moveWidget: (widgetId: string, targetParentId: string, targetIndex: number) => void;
    updateWidgetProperty: (
      widgetId: string,
      propertyName: EditableWidgetProperty,
      value: EditableWidgetPropertyValue,
    ) => void;
    clearWidgetProperty: (widgetId: string, propertyName: "fill" | "textColor") => void;
    createStyleToken: (name: string, value: string) => void;
    updateStyleToken: (tokenId: string, updates: { name?: string; value?: string }) => void;
    deleteStyleToken: (tokenId: string) => void;
    assignWidgetStyleToken: (widgetId: string, propertyName: "fill" | "textColor", tokenId: string | null) => void;
    upsertWidgetEventBinding: (widgetId: string, binding: EventBinding) => void;
    removeWidgetEventBinding: (widgetId: string, event: WidgetEventType) => void;
    updateScreenMeta: (screenId: string, key: "width" | "height" | "fill", value: EditableWidgetPropertyValue) => void;
    serializeProject: () => string;
    hydrateProject: (serializedProject: string) => HydrateProjectResult;
    exportLvglC: () => Promise<ExportLvglResult>;
    undo: () => void;
    redo: () => void;
  };
}

export const KNOWN_WIDGET_TYPES: WidgetType[] = ["Screen", "Container", "Panel", "Label", "Button", "Slider", "Switch", "Image"];
export const KNOWN_WIDGET_EVENTS: WidgetEventType[] = ["clicked", "pressed", "value_changed"];
export const KNOWN_WIDGET_ACTIONS: WidgetActionType[] = ["switch_screen", "toggle_visibility"];

export const WIDGET_EDITABLE_PROPERTIES: Record<WidgetType, ReadonlySet<EditableWidgetProperty>> = {
  Screen: new Set(["width", "height", "fill", "visible"]),
  Container: new Set(["x", "y", "width", "height", "fill", "visible"]),
  Panel: new Set(["x", "y", "width", "height", "fill", "visible"]),
  Label: new Set(["x", "y", "width", "height", "text", "textColor", "visible"]),
  Button: new Set(["x", "y", "width", "height", "text", "fill", "textColor", "visible"]),
  Slider: new Set(["x", "y", "width", "height", "fill", "visible"]),
  Switch: new Set(["x", "y", "width", "height", "fill", "visible"]),
  Image: new Set(["x", "y", "width", "height", "fill", "visible"]),
};

export const INSERTABLE_WIDGET_TYPES: WidgetType[] = ["Container", "Panel", "Label", "Button", "Image"];

export const CONTAINER_WIDGET_TYPES = new Set<WidgetType>(["Screen", "Container", "Panel"]);

export interface EditorAction {
  type: string;
  [key: string]: unknown;
}
