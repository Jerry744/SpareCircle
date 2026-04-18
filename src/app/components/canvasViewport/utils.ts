import {
  canContainChildren,
  flattenWidgetTree,
  type Point,
  type ProjectSnapshot,
  type WidgetTreeNode,
} from "../../backend/editorStore";
import type { Camera } from "./types";

export type HitResult = {
  widget: WidgetTreeNode;
  absX: number;
  absY: number;
  mode: "body" | "resize";
};

export function filterTopLevelIds(widgetIds: string[], project: ProjectSnapshot): string[] {
  const selected = new Set(widgetIds);
  return widgetIds.filter((id) => {
    let parentId = project.widgetsById[id]?.parentId ?? null;
    while (parentId) {
      if (selected.has(parentId)) {
        return false;
      }
      parentId = project.widgetsById[parentId]?.parentId ?? null;
    }
    return true;
  });
}

export function screenToWorldForCamera(
  canvas: HTMLCanvasElement | null,
  camera: Camera,
  screenX: number,
  screenY: number,
): Point {
  if (!canvas) {
    return { x: 0, y: 0 };
  }

  const rect = canvas.getBoundingClientRect();
  return {
    x: (screenX - rect.left - canvas.width / 2) / camera.zoom - camera.x,
    y: (screenY - rect.top - canvas.height / 2) / camera.zoom - camera.y,
  };
}

export function worldToScreenForCamera(
  canvas: HTMLCanvasElement | null,
  camera: Camera,
  worldX: number,
  worldY: number,
): Point {
  if (!canvas) {
    return { x: 0, y: 0 };
  }

  return {
    x: (worldX + camera.x) * camera.zoom + canvas.width / 2,
    y: (worldY + camera.y) * camera.zoom + canvas.height / 2,
  };
}

export function getHitTarget(
  rootTree: WidgetTreeNode | null,
  selectedWidgetIds: string[],
  point: Point,
): HitResult | null {
  if (!rootTree) {
    return null;
  }

  const allWidgets = flattenWidgetTree(rootTree);
  for (let index = allWidgets.length - 1; index >= 0; index -= 1) {
    const item = allWidgets[index];
    if (item.widget.type === "Screen") {
      continue;
    }

    const widget = item.widget;
    const withinBody =
      point.x >= item.absX &&
      point.x <= item.absX + widget.width &&
      point.y >= item.absY &&
      point.y <= item.absY + widget.height;
    if (!withinBody) {
      continue;
    }

    const inResizeHandle =
      selectedWidgetIds.includes(widget.id) &&
      point.x >= item.absX + widget.width - 12 &&
      point.y >= item.absY + widget.height - 12;

    return {
      widget,
      absX: item.absX,
      absY: item.absY,
      mode: inResizeHandle ? "resize" : "body",
    };
  }

  return null;
}

export function getDropContainer(
  rootTree: WidgetTreeNode | null,
  point: Point,
): { widget: WidgetTreeNode; absX: number; absY: number } | null {
  if (!rootTree) {
    return null;
  }

  const allWidgets = flattenWidgetTree(rootTree);
  for (let index = allWidgets.length - 1; index >= 0; index -= 1) {
    const item = allWidgets[index];
    const withinBody =
      point.x >= item.absX &&
      point.x <= item.absX + item.widget.width &&
      point.y >= item.absY &&
      point.y <= item.absY + item.widget.height;
    if (!withinBody) {
      continue;
    }

    if (canContainChildren(item.widget.type)) {
      return item;
    }
  }

  return {
    widget: rootTree,
    absX: 0,
    absY: 0,
  };
}
