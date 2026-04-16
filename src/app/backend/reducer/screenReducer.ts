import {
  type EditorAction,
  type EditorState,
  type ProjectSnapshot,
  type ScreenModel,
  type WidgetNode,
} from "../types";
import { normalizeEditableWidgetPropertyValue } from "../validation";
import {
  cloneSubtreeWithNewIds,
  getActiveScreen,
  removeSubtree,
  transformProjectWidgets,
} from "../tree";
import {
  commitProjectChange,
  makeUniqueName,
  getNextScreenId,
  getNextWidgetId,
  getScreenFallbackId,
  pruneDanglingEventBindings,
} from "./helpers";

export function handleCreateScreen(state: EditorState, _action: EditorAction): EditorState {
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
        meta: { width: 480, height: 320, fill: "#1f2937" },
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

export function handleRenameScreen(state: EditorState, action: EditorAction): EditorState {
  const screenId = action.screenId as string;
  const requestedName = (action.name as string | undefined)?.trim();
  if (!screenId || !requestedName) return state;

  const target = state.project.screens.find((screen) => screen.id === screenId);
  if (!target) return state;

  const namesWithoutTarget = state.project.screens
    .filter((screen) => screen.id !== screenId)
    .map((screen) => screen.name);
  const nextName = makeUniqueName(namesWithoutTarget, requestedName);
  if (nextName === target.name) return state;

  const nextProject: ProjectSnapshot = {
    ...state.project,
    screens: state.project.screens.map((screen) =>
      screen.id === screenId ? { ...screen, name: nextName } : screen,
    ),
  };

  return commitProjectChange(state, nextProject);
}

export function handleDuplicateScreen(state: EditorState, action: EditorAction): EditorState {
  const sourceScreenId = (action.screenId as string) || state.project.activeScreenId;
  const sourceScreen = state.project.screens.find((screen) => screen.id === sourceScreenId);
  if (!sourceScreen) return state;

  const usedWidgetIds = new Set(Object.keys(state.project.widgetsById));
  const subtreeClone = cloneSubtreeWithNewIds(state.project, sourceScreen.rootNodeId, (sourceId: string) => {
    const source = state.project.widgetsById[sourceId];
    const prefix = source?.type ? source.type.toLowerCase() : "widget";
    let counter = 1;
    let nextId = `${prefix}-${counter}`;
    while (usedWidgetIds.has(nextId)) { counter += 1; nextId = `${prefix}-${counter}`; }
    usedWidgetIds.add(nextId);
    return nextId;
  });

  if (!subtreeClone) return state;

  const nextScreenId = getNextScreenId(state.project);
  const namesWithoutNew = state.project.screens.map((screen) => screen.name);
  const nextName = makeUniqueName(namesWithoutNew, `${sourceScreen.name} Copy`);

  const nextProject: ProjectSnapshot = {
    ...state.project,
    activeScreenId: nextScreenId,
    screens: [
      ...state.project.screens,
      { id: nextScreenId, name: nextName, rootNodeId: subtreeClone.newRootId, meta: { ...sourceScreen.meta } },
    ],
    widgetsById: { ...state.project.widgetsById, ...subtreeClone.widgets },
  };

  return commitProjectChange(state, nextProject, []);
}

export function handleDeleteScreen(state: EditorState, action: EditorAction): EditorState {
  const screenId = (action.screenId as string) || state.project.activeScreenId;
  if (state.project.screens.length <= 1) return state;

  const target = state.project.screens.find((screen) => screen.id === screenId);
  if (!target) return state;

  const remainingScreens = state.project.screens.filter((screen) => screen.id !== screenId);
  const fallbackId = getScreenFallbackId(remainingScreens, screenId);
  const projectWithoutWidgets = removeSubtree(state.project, target.rootNodeId);

  const nextProject: ProjectSnapshot = {
    ...projectWithoutWidgets,
    screens: remainingScreens,
    activeScreenId: state.project.activeScreenId === screenId ? fallbackId : state.project.activeScreenId,
  };

  return commitProjectChange(state, pruneDanglingEventBindings(nextProject), []);
}

export function handleUpdateScreenMeta(state: EditorState, action: EditorAction): EditorState {
  const screenId = action.screenId as string;
  const key = action.key as "width" | "height" | "fill";
  const value = action.value;
  const targetScreen = state.project.screens.find((screen) => screen.id === screenId);
  if (!targetScreen) return state;

  const normalizedValue = normalizeEditableWidgetPropertyValue(key, value as string | number | boolean);
  if (normalizedValue === null) return state;

  let nextProject: ProjectSnapshot = {
    ...state.project,
    screens: state.project.screens.map((screen) =>
      screen.id === screenId
        ? { ...screen, meta: { ...screen.meta, [key]: normalizedValue } }
        : screen,
    ),
  };

  if (key === "width" || key === "height" || key === "fill") {
    nextProject = transformProjectWidgets(nextProject, [targetScreen.rootNodeId], (widget: WidgetNode) => ({
      ...widget,
      [key]: normalizedValue,
    }));
  }

  return commitProjectChange(state, nextProject);
}
