import {
  INSERTABLE_WIDGET_TYPES,
  type EditableWidgetPropertyValue,
  type EditorAction,
  type EditorState,
  type Point,
  type ProjectSnapshot,
  type WidgetNode,
  type WidgetType,
} from "./types";
import {
  canEditWidgetProperty,
  isEditableWidgetProperty,
  normalizeEditableWidgetPropertyValue,
} from "./validation";
import { applyInteraction } from "./interaction";
import { createWidgetNode } from "./widgets";
import {
  canContainChildren,
  cloneProject,
  collectWidgetIds,
  findWidgetById,
  findWidgetLocation,
  getActiveScreen,
  insertChild,
  removeChild,
  transformProjectWidgets,
  updateActiveScreen,
} from "./tree";

function commitProjectChange(
  state: EditorState,
  nextProject: ProjectSnapshot,
  selectedWidgetIds: string[] = state.selectedWidgetIds,
): EditorState {
  if (JSON.stringify(nextProject) === JSON.stringify(state.project)) {
    return state;
  }

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

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "selectWidget": {
      const widgetId = action.widgetId as string;
      const additive = Boolean(action.additive);

      if (!widgetId) {
        return { ...state, selectedWidgetIds: [] };
      }

      if (additive) {
        const exists = state.selectedWidgetIds.includes(widgetId);
        const selectedWidgetIds = exists
          ? state.selectedWidgetIds.filter((id) => id !== widgetId)
          : [...state.selectedWidgetIds, widgetId];

        return { ...state, selectedWidgetIds };
      }

      return { ...state, selectedWidgetIds: [widgetId] };
    }
    case "clearSelection":
      return { ...state, selectedWidgetIds: [] };
    case "setActiveScreen": {
      const screenId = action.screenId as string;
      return {
        ...state,
        project: {
          ...state.project,
          activeScreenId: screenId,
        },
        selectedWidgetIds: [],
      };
    }
    case "beginInteraction": {
      const widgetIds = action.widgetIds as string[];

      if (!widgetIds.length) {
        return state;
      }

      return {
        ...state,
        interaction: {
          kind: action.kind as "move" | "resize",
          widgetIds,
          pointerStart: action.pointer as Point,
          startProject: cloneProject(state.project),
          handle: action.handle as "se" | undefined,
        },
      };
    }
    case "updateInteraction": {
      if (!state.interaction) {
        return state;
      }

      return {
        ...state,
        project: applyInteraction(state.interaction.startProject, state.interaction, action.pointer as Point),
      };
    }
    case "commitInteraction": {
      if (!state.interaction) {
        return state;
      }

      const currentProject = JSON.stringify(state.project);
      const startProject = JSON.stringify(state.interaction.startProject);

      if (currentProject === startProject) {
        return { ...state, interaction: null };
      }

      return {
        ...state,
        history: {
          past: [...state.history.past, state.interaction.startProject],
          future: [],
        },
        interaction: null,
      };
    }
    case "cancelInteraction": {
      if (!state.interaction) {
        return state;
      }

      return {
        ...state,
        project: state.interaction.startProject,
        interaction: null,
      };
    }
    case "addWidget": {
      const parentId = action.parentId as string;
      const widgetType = action.widgetType as WidgetType;
      const x = Number(action.x ?? 0);
      const y = Number(action.y ?? 0);

      if (!parentId || !INSERTABLE_WIDGET_TYPES.includes(widgetType)) {
        return state;
      }

      const activeScreen = getActiveScreen(state.project);
      const parentNode = findWidgetById(activeScreen.rootWidget, parentId);
      if (!parentNode || !canContainChildren(parentNode.type)) {
        return state;
      }

      const widget = createWidgetNode(state.project, widgetType, Math.max(0, x), Math.max(0, y));
      const nextProject = updateActiveScreen(state.project, (screen) => ({
        ...screen,
        rootWidget: insertChild(screen.rootWidget, parentId, widget),
      }));

      return commitProjectChange(state, nextProject, [widget.id]);
    }
    case "moveWidget": {
      const widgetId = action.widgetId as string;
      const targetParentId = action.targetParentId as string;
      const targetIndex = Number(action.targetIndex ?? 0);

      if (!widgetId || !targetParentId) {
        return state;
      }

      const activeScreen = getActiveScreen(state.project);
      if (widgetId === activeScreen.rootWidget.id) {
        return state;
      }

      const sourceLocation = findWidgetLocation(activeScreen.rootWidget, widgetId);
      if (!sourceLocation?.parentId) {
        return state;
      }

      const sourceParentId = sourceLocation.parentId;
      const sourceIndex = sourceLocation.index;

      const sourceWidget = sourceLocation.widget;
      const sourceWidgetDescendants = collectWidgetIds(sourceWidget);
      if (sourceWidgetDescendants.has(targetParentId)) {
        return state;
      }

      const targetParent = findWidgetById(activeScreen.rootWidget, targetParentId);
      if (!targetParent || !canContainChildren(targetParent.type)) {
        return state;
      }

      const normalizedTargetIndex = Math.max(0, Math.min(targetIndex, targetParent.children.length));
      const sameParent = sourceParentId === targetParentId;
      const adjustedTargetIndex = sameParent && sourceIndex < normalizedTargetIndex
        ? normalizedTargetIndex - 1
        : normalizedTargetIndex;

      if (sameParent && sourceIndex === adjustedTargetIndex) {
        return state;
      }

      const removedResult = removeChild(activeScreen.rootWidget, sourceParentId, sourceIndex);
      if (!removedResult.removed) {
        return state;
      }

      const insertedRoot = insertChild(removedResult.root, targetParentId, removedResult.removed, adjustedTargetIndex);
      const nextProject = updateActiveScreen(state.project, (screen) => ({
        ...screen,
        rootWidget: insertedRoot,
      }));

      return commitProjectChange(state, nextProject, [widgetId]);
    }
    case "updateWidgetProperty": {
      const widgetId = action.widgetId as string;
      const propertyName = action.propertyName as unknown;
      const value = action.value as EditableWidgetPropertyValue;

      if (!widgetId || !isEditableWidgetProperty(propertyName) || state.interaction) {
        return state;
      }

      const activeScreen = getActiveScreen(state.project);
      const targetWidget = findWidgetById(activeScreen.rootWidget, widgetId);
      if (!targetWidget || !canEditWidgetProperty(targetWidget.type, propertyName)) {
        return state;
      }

      const normalizedValue = normalizeEditableWidgetPropertyValue(propertyName, value);
      if (normalizedValue === null) {
        return state;
      }

      if ((targetWidget as Record<string, unknown>)[propertyName] === normalizedValue) {
        return state;
      }

      const nextProject = transformProjectWidgets(state.project, [widgetId], (widget) => ({
        ...widget,
        [propertyName]: normalizedValue,
      } as WidgetNode));

      return commitProjectChange(state, nextProject, [widgetId]);
    }
    case "hydrateProject": {
      if (state.interaction) {
        return state;
      }

      const project = action.project as ProjectSnapshot;
      if (!project) {
        return state;
      }

      const serializedCurrent = JSON.stringify(state.project);
      const serializedIncoming = JSON.stringify(project);
      if (serializedCurrent === serializedIncoming) {
        return state;
      }

      return {
        ...state,
        project: cloneProject(project),
        selectedWidgetIds: [],
        history: {
          past: [],
          future: [],
        },
        interaction: null,
      };
    }
    case "undo": {
      if (state.interaction || state.history.past.length === 0) {
        return state;
      }

      const previous = state.history.past[state.history.past.length - 1];

      return {
        ...state,
        project: cloneProject(previous),
        history: {
          past: state.history.past.slice(0, -1),
          future: [cloneProject(state.project), ...state.history.future],
        },
      };
    }
    case "redo": {
      if (state.interaction || state.history.future.length === 0) {
        return state;
      }

      const [nextProject, ...remainingFuture] = state.history.future;

      return {
        ...state,
        project: cloneProject(nextProject),
        history: {
          past: [...state.history.past, cloneProject(state.project)],
          future: remainingFuture,
        },
      };
    }
    default:
      return state;
  }
}
