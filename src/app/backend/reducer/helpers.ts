import {
  KNOWN_WIDGET_EVENTS,
  type EditorState,
  type EventBinding,
  type ProjectSnapshot,
  type ScreenModel,
  type StyleToken,
  type WidgetEventBindings,
  type WidgetNode,
} from "../types";
import { isValidHexColorString } from "../validation";
import { cloneProject, getActiveScreen, transformProjectWidgets } from "../tree";

export function makeUniqueName(existingNames: string[], baseName: string): string {
  const normalized = baseName.trim() || "Screen";
  if (!existingNames.includes(normalized)) return normalized;
  let counter = 2;
  while (existingNames.includes(`${normalized} ${counter}`)) counter += 1;
  return `${normalized} ${counter}`;
}

export function makeUniqueTokenName(existingNames: string[], baseName: string): string {
  const normalized = baseName.trim() || "Token";
  if (!existingNames.includes(normalized)) return normalized;
  let counter = 2;
  while (existingNames.includes(`${normalized} ${counter}`)) counter += 1;
  return `${normalized} ${counter}`;
}

export function getNextStyleTokenId(project: ProjectSnapshot): string {
  const usedIds = new Set(project.styleTokens.map((token) => token.id));
  let counter = 1;
  while (usedIds.has(`style-token-${counter}`)) counter += 1;
  return `style-token-${counter}`;
}

export function sanitizeStyleTokenValue(value: string): string | null {
  const normalized = value.trim();
  return isValidHexColorString(normalized) ? normalized : null;
}

export function updateWidgetTokenReference(
  widget: WidgetNode,
  propertyName: "fill" | "textColor",
  tokenId: string | null,
): WidgetNode {
  if (propertyName === "fill") {
    return { ...widget, fillTokenId: tokenId ?? undefined, fill: tokenId ? undefined : widget.fill };
  }
  return { ...widget, textColorTokenId: tokenId ?? undefined, textColor: tokenId ? undefined : widget.textColor };
}

export function clearWidgetColorOverride(widget: WidgetNode, propertyName: "fill" | "textColor"): WidgetNode {
  if (propertyName === "fill") return { ...widget, fill: undefined };
  return { ...widget, textColor: undefined };
}

export function removeTokenReferences(project: ProjectSnapshot, tokenId: string): ProjectSnapshot {
  return transformProjectWidgets(project, Object.keys(project.widgetsById), (widget: WidgetNode) => ({
    ...widget,
    fillTokenId: widget.fillTokenId === tokenId ? undefined : widget.fillTokenId,
    textColorTokenId: widget.textColorTokenId === tokenId ? undefined : widget.textColorTokenId,
  }));
}

export function removeAssetReferences(project: ProjectSnapshot, assetId: string): ProjectSnapshot {
  return transformProjectWidgets(project, Object.keys(project.widgetsById), (widget: WidgetNode) => {
    if (widget.assetId !== assetId) return widget;
    return { ...widget, assetId: undefined };
  });
}

export function getNextScreenId(project: ProjectSnapshot): string {
  const usedIds = new Set(project.screens.map((screen) => screen.id));
  let counter = 1;
  while (usedIds.has(`screen-${counter}`)) counter += 1;
  return `screen-${counter}`;
}

export function getNextWidgetId(project: ProjectSnapshot, preferredPrefix: string): string {
  const usedIds = new Set(Object.keys(project.widgetsById));
  const safePrefix = preferredPrefix.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || "widget";
  let counter = 1;
  while (usedIds.has(`${safePrefix}-${counter}`)) counter += 1;
  return `${safePrefix}-${counter}`;
}

export function isScreenRootWidget(project: ProjectSnapshot, widgetId: string): boolean {
  return project.screens.some((screen) => screen.rootNodeId === widgetId);
}

export function getDeletableSelectedWidgetIds(project: ProjectSnapshot, selectedWidgetIds: string[]): string[] {
  const activeScreen = getActiveScreen(project);
  const selected = new Set(
    selectedWidgetIds.filter((id) => id !== activeScreen.rootNodeId && Boolean(project.widgetsById[id])),
  );
  if (selected.size === 0) return [];
  return Array.from(selected).filter((widgetId) => {
    let parentId = project.widgetsById[widgetId]?.parentId ?? null;
    while (parentId) {
      if (selected.has(parentId)) return false;
      parentId = project.widgetsById[parentId]?.parentId ?? null;
    }
    return true;
  });
}

export function isBindingValid(project: ProjectSnapshot, binding: EventBinding): boolean {
  if (binding.action.type === "switch_screen") {
    return project.screens.some((screen) => screen.id === binding.action.targetScreenId);
  }
  if (!project.widgetsById[binding.action.targetWidgetId]) return false;
  return !isScreenRootWidget(project, binding.action.targetWidgetId);
}

export function pruneDanglingEventBindings(project: ProjectSnapshot): ProjectSnapshot {
  const nextWidgetsById = { ...project.widgetsById };
  let changed = false;

  for (const [widgetId, widget] of Object.entries(project.widgetsById)) {
    if (!widget.eventBindings) continue;
    const nextBindings: WidgetEventBindings = {};
    for (const event of KNOWN_WIDGET_EVENTS) {
      const binding = widget.eventBindings[event];
      if (!binding) continue;
      if (binding.event !== event || !isBindingValid(project, binding)) {
        changed = true;
        continue;
      }
      nextBindings[event] = binding;
    }
    const resolvedBindings = Object.keys(nextBindings).length > 0 ? nextBindings : undefined;
    if (resolvedBindings !== widget.eventBindings) {
      changed = true;
      nextWidgetsById[widgetId] = { ...widget, eventBindings: resolvedBindings };
    }
  }

  if (!changed) return project;
  return { ...project, widgetsById: nextWidgetsById };
}

export function getScreenFallbackId(screens: ScreenModel[], removedScreenId: string): string {
  if (screens.length === 0) return "";
  const removedIndex = screens.findIndex((screen) => screen.id === removedScreenId);
  if (removedIndex < 0) return screens[0].id;
  const fallbackIndex = Math.max(0, Math.min(removedIndex, screens.length - 1));
  return screens[fallbackIndex].id;
}

export function commitProjectChange(
  state: EditorState,
  nextProject: ProjectSnapshot,
  selectedWidgetIds: string[] = state.selectedWidgetIds,
): EditorState {
  if (JSON.stringify(nextProject) === JSON.stringify(state.project)) return state;
  return {
    ...state,
    project: nextProject,
    selectedWidgetIds,
    history: {
      past: [...state.history.past, cloneProject(state.project)],
      future: [],
    },
  };
}

// Re-export StyleToken so sub-modules don't need extra imports
export type { StyleToken };
