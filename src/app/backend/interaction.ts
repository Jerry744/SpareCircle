import type { AlignmentOperation, InteractionState, Point, ProjectSnapshot, WidgetNode } from "./types";
import { buildWidgetTree, flattenWidgetTree, getActiveScreen, transformProjectWidgets } from "./tree";

export function moveProjectWidgets(project: ProjectSnapshot, widgetIds: string[], dx: number, dy: number): ProjectSnapshot {
  return transformProjectWidgets(project, widgetIds, (widget) => ({
    ...widget,
    x: widget.x + dx,
    y: widget.y + dy,
  }));
}

export function resizeProjectWidget(project: ProjectSnapshot, widgetId: string, dx: number, dy: number): ProjectSnapshot {
  return transformProjectWidgets(project, [widgetId], (widget) => ({
    ...widget,
    width: Math.max(24, widget.width + dx),
    height: Math.max(24, widget.height + dy),
  }));
}

export interface AbsoluteBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function collectSnapGuides(
  project: ProjectSnapshot,
  excludeWidgetIds: ReadonlySet<string>,
  screenMeta: { width: number; height: number },
): { xGuides: number[]; yGuides: number[] } {
  const xSet = new Set<number>();
  const ySet = new Set<number>();

  xSet.add(0);
  xSet.add(screenMeta.width / 2);
  xSet.add(screenMeta.width);
  ySet.add(0);
  ySet.add(screenMeta.height / 2);
  ySet.add(screenMeta.height);

  const activeScreen = getActiveScreen(project);
  const tree = buildWidgetTree(project, activeScreen.rootNodeId);
  if (!tree) return { xGuides: Array.from(xSet), yGuides: Array.from(ySet) };

  for (const { widget, absX, absY } of flattenWidgetTree(tree)) {
    if (widget.type === "Screen" || excludeWidgetIds.has(widget.id)) continue;
    xSet.add(absX);
    xSet.add(absX + widget.width / 2);
    xSet.add(absX + widget.width);
    ySet.add(absY);
    ySet.add(absY + widget.height / 2);
    ySet.add(absY + widget.height);
  }

  return { xGuides: Array.from(xSet), yGuides: Array.from(ySet) };
}

function findNearestGuide(edge: number, guides: number[], threshold: number): number | null {
  let best: number | null = null;
  let bestDist = threshold + 1;
  for (const guide of guides) {
    const dist = Math.abs(edge - guide);
    if (dist < bestDist) {
      bestDist = dist;
      best = guide;
    }
  }
  return best;
}

export function snapMoveDelta(
  dx: number,
  dy: number,
  draggingBoxes: AbsoluteBox[],
  xGuides: number[],
  yGuides: number[],
  threshold: number,
): { dx: number; dy: number } {
  if (draggingBoxes.length === 0) return { dx, dy };

  const minX = Math.min(...draggingBoxes.map((b) => b.x));
  const maxRight = Math.max(...draggingBoxes.map((b) => b.x + b.width));
  const minY = Math.min(...draggingBoxes.map((b) => b.y));
  const maxBottom = Math.max(...draggingBoxes.map((b) => b.y + b.height));
  const centerX = (minX + maxRight) / 2;
  const centerY = (minY + maxBottom) / 2;

  let bestDx = dx;
  let bestXDist = threshold + 1;
  for (const edge of [minX + dx, centerX + dx, maxRight + dx]) {
    const guide = findNearestGuide(edge, xGuides, threshold);
    if (guide !== null) {
      const dist = Math.abs(edge - guide);
      if (dist < bestXDist) {
        bestXDist = dist;
        bestDx = dx + (guide - edge);
      }
    }
  }

  let bestDy = dy;
  let bestYDist = threshold + 1;
  for (const edge of [minY + dy, centerY + dy, maxBottom + dy]) {
    const guide = findNearestGuide(edge, yGuides, threshold);
    if (guide !== null) {
      const dist = Math.abs(edge - guide);
      if (dist < bestYDist) {
        bestYDist = dist;
        bestDy = dy + (guide - edge);
      }
    }
  }

  return { dx: bestDx, dy: bestDy };
}

export function snapResizeDelta(
  dx: number,
  dy: number,
  widgetAbsBox: AbsoluteBox,
  xGuides: number[],
  yGuides: number[],
  threshold: number,
  minWidth = 24,
  minHeight = 24,
): { dx: number; dy: number } {
  const newRight = widgetAbsBox.x + Math.max(minWidth, widgetAbsBox.width + dx);
  const newBottom = widgetAbsBox.y + Math.max(minHeight, widgetAbsBox.height + dy);

  const xGuide = findNearestGuide(newRight, xGuides, threshold);
  const yGuide = findNearestGuide(newBottom, yGuides, threshold);

  return {
    dx: xGuide !== null ? xGuide - widgetAbsBox.x - widgetAbsBox.width : dx,
    dy: yGuide !== null ? yGuide - widgetAbsBox.y - widgetAbsBox.height : dy,
  };
}

export function applyPixelSnap(value: number): number {
  return Math.round(value);
}

export function applyInteraction(project: ProjectSnapshot, interaction: InteractionState, pointer: Point): ProjectSnapshot {
  const rawDx = pointer.x - interaction.pointerStart.x;
  const rawDy = pointer.y - interaction.pointerStart.y;
  const startProject = interaction.startProject;
  const canvasSnap = startProject.canvasSnap;

  if (interaction.kind === "move") {
    let dx = rawDx;
    let dy = rawDy;

    if (canvasSnap?.magnetSnapEnabled) {
      const activeScreen = getActiveScreen(startProject);
      const excludeIds = new Set(interaction.widgetIds);
      const guides = collectSnapGuides(startProject, excludeIds, activeScreen.meta);
      const tree = buildWidgetTree(startProject, activeScreen.rootNodeId);
      const flattened = tree ? flattenWidgetTree(tree) : [];
      const draggingBoxes = flattened
        .filter((item) => excludeIds.has(item.widget.id) && item.widget.type !== "Screen")
        .map((item) => ({ x: item.absX, y: item.absY, width: item.widget.width, height: item.widget.height }));

      const snapped = snapMoveDelta(dx, dy, draggingBoxes, guides.xGuides, guides.yGuides, canvasSnap.snapThresholdPx);
      dx = snapped.dx;
      dy = snapped.dy;
    }

    const moved = moveProjectWidgets(startProject, interaction.widgetIds, dx, dy);

    if (canvasSnap?.pixelSnapEnabled) {
      return transformProjectWidgets(moved, interaction.widgetIds, (w) => ({
        ...w,
        x: Math.round(w.x),
        y: Math.round(w.y),
      }));
    }

    return moved;
  }

  // resize (se handle)
  let dx = rawDx;
  let dy = rawDy;

  if (canvasSnap?.magnetSnapEnabled) {
    const activeScreen = getActiveScreen(startProject);
    const excludeIds = new Set(interaction.widgetIds);
    const guides = collectSnapGuides(startProject, excludeIds, activeScreen.meta);
    const tree = buildWidgetTree(startProject, activeScreen.rootNodeId);
    const flattened = tree ? flattenWidgetTree(tree) : [];
    const absItem = flattened.find((item) => item.widget.id === interaction.widgetIds[0]);
    if (absItem) {
      const snapped = snapResizeDelta(
        dx, dy,
        { x: absItem.absX, y: absItem.absY, width: absItem.widget.width, height: absItem.widget.height },
        guides.xGuides, guides.yGuides, canvasSnap.snapThresholdPx,
      );
      dx = snapped.dx;
      dy = snapped.dy;
    }
  }

  const resized = resizeProjectWidget(startProject, interaction.widgetIds[0], dx, dy);

  if (canvasSnap?.pixelSnapEnabled) {
    return transformProjectWidgets(resized, [interaction.widgetIds[0]], (w) => ({
      ...w,
      width: Math.round(w.width),
      height: Math.round(w.height),
    }));
  }

  return resized;
}

type AlignmentTarget = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  parentAbsX: number;
  parentAbsY: number;
};

function getAbsolutePositionMap(project: ProjectSnapshot): Record<string, { x: number; y: number }> {
  const positionById: Record<string, { x: number; y: number }> = {};

  const resolve = (widgetId: string): { x: number; y: number } => {
    if (positionById[widgetId]) {
      return positionById[widgetId];
    }

    const widget = project.widgetsById[widgetId];
    if (!widget) {
      return { x: 0, y: 0 };
    }

    if (!widget.parentId) {
      const position = { x: widget.x, y: widget.y };
      positionById[widgetId] = position;
      return position;
    }

    const parentPosition = resolve(widget.parentId);
    const position = {
      x: parentPosition.x + widget.x,
      y: parentPosition.y + widget.y,
    };
    positionById[widgetId] = position;
    return position;
  };

  for (const widgetId of Object.keys(project.widgetsById)) {
    resolve(widgetId);
  }

  return positionById;
}

function filterTopLevelWidgetIds(project: ProjectSnapshot, widgetIds: string[]): string[] {
  const selected = new Set(widgetIds.filter((widgetId) => Boolean(project.widgetsById[widgetId])));

  return Array.from(selected).filter((widgetId) => {
    let parentId = project.widgetsById[widgetId]?.parentId ?? null;
    while (parentId) {
      if (selected.has(parentId)) {
        return false;
      }
      parentId = project.widgetsById[parentId]?.parentId ?? null;
    }
    return true;
  });
}

function getAlignmentTargets(project: ProjectSnapshot, widgetIds: string[]): AlignmentTarget[] {
  const screenRootIds = new Set(project.screens.map((screen) => screen.rootNodeId));
  const absolutePositions = getAbsolutePositionMap(project);
  const topLevelWidgetIds = filterTopLevelWidgetIds(project, widgetIds);

  return Array.from(new Set(topLevelWidgetIds))
    .map((widgetId) => project.widgetsById[widgetId])
    .filter((widget): widget is WidgetNode => Boolean(widget) && !screenRootIds.has(widget.id))
    .map((widget) => {
      const absPosition = absolutePositions[widget.id] ?? { x: widget.x, y: widget.y };
      const parentAbsPosition = widget.parentId
        ? (absolutePositions[widget.parentId] ?? { x: 0, y: 0 })
        : { x: 0, y: 0 };

      return {
      id: widget.id,
      x: absPosition.x,
      y: absPosition.y,
      width: widget.width,
      height: widget.height,
      right: absPosition.x + widget.width,
      bottom: absPosition.y + widget.height,
      parentAbsX: parentAbsPosition.x,
      parentAbsY: parentAbsPosition.y,
    };
    });
}

function compareByAxis(axis: "x" | "y") {
  return (left: AlignmentTarget, right: AlignmentTarget) => {
    const primary = axis === "x" ? left.x - right.x : left.y - right.y;
    if (primary !== 0) {
      return primary;
    }

    const secondary = axis === "x" ? left.y - right.y : left.x - right.x;
    if (secondary !== 0) {
      return secondary;
    }

    return left.id.localeCompare(right.id);
  };
}

export function applyAlignmentOperation(
  project: ProjectSnapshot,
  widgetIds: string[],
  operation: AlignmentOperation,
): ProjectSnapshot {
  const targets = getAlignmentTargets(project, widgetIds);
  if (targets.length === 0) {
    return project;
  }

  const minX = Math.min(...targets.map((target) => target.x));
  const minY = Math.min(...targets.map((target) => target.y));
  const maxRight = Math.max(...targets.map((target) => target.right));
  const maxBottom = Math.max(...targets.map((target) => target.bottom));
  const centerX = (minX + maxRight) / 2;
  const centerY = (minY + maxBottom) / 2;

  switch (operation) {
    case "align_left":
      return transformProjectWidgets(project, targets.map((target) => target.id), (widget) => {
        const target = targets.find((item) => item.id === widget.id);
        if (!target) return widget;
        return { ...widget, x: minX - target.parentAbsX };
      });
    case "align_right":
      return transformProjectWidgets(project, targets.map((target) => target.id), (widget) => {
        const target = targets.find((item) => item.id === widget.id);
        if (!target) return widget;
        return { ...widget, x: (maxRight - widget.width) - target.parentAbsX };
      });
    case "align_top":
      return transformProjectWidgets(project, targets.map((target) => target.id), (widget) => {
        const target = targets.find((item) => item.id === widget.id);
        if (!target) return widget;
        return { ...widget, y: minY - target.parentAbsY };
      });
    case "align_bottom":
      return transformProjectWidgets(project, targets.map((target) => target.id), (widget) => {
        const target = targets.find((item) => item.id === widget.id);
        if (!target) return widget;
        return { ...widget, y: (maxBottom - widget.height) - target.parentAbsY };
      });
    case "align_h_center":
      return transformProjectWidgets(project, targets.map((target) => target.id), (widget) => {
        const target = targets.find((item) => item.id === widget.id);
        if (!target) return widget;
        return { ...widget, x: (centerX - (widget.width / 2)) - target.parentAbsX };
      });
    case "align_v_center":
      return transformProjectWidgets(project, targets.map((target) => target.id), (widget) => {
        const target = targets.find((item) => item.id === widget.id);
        if (!target) return widget;
        return { ...widget, y: (centerY - (widget.height / 2)) - target.parentAbsY };
      });
    case "distribute_h": {
      if (targets.length < 3) {
        return project;
      }

      const sorted = [...targets].sort(compareByAxis("x"));
      const totalWidth = sorted.reduce((sum, target) => sum + target.width, 0);
      const gap = ((sorted[sorted.length - 1].right - sorted[0].x) - totalWidth) / (sorted.length - 1);
      const nextXById: Record<string, number> = {};
      let cursor = sorted[0].x + sorted[0].width + gap;

      for (const target of sorted.slice(1, -1)) {
        nextXById[target.id] = cursor - target.parentAbsX;
        cursor += target.width + gap;
      }

      return transformProjectWidgets(project, sorted.slice(1, -1).map((target) => target.id), (widget) => ({
        ...widget,
        x: nextXById[widget.id] ?? widget.x,
      }));
    }
    case "distribute_v": {
      if (targets.length < 3) {
        return project;
      }

      const sorted = [...targets].sort(compareByAxis("y"));
      const totalHeight = sorted.reduce((sum, target) => sum + target.height, 0);
      const gap = ((sorted[sorted.length - 1].bottom - sorted[0].y) - totalHeight) / (sorted.length - 1);
      const nextYById: Record<string, number> = {};
      let cursor = sorted[0].y + sorted[0].height + gap;

      for (const target of sorted.slice(1, -1)) {
        nextYById[target.id] = cursor - target.parentAbsY;
        cursor += target.height + gap;
      }

      return transformProjectWidgets(project, sorted.slice(1, -1).map((target) => target.id), (widget) => ({
        ...widget,
        y: nextYById[widget.id] ?? widget.y,
      }));
    }
    default:
      return project;
  }
}
