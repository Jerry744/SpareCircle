import type {
  EditableWidgetProperty,
  WidgetNode,
} from "../../backend/editorStore";

export const INSPECTOR_PANEL_CLASS = "h-full border-l border-neutral-900 bg-neutral-700 text-neutral-100";
export const INSPECTOR_INPUT_CLASS = "border border-neutral-600 bg-neutral-800 text-neutral-100 outline-none transition-colors focus:border-highlight-500";
export const INSPECTOR_SELECT_TRIGGER_CLASS = "h-8 w-full border-neutral-600 bg-neutral-800 text-[11px] text-neutral-200 focus:border-highlight-500 focus:ring-highlight-500/30";
export const INSPECTOR_SELECT_CONTENT_CLASS = "border-neutral-600 bg-neutral-800 text-neutral-100 shadow-xl";
export const INSPECTOR_SELECT_ITEM_CLASS = "text-neutral-200 focus:bg-highlight-900 focus:text-neutral-100 data-[state=checked]:bg-neutral-700";
export const INSPECTOR_SECTION_BUTTON_CLASS = "flex w-full items-center justify-between px-3 py-2 text-neutral-200 transition-colors hover:bg-neutral-600";
export const INSPECTOR_ERROR_CLASS = "text-[11px] text-error-400";

export type InspectorFieldType = "number" | "text" | "color" | "boolean";

export interface InspectorField {
  key: EditableWidgetProperty;
  label: string;
  type: InspectorFieldType;
  section: "position" | "style" | "text" | "flags" | "state";
  unit?: string;
  min?: number;
  max?: number;
  required?: boolean;
}

export type DraftMap = Partial<Record<EditableWidgetProperty, string | boolean>>;
export type ErrorMap = Partial<Record<EditableWidgetProperty, string>>;

export type ColorPropertyKey = Extract<EditableWidgetProperty, "fill" | "textColor">;

export const FIELD_CONFIG: Record<EditableWidgetProperty, InspectorField> = {
  x: { key: "x", label: "X", type: "number", section: "position", unit: "px", min: -4096, max: 4096 },
  y: { key: "y", label: "Y", type: "number", section: "position", unit: "px", min: -4096, max: 4096 },
  width: { key: "width", label: "Width", type: "number", section: "position", unit: "px", min: 24, max: 4096 },
  height: { key: "height", label: "Height", type: "number", section: "position", unit: "px", min: 24, max: 4096 },
  text: { key: "text", label: "Text", type: "text", section: "text" },
  fill: { key: "fill", label: "Background", type: "color", section: "style" },
  textColor: { key: "textColor", label: "Text Color", type: "color", section: "style" },
  visible: { key: "visible", label: "Visible", type: "boolean", section: "flags" },
  value: { key: "value", label: "Value", type: "number", section: "state", unit: "%", min: 0, max: 100 },
  checked: { key: "checked", label: "Checked", type: "boolean", section: "state" },
};

export const WIDGET_FIELD_SCHEMA: Record<WidgetNode["type"], EditableWidgetProperty[]> = {
  Screen: ["width", "height", "fill"],
  Container: ["x", "y", "width", "height", "fill", "visible"],
  Panel: ["x", "y", "width", "height", "fill", "visible"],
  Label: ["x", "y", "width", "height", "fill", "text", "textColor", "visible"],
  Button: ["x", "y", "width", "height", "fill", "textColor", "checked", "visible"],
  Slider: ["x", "y", "width", "height", "fill", "value", "visible"],
  Switch: ["x", "y", "width", "height", "fill", "checked", "visible"],
  Checkbox: ["x", "y", "width", "height", "text", "fill", "textColor", "checked", "visible"],
  Radio: ["x", "y", "width", "height", "fill", "textColor", "visible"],
  Dropdown: ["x", "y", "width", "height", "fill", "textColor", "visible"],
  Image: ["x", "y", "width", "height", "fill", "visible"],
};

export const WIDGET_HAS_CONTENT = new Set<WidgetNode["type"]>(["Label", "Button", "Checkbox", "Radio", "Dropdown"]);
export const WIDGET_HAS_INITIAL_STATE = new Set<WidgetNode["type"]>(["Slider", "Switch"]);
