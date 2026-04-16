import {
  type EditorAction,
  type EditorState,
  type ProjectSnapshot,
  type ScreenModel,
  type WidgetNode,
  type WidgetType,
  INSERTABLE_WIDGET_TYPES,
} from "../types";
import {
  canEditWidgetProperty,
  isEditableWidgetProperty,
  normalizeEditableWidgetPropertyValue,
} from "../validation";
import {
  canContainChildren,
  getActiveScreen,
  getWidgetById,
  insertWidget,
  moveWidgetInProject,
  removeSubtree,
  transformProjectWidgets,
} from "../tree";
import { createWidgetNode } from "../widgets";
import {
  clearWidgetColorOverride,
  commitProjectChange,
  getDeletableSelectedWidgetIds,
  pruneDanglingEventBindings,
} from "./helpers";

export function handleAddWidget(state: EditorState, action: EditorAction): EditorState {
  const parentId = action.parentId as string;
  const widgetType = action.widgetType as WidgetType;
  const x = Number(action.x ?? 0);
  const y = Number(action.y ?? 0);

  if (!parentId || !INSERTABLE_WIDGET_TYPES.includes(widgetType)) return state;

  const parentNode = getWidgetById(state.project, parentId);
  if (!parentNode || !canContainChildren(parentNode.type)) return state;

  const widget = createWidgetNode(state.project, widgetType, Math.max(0, x), Math.max(0, y));
  const nextProject = insertWidget(state.project, parentId, widget);
  return commitProjectChange(state, nextProject, [widget.id]);
}

export function handleDeleteSelectedWidgets(state: EditorState, _action: EditorAction): EditorState {
  if (state.interaction) return state;

  const deletableIds = getDeletableSelectedWidgetIds(state.project, state.selectedWidgetIds);
  if (deletableIds.length === 0) return state;

  let nextProject = state.project;
  for (const widgetId of deletableIds) {
    nextProject = removeSubtree(nextProject, widgetId);
  }

  return commitProjectChange(state, pruneDanglingEventBindings(nextProject), []);
}

export function handleMoveWidget(state: EditorState, action: EditorAction): EditorState {
  const widgetId = action.widgetId as string;
  const targetParentId = action.targetParentId as string;
  const targetIndex = Number(action.targetIndex ?? 0);

  if (!widgetId || !targetParentId) return state;

  const activeScreen = getActiveScreen(state.project);
  if (widgetId === activeScreen.rootNodeId) return state;

  const nextProject = moveWidgetInProject(state.project, widgetId, targetParentId, targetIndex);
  if (JSON.stringify(nextProject) === JSON.stringify(state.project)) return state;

  return commitProjectChange(state, nextProject, [widgetId]);
}

export function handleUpdateWidgetProperty(state: EditorState, action: EditorAction): EditorState {
  const widgetId = action.widgetId as string;
  const propertyName = action.propertyName as string;
  const value = action.value;

  if (!widgetId || !isEditableWidgetProperty(propertyName) || state.interaction) return state;

  const targetWidget = getWidgetById(state.project, widgetId);
  if (!targetWidget || !canEditWidgetProperty(targetWidget.type, propertyName)) return state;

  const normalizedValue = normalizeEditableWidgetPropertyValue(propertyName, value as string | number | boolean);
  if (normalizedValue === null) return state;

  if ((targetWidget as Record<string, unknown>)[propertyName] === normalizedValue) return state;

  let nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => ({
    ...widget,
    [propertyName]: normalizedValue,
  }));

  const activeScreen = getActiveScreen(nextProject);
  if (widgetId === activeScreen.rootNodeId && (propertyName === "width" || propertyName === "height" || propertyName === "fill")) {
    nextProject = {
      ...nextProject,
      screens: nextProject.screens.map((screen: ScreenModel) =>
        screen.id === activeScreen.id
          ? { ...screen, meta: { ...screen.meta, [propertyName]: normalizedValue } }
          : screen,
      ),
    };
  }

  return commitProjectChange(state, nextProject, [widgetId]);
}

export function handleClearWidgetProperty(state: EditorState, action: EditorAction): EditorState {
  const widgetId = action.widgetId as string;
  const propertyName = action.propertyName as "fill" | "textColor";

  if (!widgetId || (propertyName !== "fill" && propertyName !== "textColor")) return state;

  const targetWidget = getWidgetById(state.project, widgetId);
  if (!targetWidget) return state;

  const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) =>
    clearWidgetColorOverride(widget, propertyName),
  );
  if (JSON.stringify(nextProject) === JSON.stringify(state.project)) return state;

  return commitProjectChange(state, nextProject, [widgetId]);
}

export function handleSetWidgetOptions(state: EditorState, action: EditorAction): EditorState {
  const widgetId = action.widgetId as string;
  const options = action.options as string[];
  if (!widgetId || !Array.isArray(options)) return state;

  const targetWidget = getWidgetById(state.project, widgetId);
  if (!targetWidget) return state;

  const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => ({
    ...widget,
    options,
  }));
  if (JSON.stringify(nextProject) === JSON.stringify(state.project)) return state;

  return commitProjectChange(state, nextProject, [widgetId]);
}

export function handleSetWidgetSelectedOption(state: EditorState, action: EditorAction): EditorState {
  const widgetId = action.widgetId as string;
  const index = Number(action.index);
  if (!widgetId || !Number.isFinite(index) || index < 0) return state;

  const targetWidget = getWidgetById(state.project, widgetId);
  if (!targetWidget) return state;

  const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => ({
    ...widget,
    selectedOptionIndex: index,
  }));
  if (JSON.stringify(nextProject) === JSON.stringify(state.project)) return state;

  return commitProjectChange(state, nextProject, [widgetId]);
}
