import type { ProjectSnapshot, WidgetNode } from "./types";
import { buildWidgetTree, collectSubtreeIds, flattenWidgetTree, getActiveScreen } from "./tree";

export interface ClipboardRoot {
  widgetId: string;
  absX: number;
  absY: number;
}

export interface ClipboardPayload {
  sourceScreenId: string;
  roots: ClipboardRoot[];
  widgetsById: Record<string, WidgetNode>;
}

function filterTopLevelIds(ids: string[], project: ProjectSnapshot): string[] {
  const selected = new Set(ids);
  return ids.filter((id) => {
    let parentId = project.widgetsById[id]?.parentId ?? null;
    while (parentId) {
      if (selected.has(parentId)) return false;
      parentId = project.widgetsById[parentId]?.parentId ?? null;
    }
    return true;
  });
}

function allocateNewIds(project: ProjectSnapshot, sourceIds: string[]): Map<string, string> {
  const used = new Set(Object.keys(project.widgetsById));
  const idMap = new Map<string, string>();
  for (const srcId of sourceIds) {
    const prefix = srcId.toLowerCase().replace(/-\d+$/, "").replace(/[^a-z0-9-]/g, "-") || "widget";
    let n = 1;
    while (used.has(`${prefix}-${n}`)) n++;
    const newId = `${prefix}-${n}`;
    used.add(newId);
    idMap.set(srcId, newId);
  }
  return idMap;
}

export function packClipboard(project: ProjectSnapshot, selectedWidgetIds: string[]): ClipboardPayload | null {
  if (selectedWidgetIds.length === 0) return null;

  const screenRootIds = new Set(project.screens.map((s) => s.rootNodeId));
  const eligible = selectedWidgetIds.filter((id) => !screenRootIds.has(id) && Boolean(project.widgetsById[id]));
  const topLevel = filterTopLevelIds(eligible, project);
  if (topLevel.length === 0) return null;

  const activeScreen = getActiveScreen(project);
  const tree = buildWidgetTree(project, activeScreen.rootNodeId);
  const absMap = new Map(
    (tree ? flattenWidgetTree(tree) : []).map(({ widget, absX, absY }) => [widget.id, { absX, absY }]),
  );

  const widgetsById: Record<string, WidgetNode> = {};
  const roots: ClipboardRoot[] = [];

  for (const id of topLevel) {
    const abs = absMap.get(id);
    if (!abs) continue;
    roots.push({ widgetId: id, absX: abs.absX, absY: abs.absY });
    for (const subtreeId of collectSubtreeIds(project, id)) {
      widgetsById[subtreeId] = project.widgetsById[subtreeId];
    }
  }

  return roots.length > 0 ? { sourceScreenId: activeScreen.id, roots, widgetsById } : null;
}

export function instantiateClipboard(
  project: ProjectSnapshot,
  payload: ClipboardPayload,
  targetParentId: string,
  targetIndex?: number,
): { nextProject: ProjectSnapshot; newRootIds: string[] } {
  const targetParent = project.widgetsById[targetParentId];
  if (!targetParent) return { nextProject: project, newRootIds: [] };

  const idMap = allocateNewIds(project, Object.keys(payload.widgetsById));
  const newWidgets: Record<string, WidgetNode> = {};

  for (const [srcId, srcWidget] of Object.entries(payload.widgetsById)) {
    const newId = idMap.get(srcId)!;
    const mappedParentId = srcWidget.parentId ? (idMap.get(srcWidget.parentId) ?? targetParentId) : targetParentId;
    newWidgets[newId] = {
      ...srcWidget,
      id: newId,
      parentId: mappedParentId,
      childrenIds: srcWidget.childrenIds.map((cid) => idMap.get(cid) ?? cid),
    };
  }

  const newRootIds: string[] = [];
  for (const root of payload.roots) {
    const newId = idMap.get(root.widgetId);
    if (!newId) continue;
    newRootIds.push(newId);
    newWidgets[newId] = { ...newWidgets[newId], parentId: targetParentId, x: root.absX, y: root.absY };
  }

  const insertAt = targetIndex ?? targetParent.childrenIds.length;
  const nextChildrenIds = [...targetParent.childrenIds];
  nextChildrenIds.splice(insertAt, 0, ...newRootIds);

  return {
    nextProject: {
      ...project,
      widgetsById: {
        ...project.widgetsById,
        ...newWidgets,
        [targetParentId]: { ...targetParent, childrenIds: nextChildrenIds },
      },
    },
    newRootIds,
  };
}
