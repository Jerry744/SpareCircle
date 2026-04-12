import {
  CONTAINER_WIDGET_TYPES,
  type ProjectSnapshot,
  type ScreenModel,
  type WidgetNode,
  type WidgetType,
} from "./types";

export type WidgetLocation = {
  parentId: string | null;
  index: number;
  widget: WidgetNode;
};

export function cloneProject(project: ProjectSnapshot): ProjectSnapshot {
  return structuredClone(project);
}

export function getActiveScreen(project: ProjectSnapshot): ScreenModel {
  return project.screens.find((screen) => screen.id === project.activeScreenId) ?? project.screens[0];
}

export function mapWidgetTree(
  widget: WidgetNode,
  widgetIds: Set<string>,
  mapper: (widget: WidgetNode) => WidgetNode,
): WidgetNode {
  const mappedChildren = widget.children.map((child) => mapWidgetTree(child, widgetIds, mapper));
  const nextWidget = {
    ...widget,
    children: mappedChildren,
  };

  return widgetIds.has(widget.id) ? mapper(nextWidget) : nextWidget;
}

export function updateActiveScreen(project: ProjectSnapshot, updater: (screen: ScreenModel) => ScreenModel): ProjectSnapshot {
  return {
    ...project,
    screens: project.screens.map((screen) => (screen.id === project.activeScreenId ? updater(screen) : screen)),
  };
}

export function transformProjectWidgets(
  project: ProjectSnapshot,
  widgetIds: string[],
  mapper: (widget: WidgetNode) => WidgetNode,
): ProjectSnapshot {
  const activeIds = new Set(widgetIds);
  return updateActiveScreen(project, (screen) => ({
    ...screen,
    rootWidget: mapWidgetTree(screen.rootWidget, activeIds, mapper),
  }));
}

export function canContainChildren(widgetType: WidgetType): boolean {
  return CONTAINER_WIDGET_TYPES.has(widgetType);
}

export function findWidgetById(widget: WidgetNode, widgetId: string): WidgetNode | null {
  if (widget.id === widgetId) {
    return widget;
  }

  for (const child of widget.children) {
    const match = findWidgetById(child, widgetId);
    if (match) {
      return match;
    }
  }

  return null;
}

export function findWidgetLocation(widget: WidgetNode, widgetId: string, parentId: string | null = null): WidgetLocation | null {
  for (let index = 0; index < widget.children.length; index += 1) {
    const child = widget.children[index];
    if (child.id === widgetId) {
      return { parentId: widget.id, index, widget: child };
    }

    const nested = findWidgetLocation(child, widgetId, child.id);
    if (nested) {
      return nested;
    }
  }

  if (widget.id === widgetId) {
    return { parentId, index: 0, widget };
  }

  return null;
}

export function collectWidgetIds(widget: WidgetNode): Set<string> {
  const ids = new Set<string>([widget.id]);
  for (const child of widget.children) {
    for (const id of collectWidgetIds(child)) {
      ids.add(id);
    }
  }
  return ids;
}

export function insertChild(
  rootWidget: WidgetNode,
  parentId: string,
  childWidget: WidgetNode,
  requestedIndex: number = Number.MAX_SAFE_INTEGER,
): WidgetNode {
  if (rootWidget.id === parentId) {
    const nextChildren = [...rootWidget.children];
    const safeIndex = Math.max(0, Math.min(requestedIndex, nextChildren.length));
    nextChildren.splice(safeIndex, 0, childWidget);
    return { ...rootWidget, children: nextChildren };
  }

  return {
    ...rootWidget,
    children: rootWidget.children.map((child) => insertChild(child, parentId, childWidget, requestedIndex)),
  };
}

export function removeChild(rootWidget: WidgetNode, parentId: string, index: number): { root: WidgetNode; removed: WidgetNode | null } {
  if (rootWidget.id === parentId) {
    if (index < 0 || index >= rootWidget.children.length) {
      return { root: rootWidget, removed: null };
    }

    const nextChildren = [...rootWidget.children];
    const [removed] = nextChildren.splice(index, 1);
    return {
      root: {
        ...rootWidget,
        children: nextChildren,
      },
      removed: removed ?? null,
    };
  }

  let removedNode: WidgetNode | null = null;
  const nextRoot = {
    ...rootWidget,
    children: rootWidget.children.map((child) => {
      const result = removeChild(child, parentId, index);
      if (result.removed) {
        removedNode = result.removed;
      }
      return result.root;
    }),
  };

  return { root: nextRoot, removed: removedNode };
}

export function flattenWidgetTree(
  widget: WidgetNode,
  parentX = 0,
  parentY = 0,
  depth = 0,
): Array<{ widget: WidgetNode; absX: number; absY: number; depth: number }> {
  const absX = parentX + widget.x;
  const absY = parentY + widget.y;
  const items = [{ widget, absX, absY, depth }];

  for (const child of widget.children) {
    items.push(...flattenWidgetTree(child, absX, absY, depth + 1));
  }

  return items;
}
