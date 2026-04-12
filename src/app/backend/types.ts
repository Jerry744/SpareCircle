export type WidgetType = "Screen" | "Container" | "Panel" | "Label" | "Button" | "Slider" | "Switch" | "Image";

export type EditableWidgetProperty = "x" | "y" | "width" | "height" | "text" | "fill" | "textColor" | "visible";
export type EditableWidgetPropertyValue = string | number | boolean;

export interface WidgetNode {
  id: string;
  name: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fill?: string;
  textColor?: string;
  radius?: number;
  visible?: boolean;
  locked?: boolean;
  children: WidgetNode[];
}

export interface ScreenModel {
  id: string;
  name: string;
  width: number;
  height: number;
  rootWidget: WidgetNode;
}

export interface ProjectSnapshot {
  screens: ScreenModel[];
  activeScreenId: string;
}

export type HydrateProjectResult = { ok: true } | { ok: false; error: string };

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
    serializeProject: () => string;
    hydrateProject: (serializedProject: string) => HydrateProjectResult;
    undo: () => void;
    redo: () => void;
  };
}

export const KNOWN_WIDGET_TYPES: WidgetType[] = ["Screen", "Container", "Panel", "Label", "Button", "Slider", "Switch", "Image"];

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
