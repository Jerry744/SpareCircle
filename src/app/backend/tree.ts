import {
  CONTAINER_WIDGET_TYPES,
  type ProjectSnapshot,
  type ScreenModel,
  type WidgetNode,
  type WidgetType,
} from "./types";

export type WidgetTreeNode = WidgetNode & { children: WidgetTreeNode[] };

export type WidgetLocation = {
  parentId: string | null;
  index: number;
  widget: WidgetTreeNode;
};

export function cloneProject(project: ProjectSnapshot): ProjectSnapshot {
  return structuredClone(project);
}

export function getActiveScreen(project: ProjectSnapshot): ScreenModel {
  return project.screens.find((screen) => screen.id === project.activeScreenId) ?? project.screens[0];
}

export function getWidgetById(project: ProjectSnapshot, widgetId: string): WidgetNode | null {
  return project.widgetsById[widgetId] ?? null;
}

export function canContainChildren(widgetType: WidgetType): boolean {
  return CONTAINER_WIDGET_TYPES.has(widgetType);
}

export function buildWidgetTree(project: ProjectSnapshot, rootNodeId: string): WidgetTreeNode | null {
  const build = (widgetId: string, visiting: Set<string>): WidgetTreeNode | null => {
    const node = project.widgetsById[widgetId];
    if (!node || visiting.has(widgetId)) {
      return null;
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(widgetId);

    const children: WidgetTreeNode[] = [];
    for (const childId of node.childrenIds) {
      const child = build(childId, nextVisiting);
      if (child) {
        children.push(child);
      }
    }

    return {
      ...node,
      children,
    };
  };

  return build(rootNodeId, new Set());
}

export function getActiveScreenTree(project: ProjectSnapshot): WidgetTreeNode | null {
  const activeScreen = getActiveScreen(project);
  return buildWidgetTree(project, activeScreen.rootNodeId);
}

export function findWidgetById(widget: WidgetTreeNode, widgetId: string): WidgetTreeNode | null {
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

export function findWidgetLocation(widget: WidgetTreeNode, widgetId: string, parentId: string | null = null): WidgetLocation | null {
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

export function collectWidgetIds(widget: WidgetTreeNode): Set<string> {
  const ids = new Set<string>([widget.id]);
  for (const child of widget.children) {
    for (const id of collectWidgetIds(child)) {
      ids.add(id);
    }
  }
  return ids;
}

export function flattenWidgetTree(
  widget: WidgetTreeNode,
  parentX = 0,
  parentY = 0,
  depth = 0,
): Array<{ widget: WidgetTreeNode; absX: number; absY: number; depth: number }> {
  const absX = parentX + widget.x;
  const absY = parentY + widget.y;
  const items = [{ widget, absX, absY, depth }];

  for (const child of widget.children) {
    items.push(...flattenWidgetTree(child, absX, absY, depth + 1));
  }

  return items;
}

export function updateWidget(
  project: ProjectSnapshot,
  widgetId: string,
  updater: (widget: WidgetNode) => WidgetNode,
): ProjectSnapshot {
  const current = project.widgetsById[widgetId];
  if (!current) {
    return project;
  }

  return {
    ...project,
    widgetsById: {
      ...project.widgetsById,
      [widgetId]: updater(current),
    },
  };
}

export function transformProjectWidgets(
  project: ProjectSnapshot,
  widgetIds: string[],
  mapper: (widget: WidgetNode) => WidgetNode,
): ProjectSnapshot {
  if (widgetIds.length === 0) {
    return project;
  }

  const idSet = new Set(widgetIds);
  const nextWidgetsById = { ...project.widgetsById };
  let changed = false;

  for (const widgetId of idSet) {
    const current = nextWidgetsById[widgetId];
    if (!current) {
      continue;
    }

    nextWidgetsById[widgetId] = mapper(current);
    changed = true;
  }

  if (!changed) {
    return project;
  }

  return {
    ...project,
    widgetsById: nextWidgetsById,
  };
}

export function insertWidget(
  project: ProjectSnapshot,
  parentId: string,
  childWidget: WidgetNode,
  requestedIndex: number = Number.MAX_SAFE_INTEGER,
): ProjectSnapshot {
  const parent = project.widgetsById[parentId];
  if (!parent || !canContainChildren(parent.type)) {
    return project;
  }

  const nextChildrenIds = [...parent.childrenIds];
  const safeIndex = Math.max(0, Math.min(requestedIndex, nextChildrenIds.length));
  nextChildrenIds.splice(safeIndex, 0, childWidget.id);

  return {
    ...project,
    widgetsById: {
      ...project.widgetsById,
      [parentId]: {
        ...parent,
        childrenIds: nextChildrenIds,
      },
      [childWidget.id]: {
        ...childWidget,
        parentId,
      },
    },
  };
}

export function collectSubtreeIds(project: ProjectSnapshot, rootNodeId: string): Set<string> {
  const ids = new Set<string>();
  const stack = [rootNodeId];

  while (stack.length > 0) {
    const currentId = stack.pop() as string;
    if (ids.has(currentId)) {
      continue;
    }

    const node = project.widgetsById[currentId];
    if (!node) {
      continue;
    }

    ids.add(currentId);
    for (const childId of node.childrenIds) {
      stack.push(childId);
    }
  }

  return ids;
}

export function moveWidgetInProject(
  project: ProjectSnapshot,
  widgetId: string,
  targetParentId: string,
  targetIndex: number,
): ProjectSnapshot {
  const widget = project.widgetsById[widgetId];
  const targetParent = project.widgetsById[targetParentId];
  if (!widget || !targetParent || !canContainChildren(targetParent.type) || !widget.parentId) {
    return project;
  }

  const sourceParent = project.widgetsById[widget.parentId];
  if (!sourceParent) {
    return project;
  }

  const descendants = collectSubtreeIds(project, widgetId);
  if (descendants.has(targetParentId)) {
    return project;
  }

  const sourceIndex = sourceParent.childrenIds.indexOf(widgetId);
  if (sourceIndex < 0) {
    return project;
  }

  const normalizedTargetIndex = Math.max(0, Math.min(targetIndex, targetParent.childrenIds.length));
  const sameParent = sourceParent.id === targetParent.id;
  const adjustedTargetIndex = sameParent && sourceIndex < normalizedTargetIndex
    ? normalizedTargetIndex - 1
    : normalizedTargetIndex;

  if (sameParent && sourceIndex === adjustedTargetIndex) {
    return project;
  }

  const nextSourceChildren = [...sourceParent.childrenIds];
  nextSourceChildren.splice(sourceIndex, 1);

  const nextTargetChildren = sameParent ? nextSourceChildren : [...targetParent.childrenIds];
  nextTargetChildren.splice(adjustedTargetIndex, 0, widgetId);

  return {
    ...project,
    widgetsById: {
      ...project.widgetsById,
      [sourceParent.id]: {
        ...sourceParent,
        childrenIds: sameParent ? nextTargetChildren : nextSourceChildren,
      },
      [targetParent.id]: sameParent
        ? {
            ...targetParent,
            childrenIds: nextTargetChildren,
          }
        : {
            ...targetParent,
            childrenIds: nextTargetChildren,
          },
      [widgetId]: {
        ...widget,
        parentId: targetParent.id,
      },
    },
  };
}

export function removeSubtree(project: ProjectSnapshot, rootNodeId: string): ProjectSnapshot {
  const toDelete = collectSubtreeIds(project, rootNodeId);
  if (!toDelete.size) {
    return project;
  }

  const nextWidgetsById: Record<string, WidgetNode> = {};
  for (const [id, widget] of Object.entries(project.widgetsById)) {
    if (!toDelete.has(id)) {
      nextWidgetsById[id] = {
        ...widget,
        childrenIds: widget.childrenIds.filter((childId) => !toDelete.has(childId)),
      };
    }
  }

  return {
    ...project,
    widgetsById: nextWidgetsById,
  };
}

export function cloneSubtreeWithNewIds(
  project: ProjectSnapshot,
  rootNodeId: string,
  idFactory: (sourceId: string) => string,
): { widgets: Record<string, WidgetNode>; newRootId: string } | null {
  const root = project.widgetsById[rootNodeId];
  if (!root) {
    return null;
  }

  const idMap = new Map<string, string>();
  const nodes = collectSubtreeIds(project, rootNodeId);
  for (const oldId of nodes) {
    idMap.set(oldId, idFactory(oldId));
  }

  const widgets: Record<string, WidgetNode> = {};
  for (const oldId of nodes) {
    const source = project.widgetsById[oldId];
    if (!source) {
      continue;
    }

    const nextId = idMap.get(oldId) as string;
    const nextParentId = source.parentId ? idMap.get(source.parentId) ?? null : null;

    widgets[nextId] = {
      ...source,
      id: nextId,
      parentId: nextParentId,
      childrenIds: source.childrenIds
        .map((childId) => idMap.get(childId))
        .filter((childId): childId is string => Boolean(childId)),
    };
  }

  return {
    widgets,
    newRootId: idMap.get(rootNodeId) as string,
  };
}
