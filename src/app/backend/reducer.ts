import {
  INSERTABLE_WIDGET_TYPES,
  type EditableWidgetProperty,
  type EditableWidgetPropertyValue,
  type EditorAction,
  type EditorState,
  type Point,
  type ProjectSnapshot,
  type ScreenModel,
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
  cloneSubtreeWithNewIds,
  cloneProject,
  getActiveScreen,
  getWidgetById,
  insertWidget,
  moveWidgetInProject,
  removeSubtree,
  transformProjectWidgets,
} from "./tree";

function makeUniqueName(existingNames: string[], baseName: string): string {
  const normalized = baseName.trim() || "Screen";
  if (!existingNames.includes(normalized)) {
    return normalized;
  }

  let counter = 2;
  while (existingNames.includes(`${normalized} ${counter}`)) {
    counter += 1;
  }
  return `${normalized} ${counter}`;
}

function getNextScreenId(project: ProjectSnapshot): string {
  const usedIds = new Set(project.screens.map((screen) => screen.id));
  let counter = 1;
  while (usedIds.has(`screen-${counter}`)) {
    counter += 1;
  }
  return `screen-${counter}`;
}

function getNextWidgetId(project: ProjectSnapshot, preferredPrefix: string): string {
  const usedIds = new Set(Object.keys(project.widgetsById));
  const safePrefix = preferredPrefix.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || "widget";
  let counter = 1;
  while (usedIds.has(`${safePrefix}-${counter}`)) {
    counter += 1;
  }
  return `${safePrefix}-${counter}`;
}

function getScreenFallbackId(screens: ScreenModel[], removedScreenId: string): string {
  if (screens.length === 0) {
    return "";
  }

  const removedIndex = screens.findIndex((screen) => screen.id === removedScreenId);
  if (removedIndex < 0) {
    return screens[0].id;
  }

  const fallbackIndex = Math.max(0, Math.min(removedIndex, screens.length - 1));
  return screens[fallbackIndex].id;
}

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
      if (!state.project.screens.some((screen) => screen.id === screenId)) {
        return state;
      }

      return {
        ...state,
        project: {
          ...state.project,
          activeScreenId: screenId,
        },
        selectedWidgetIds: [],
      };
    }
    case "createScreen": {
      const nextScreenId = getNextScreenId(state.project);
      const nextRootId = getNextWidgetId(state.project, "screen-root");
      const existingNames = state.project.screens.map((screen) => screen.name);
      const nextName = makeUniqueName(existingNames, `Screen${state.project.screens.length + 1}`);

      const nextProject: ProjectSnapshot = {
        ...state.project,
        activeScreenId: nextScreenId,
        screens: [
          ...state.project.screens,
          {
            id: nextScreenId,
            name: nextName,
            rootNodeId: nextRootId,
            meta: {
              width: 480,
              height: 320,
              fill: "#1f2937",
            },
          },
        ],
        widgetsById: {
          ...state.project.widgetsById,
          [nextRootId]: {
            id: nextRootId,
            name: `${nextName} Root`,
            type: "Screen",
            parentId: null,
            childrenIds: [],
            x: 0,
            y: 0,
            width: 480,
            height: 320,
            fill: "#1f2937",
            visible: true,
          },
        },
      };

      return commitProjectChange(state, nextProject, []);
    }
    case "renameScreen": {
      const screenId = action.screenId as string;
      const requestedName = (action.name as string | undefined)?.trim();
      if (!screenId || !requestedName) {
        return state;
      }

      const target = state.project.screens.find((screen) => screen.id === screenId);
      if (!target) {
        return state;
      }

      const namesWithoutTarget = state.project.screens.filter((screen) => screen.id !== screenId).map((screen) => screen.name);
      const nextName = makeUniqueName(namesWithoutTarget, requestedName);
      if (nextName === target.name) {
        return state;
      }

      const nextProject: ProjectSnapshot = {
        ...state.project,
        screens: state.project.screens.map((screen) => (
          screen.id === screenId
            ? { ...screen, name: nextName }
            : screen
        )),
      };

      return commitProjectChange(state, nextProject);
    }
    case "duplicateScreen": {
      const sourceScreenId = (action.screenId as string) || state.project.activeScreenId;
      const sourceScreen = state.project.screens.find((screen) => screen.id === sourceScreenId);
      if (!sourceScreen) {
        return state;
      }

      const usedWidgetIds = new Set(Object.keys(state.project.widgetsById));
      const subtreeClone = cloneSubtreeWithNewIds(state.project, sourceScreen.rootNodeId, (sourceId: string) => {
        const source = state.project.widgetsById[sourceId];
        const prefix = source?.type ? source.type.toLowerCase() : "widget";
        let counter = 1;
        let nextId = `${prefix}-${counter}`;
        while (usedWidgetIds.has(nextId)) {
          counter += 1;
          nextId = `${prefix}-${counter}`;
        }
        usedWidgetIds.add(nextId);
        return nextId;
      });

      if (!subtreeClone) {
        return state;
      }

      const nextScreenId = getNextScreenId(state.project);
      const namesWithoutNew = state.project.screens.map((screen) => screen.name);
      const nextName = makeUniqueName(namesWithoutNew, `${sourceScreen.name} Copy`);

      const nextProject: ProjectSnapshot = {
        ...state.project,
        activeScreenId: nextScreenId,
        screens: [
          ...state.project.screens,
          {
            id: nextScreenId,
            name: nextName,
            rootNodeId: subtreeClone.newRootId,
            meta: {
              ...sourceScreen.meta,
            },
          },
        ],
        widgetsById: {
          ...state.project.widgetsById,
          ...subtreeClone.widgets,
        },
      };

      return commitProjectChange(state, nextProject, []);
    }
    case "deleteScreen": {
      const screenId = (action.screenId as string) || state.project.activeScreenId;
      if (state.project.screens.length <= 1) {
        return state;
      }

      const target = state.project.screens.find((screen) => screen.id === screenId);
      if (!target) {
        return state;
      }

      const remainingScreens = state.project.screens.filter((screen) => screen.id !== screenId);
      const fallbackId = getScreenFallbackId(remainingScreens, screenId);
      const projectWithoutWidgets = removeSubtree(state.project, target.rootNodeId);

      const nextProject: ProjectSnapshot = {
        ...projectWithoutWidgets,
        screens: remainingScreens,
        activeScreenId: state.project.activeScreenId === screenId ? fallbackId : state.project.activeScreenId,
      };

      return commitProjectChange(state, nextProject, []);
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

      const parentNode = getWidgetById(state.project, parentId);
      if (!parentNode || !canContainChildren(parentNode.type)) {
        return state;
      }

      const widget = createWidgetNode(state.project, widgetType, Math.max(0, x), Math.max(0, y));
      const nextProject = insertWidget(state.project, parentId, widget);

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
      if (widgetId === activeScreen.rootNodeId) {
        return state;
      }

      const nextProject = moveWidgetInProject(state.project, widgetId, targetParentId, targetIndex);
      if (JSON.stringify(nextProject) === JSON.stringify(state.project)) {
        return state;
      }

      return commitProjectChange(state, nextProject, [widgetId]);
    }
    case "updateWidgetProperty": {
      const widgetId = action.widgetId as string;
      const propertyName = action.propertyName as EditableWidgetProperty;
      const value = action.value as EditableWidgetPropertyValue;

      if (!widgetId || !isEditableWidgetProperty(propertyName) || state.interaction) {
        return state;
      }

      const targetWidget = getWidgetById(state.project, widgetId);
      if (!targetWidget || !canEditWidgetProperty(targetWidget.type, propertyName)) {
        return state;
      }

      const normalizedValue = normalizeEditableWidgetPropertyValue(propertyName, value);
      if (normalizedValue === null) {
        return state;
      }

      if ((targetWidget as Record<EditableWidgetProperty, EditableWidgetPropertyValue | undefined>)[propertyName] === normalizedValue) {
        return state;
      }

      let nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => ({
        ...widget,
        [propertyName]: normalizedValue,
      }));

      const activeScreen = getActiveScreen(nextProject);
      if (widgetId === activeScreen.rootNodeId && (propertyName === "width" || propertyName === "height" || propertyName === "fill")) {
        nextProject = {
          ...nextProject,
          screens: nextProject.screens.map((screen: ScreenModel) => (
            screen.id === activeScreen.id
              ? {
                  ...screen,
                  meta: {
                    ...screen.meta,
                    [propertyName]: normalizedValue,
                  },
                }
              : screen
          )),
        };
      }

      return commitProjectChange(state, nextProject, [widgetId]);
    }
    case "updateScreenMeta": {
      const screenId = action.screenId as string;
      const key = action.key as "width" | "height" | "fill";
      const value = action.value as EditableWidgetPropertyValue;
      const targetScreen = state.project.screens.find((screen) => screen.id === screenId);
      if (!targetScreen) {
        return state;
      }

      const propertyName = key as "width" | "height" | "fill";
      const normalizedValue = normalizeEditableWidgetPropertyValue(propertyName, value);
      if (normalizedValue === null) {
        return state;
      }

      let nextProject: ProjectSnapshot = {
        ...state.project,
        screens: state.project.screens.map((screen) => (
          screen.id === screenId
            ? {
                ...screen,
                meta: {
                  ...screen.meta,
                  [key]: normalizedValue,
                },
              }
            : screen
        )),
      };

      if (key === "width" || key === "height" || key === "fill") {
        nextProject = transformProjectWidgets(nextProject, [targetScreen.rootNodeId], (widget: WidgetNode) => ({
          ...widget,
          [key]: normalizedValue,
        }));
      }

      return commitProjectChange(state, nextProject);
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
