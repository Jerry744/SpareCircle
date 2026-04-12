import {
  INSERTABLE_WIDGET_TYPES,
  type ProjectSnapshot,
  type WidgetNode,
  type WidgetType,
} from "./types";
import { flattenWidgetTree } from "./tree";

export function mapPaletteWidgetToType(widgetId: string): WidgetType | null {
  const normalized = widgetId.trim().toLowerCase();
  const paletteMap: Record<string, WidgetType> = {
    container: "Container",
    panel: "Panel",
    label: "Label",
    button: "Button",
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
    case "Image":
      return { width: 120, height: 120 };
    default:
      return { width: 100, height: 40 };
  }
}

function getNextWidgetId(project: ProjectSnapshot, widgetType: WidgetType): string {
  const prefix = widgetType.toLowerCase();
  const usedIds = new Set<string>();

  for (const screen of project.screens) {
    for (const item of flattenWidgetTree(screen.rootWidget)) {
      usedIds.add(item.widget.id);
    }
  }

  let counter = 1;
  while (usedIds.has(`${prefix}-${counter}`)) {
    counter += 1;
  }

  return `${prefix}-${counter}`;
}

export function createWidgetNode(project: ProjectSnapshot, widgetType: WidgetType, x: number, y: number): WidgetNode {
  const id = getNextWidgetId(project, widgetType);
  const baseSize = getDefaultWidgetSize(widgetType);

  if (widgetType === "Label") {
    return {
      id,
      name: "Label",
      type: "Label",
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      text: "Label",
      textColor: "#f3f4f6",
      children: [],
    };
  }

  if (widgetType === "Button") {
    return {
      id,
      name: "Button",
      type: "Button",
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      text: "Button",
      fill: "#3b82f6",
      textColor: "#ffffff",
      radius: 10,
      children: [],
    };
  }

  if (widgetType === "Image") {
    return {
      id,
      name: "Image",
      type: "Image",
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      fill: "#374151",
      children: [],
    };
  }

  if (widgetType === "Panel") {
    return {
      id,
      name: "Panel",
      type: "Panel",
      x,
      y,
      width: baseSize.width,
      height: baseSize.height,
      fill: "#111827",
      radius: 12,
      children: [],
    };
  }

  return {
    id,
    name: "Container",
    type: "Container",
    x,
    y,
    width: baseSize.width,
    height: baseSize.height,
    fill: "#252525",
    radius: 12,
    children: [],
  };
}
