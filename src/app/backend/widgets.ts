import {
  INSERTABLE_WIDGET_TYPES,
  type ProjectSnapshot,
  type WidgetNode,
  type WidgetType,
} from "./types";
import type { ProjectSnapshotV2 } from "./types/projectV2";

type WidgetCatalog = Pick<ProjectSnapshot, "widgetsById"> | Pick<ProjectSnapshotV2, "widgetsById">;

export function mapPaletteWidgetToType(widgetId: string): WidgetType | null {
  const normalized = widgetId.trim().toLowerCase();
  const paletteMap: Record<string, WidgetType> = {
    container: "Container",
    panel: "Panel",
    label: "Label",
    button: "Button",
    slider: "Slider",
    switch: "Switch",
    checkbox: "Checkbox",
    radio: "Radio",
    dropdown: "Dropdown",
    image: "Image",
  };

  const mappedType = paletteMap[normalized];
  if (!mappedType || !INSERTABLE_WIDGET_TYPES.includes(mappedType)) {
    return null;
  }

  return mappedType;
}

function getDefaultWidgetSize(widgetType: WidgetType): { width: number; height: number } {
  switch (widgetType) {
    case "Container":
      return { width: 200, height: 140 };
    case "Panel":
      return { width: 180, height: 120 };
    case "Label":
      return { width: 140, height: 32 };
    case "Button":
      return { width: 96, height: 40 };
    case "Slider":
      return { width: 200, height: 32 };
    case "Switch":
      return { width: 60, height: 32 };
    case "Checkbox":
    case "Radio":
      return { width: 160, height: 32 };
    case "Dropdown":
      return { width: 160, height: 40 };
    case "Image":
      return { width: 120, height: 120 };
    default:
      return { width: 100, height: 40 };
  }
}

export function getNextWidgetId(project: WidgetCatalog, widgetType: WidgetType): string {
  const prefix = widgetType.toLowerCase();
  const usedIds = new Set<string>(Object.keys(project.widgetsById));

  let counter = 1;
  while (usedIds.has(`${prefix}-${counter}`)) {
    counter += 1;
  }

  return `${prefix}-${counter}`;
}

export function createWidgetNode(
  project: WidgetCatalog,
  widgetType: WidgetType,
  x: number,
  y: number,
  idOverride?: string,
): WidgetNode {
  const id = idOverride ?? getNextWidgetId(project, widgetType);
  const baseSize = getDefaultWidgetSize(widgetType);

  if (widgetType === "Label") {
    return {
      id,
      name: "Label",
      type: "Label",
      parentId: null,
      childrenIds: [],
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      text: "Label",
      textColor: "#f3f4f6",
    };
  }

  if (widgetType === "Button") {
    return {
      id,
      name: "Button",
      type: "Button",
      parentId: null,
      childrenIds: [],
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      text: "Button",
      fill: "#3b82f6",
      textColor: "#ffffff",
      radius: 10,
    };
  }

  if (widgetType === "Switch") {
    return {
      id,
      name: "Switch",
      type: "Switch",
      parentId: null,
      childrenIds: [],
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      fill: "#22c55e",
    };
  }

  if (widgetType === "Checkbox") {
    return {
      id,
      name: "Checkbox",
      type: "Checkbox",
      parentId: null,
      childrenIds: [],
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      text: "Option",
      fill: "#3b82f6",
      textColor: "#f3f4f6",
    };
  }

  if (widgetType === "Radio") {
    return {
      id,
      name: "Radio",
      type: "Radio",
      parentId: null,
      childrenIds: [],
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      options: ["Option 1", "Option 2"],
      selectedOptionIndex: 0,
      fill: "#3b82f6",
      textColor: "#f3f4f6",
    };
  }

  if (widgetType === "Dropdown") {
    return {
      id,
      name: "Dropdown",
      type: "Dropdown",
      parentId: null,
      childrenIds: [],
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      options: ["Option 1", "Option 2", "Option 3"],
      selectedOptionIndex: 0,
      fill: "#374151",
      textColor: "#f3f4f6",
    };
  }

  if (widgetType === "Slider") {
    return {
      id,
      name: "Slider",
      type: "Slider",
      parentId: null,
      childrenIds: [],
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      fill: "#3b82f6",
    };
  }

  if (widgetType === "Image") {
    return {
      id,
      name: "Image",
      type: "Image",
      parentId: null,
      childrenIds: [],
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      fill: "#374151",
    };
  }

  if (widgetType === "Panel") {
    return {
      id,
      name: "Panel",
      type: "Panel",
      parentId: null,
      childrenIds: [],
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      fill: "#111827",
      radius: 12,
    };
  }

  return {
    id,
    name: "Container",
    type: "Container",
    parentId: null,
    childrenIds: [],
    x,
    y,
    width: baseSize.width,
    height: baseSize.height,
    fill: "#252525",
    radius: 12,
  };
}
