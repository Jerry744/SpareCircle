import type { WidgetEventBindings } from "./event";

export type WidgetType =
  | "Screen"
  | "Container"
  | "Panel"
  | "Label"
  | "Button"
  | "Slider"
  | "Switch"
  | "Checkbox"
  | "Radio"
  | "Dropdown"
  | "Image";

export type EditableWidgetProperty =
  | "x"
  | "y"
  | "width"
  | "height"
  | "text"
  | "fill"
  | "textColor"
  | "visible"
  | "value"
  | "checked";

export type EditableWidgetPropertyValue = string | number | boolean;

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
  frameRole?: "canonical" | "draft";
  text?: string;
  fill?: string;
  fillTokenId?: string;
  textColor?: string;
  textColorTokenId?: string;
  radius?: number;
  assetId?: string;
  imageFit?: "stretch";
  options?: string[];
  selectedOptionIndex?: number;
  value?: number;
  checked?: boolean;
  visible?: boolean;
  locked?: boolean;
  eventBindings?: WidgetEventBindings;
}

export const KNOWN_WIDGET_TYPES: WidgetType[] = [
  "Screen",
  "Container",
  "Panel",
  "Label",
  "Button",
  "Slider",
  "Switch",
  "Checkbox",
  "Radio",
  "Dropdown",
  "Image",
];

export const WIDGET_EDITABLE_PROPERTIES: Record<WidgetType, ReadonlySet<EditableWidgetProperty>> = {
  Screen: new Set(["width", "height", "fill", "visible"]),
  Container: new Set(["x", "y", "width", "height", "fill", "visible"]),
  Panel: new Set(["x", "y", "width", "height", "fill", "visible"]),
  Label: new Set(["x", "y", "width", "height", "fill", "text", "textColor", "visible"]),
  Button: new Set(["x", "y", "width", "height", "text", "fill", "textColor", "visible", "checked"]),
  Slider: new Set(["x", "y", "width", "height", "fill", "value", "visible"]),
  Switch: new Set(["x", "y", "width", "height", "fill", "checked", "visible"]),
  Checkbox: new Set(["x", "y", "width", "height", "text", "fill", "textColor", "checked", "visible"]),
  Radio: new Set(["x", "y", "width", "height", "text", "fill", "textColor", "checked", "visible"]),
  Dropdown: new Set(["x", "y", "width", "height", "text", "fill", "textColor", "visible"]),
  Image: new Set(["x", "y", "width", "height", "fill", "visible"]),
};

export const INSERTABLE_WIDGET_TYPES: WidgetType[] = [
  "Container",
  "Panel",
  "Label",
  "Button",
  "Slider",
  "Switch",
  "Checkbox",
  "Radio",
  "Dropdown",
  "Image",
];

export const CONTAINER_WIDGET_TYPES = new Set<WidgetType>(["Screen", "Container", "Panel"]);
