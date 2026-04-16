import {
  KNOWN_WIDGET_EVENTS,
  type AssetItem,
  type EventBinding,
  INSERTABLE_WIDGET_TYPES,
  type EditableWidgetProperty,
  type EditableWidgetPropertyValue,
  type EditorAction,
  type EditorState,
  type Point,
  type ProjectSnapshot,
  type ScreenModel,
  type StyleToken,
  type WidgetNode,
  type WidgetEventBindings,
  type WidgetEventType,
  type WidgetType,
} from "./types";
import {
  canEditWidgetProperty,
  isEditableWidgetProperty,
  isValidHexColorString,
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

function makeUniqueTokenName(existingNames: string[], baseName: string): string {
  const normalized = baseName.trim() || "Token";
  if (!existingNames.includes(normalized)) {
    return normalized;
  }

  let counter = 2;
  while (existingNames.includes(`${normalized} ${counter}`)) {
    counter += 1;
  }

  return `${normalized} ${counter}`;
}

function getNextStyleTokenId(project: ProjectSnapshot): string {
  const usedIds = new Set(project.styleTokens.map((token) => token.id));
  let counter = 1;
  while (usedIds.has(`style-token-${counter}`)) {
    counter += 1;
  }
  return `style-token-${counter}`;
}

function sanitizeStyleTokenValue(value: string): string | null {
  const normalized = value.trim();
  return isValidHexColorString(normalized) ? normalized : null;
}

function updateWidgetTokenReference(
  widget: WidgetNode,
  propertyName: "fill" | "textColor",
  tokenId: string | null,
): WidgetNode {
  if (propertyName === "fill") {
    return {
      ...widget,
      fillTokenId: tokenId ?? undefined,
      fill: tokenId ? undefined : widget.fill,
    };
  }

  return {
    ...widget,
    textColorTokenId: tokenId ?? undefined,
    textColor: tokenId ? undefined : widget.textColor,
  };
}

function clearWidgetColorOverride(widget: WidgetNode, propertyName: "fill" | "textColor"): WidgetNode {
  if (propertyName === "fill") {
    return {
      ...widget,
      fill: undefined,
    };
  }

  return {
    ...widget,
    textColor: undefined,
  };
}

function removeTokenReferences(project: ProjectSnapshot, tokenId: string): ProjectSnapshot {
  return transformProjectWidgets(project, Object.keys(project.widgetsById), (widget: WidgetNode) => ({
    ...widget,
    fillTokenId: widget.fillTokenId === tokenId ? undefined : widget.fillTokenId,
    textColorTokenId: widget.textColorTokenId === tokenId ? undefined : widget.textColorTokenId,
  }));
}

function removeAssetReferences(project: ProjectSnapshot, assetId: string): ProjectSnapshot {
  return transformProjectWidgets(project, Object.keys(project.widgetsById), (widget: WidgetNode) => {
    if (widget.assetId !== assetId) {
      return widget;
    }

    return {
      ...widget,
      assetId: undefined,
    };
  });
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

function isScreenRootWidget(project: ProjectSnapshot, widgetId: string): boolean {
  return project.screens.some((screen) => screen.rootNodeId === widgetId);
}

function getDeletableSelectedWidgetIds(project: ProjectSnapshot, selectedWidgetIds: string[]): string[] {
  const activeScreen = getActiveScreen(project);
  const selected = new Set(
    selectedWidgetIds.filter((id) => id !== activeScreen.rootNodeId && Boolean(project.widgetsById[id])),
  );

  if (selected.size === 0) {
    return [];
  }

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

function isBindingValid(project: ProjectSnapshot, binding: EventBinding): boolean {
  if (binding.action.type === "switch_screen") {
    return project.screens.some((screen) => screen.id === binding.action.targetScreenId);
  }

  if (!project.widgetsById[binding.action.targetWidgetId]) {
    return false;
  }

  return !isScreenRootWidget(project, binding.action.targetWidgetId);
}

function pruneDanglingEventBindings(project: ProjectSnapshot): ProjectSnapshot {
  const nextWidgetsById = { ...project.widgetsById };
  let changed = false;

  for (const [widgetId, widget] of Object.entries(project.widgetsById)) {
    if (!widget.eventBindings) {
      continue;
    }

    const nextBindings: WidgetEventBindings = {};
    for (const event of KNOWN_WIDGET_EVENTS) {
      const binding = widget.eventBindings[event];
      if (!binding) {
        continue;
      }

      if (binding.event !== event || !isBindingValid(project, binding)) {
        changed = true;
        continue;
      }

      nextBindings[event] = binding;
    }

    const resolvedBindings = Object.keys(nextBindings).length > 0 ? nextBindings : undefined;
    if (resolvedBindings !== widget.eventBindings) {
      changed = true;
      nextWidgetsById[widgetId] = {
        ...widget,
        eventBindings: resolvedBindings,
      };
    }
  }

  if (!changed) {
    return project;
  }

  return {
    ...project,
    widgetsById: nextWidgetsById,
  };
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

      return commitProjectChange(state, pruneDanglingEventBindings(nextProject), []);
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
    case "deleteSelectedWidgets": {
      if (state.interaction) {
        return state;
      }

      const deletableIds = getDeletableSelectedWidgetIds(state.project, state.selectedWidgetIds);
      if (deletableIds.length === 0) {
        return state;
      }

      let nextProject = state.project;
      for (const widgetId of deletableIds) {
        nextProject = removeSubtree(nextProject, widgetId);
      }

      return commitProjectChange(state, pruneDanglingEventBindings(nextProject), []);
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
    case "clearWidgetProperty": {
      const widgetId = action.widgetId as string;
      const propertyName = action.propertyName as "fill" | "textColor";

      if (!widgetId || (propertyName !== "fill" && propertyName !== "textColor")) {
        return state;
      }

      const targetWidget = getWidgetById(state.project, widgetId);
      if (!targetWidget) {
        return state;
      }

      const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => clearWidgetColorOverride(widget, propertyName));
      if (JSON.stringify(nextProject) === JSON.stringify(state.project)) {
        return state;
      }

      return commitProjectChange(state, nextProject, [widgetId]);
    }
    case "createStyleToken": {
      const name = (action.name as string | undefined)?.trim();
      const value = action.value as string;
      const normalizedValue = sanitizeStyleTokenValue(value);

      if (!name || !normalizedValue) {
        return state;
      }

      const nextToken: StyleToken = {
        id: getNextStyleTokenId(state.project),
        name: makeUniqueTokenName(state.project.styleTokens.map((token) => token.name), name),
        type: "color",
        value: normalizedValue,
      };

      return commitProjectChange(state, {
        ...state.project,
        styleTokens: [...state.project.styleTokens, nextToken],
      });
    }
    case "updateStyleToken": {
      const tokenId = action.tokenId as string;
      const updates = (action.updates as { name?: string; value?: string }) ?? {};
      const tokenIndex = state.project.styleTokens.findIndex((token) => token.id === tokenId);
      if (tokenIndex < 0) {
        return state;
      }

      const current = state.project.styleTokens[tokenIndex];
      const nextName = updates.name !== undefined
        ? makeUniqueTokenName(
            state.project.styleTokens.filter((token) => token.id !== tokenId).map((token) => token.name),
            updates.name,
          )
        : current.name;
      const nextValue = updates.value !== undefined
        ? sanitizeStyleTokenValue(updates.value)
        : current.value;

      if (!nextValue) {
        return state;
      }

      if (nextName === current.name && nextValue === current.value) {
        return state;
      }

      const nextTokens = [...state.project.styleTokens];
      nextTokens[tokenIndex] = {
        ...current,
        name: nextName,
        value: nextValue,
      };

      return commitProjectChange(state, {
        ...state.project,
        styleTokens: nextTokens,
      });
    }
    case "deleteStyleToken": {
      const tokenId = action.tokenId as string;
      if (!tokenId || !state.project.styleTokens.some((token) => token.id === tokenId)) {
        return state;
      }

      const nextProject = removeTokenReferences(
        {
          ...state.project,
          styleTokens: state.project.styleTokens.filter((token) => token.id !== tokenId),
        },
        tokenId,
      );

      return commitProjectChange(state, nextProject);
    }
    case "assignWidgetStyleToken": {
      const widgetId = action.widgetId as string;
      const propertyName = action.propertyName as "fill" | "textColor";
      const tokenId = action.tokenId as string | null;

      if (!widgetId || (propertyName !== "fill" && propertyName !== "textColor")) {
        return state;
      }

      if (tokenId && !state.project.styleTokens.some((token) => token.id === tokenId)) {
        return state;
      }

      const targetWidget = getWidgetById(state.project, widgetId);
      if (!targetWidget) {
        return state;
      }

      const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => updateWidgetTokenReference(widget, propertyName, tokenId));
      if (JSON.stringify(nextProject) === JSON.stringify(state.project)) {
        return state;
      }

      return commitProjectChange(state, nextProject, [widgetId]);
    }
    case "importAssets": {
      const assets = (action.assets as AssetItem[] | undefined) ?? [];
      if (assets.length === 0) {
        return state;
      }

      const nextAssets = { ...state.project.assets };
      let changed = false;
      for (const asset of assets) {
        if (!asset?.id) {
          continue;
        }

        if (nextAssets[asset.id]) {
          continue;
        }

        nextAssets[asset.id] = asset;
        changed = true;
      }

      if (!changed) {
        return state;
      }

      return commitProjectChange(state, {
        ...state.project,
        assets: nextAssets,
      });
    }
    case "deleteAsset": {
      const assetId = action.assetId as string;
      if (!assetId || !state.project.assets[assetId]) {
        return state;
      }

      const { [assetId]: _removed, ...remainingAssets } = state.project.assets;
      const nextProject = removeAssetReferences(
        {
          ...state.project,
          assets: remainingAssets,
        },
        assetId,
      );

      return commitProjectChange(state, nextProject, state.selectedWidgetIds);
    }
    case "assignWidgetAsset": {
      const widgetId = action.widgetId as string;
      const assetId = (action.assetId as string | null) ?? null;

      if (!widgetId) {
        return state;
      }

      const targetWidget = getWidgetById(state.project, widgetId);
      if (!targetWidget || targetWidget.type !== "Image") {
        return state;
      }

      if (assetId && !state.project.assets[assetId]) {
        return state;
      }

      const normalizedAssetId = assetId ?? undefined;
      if (targetWidget.assetId === normalizedAssetId) {
        return state;
      }

      const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => ({
        ...widget,
        assetId: normalizedAssetId,
      }));

      return commitProjectChange(state, nextProject, [widgetId]);
    }
    case "setWidgetOptions": {
      const widgetId = action.widgetId as string;
      const options = action.options as string[];
      if (!widgetId || !Array.isArray(options)) {
        return state;
      }
      const targetWidget = getWidgetById(state.project, widgetId);
      if (!targetWidget) {
        return state;
      }
      const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => ({
        ...widget,
        options,
      }));
      if (JSON.stringify(nextProject) === JSON.stringify(state.project)) {
        return state;
      }
      return commitProjectChange(state, nextProject, [widgetId]);
    }
    case "setWidgetSelectedOption": {
      const widgetId = action.widgetId as string;
      const index = Number(action.index);
      if (!widgetId || !Number.isFinite(index) || index < 0) {
        return state;
      }
      const targetWidget = getWidgetById(state.project, widgetId);
      if (!targetWidget) {
        return state;
      }
      const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => ({
        ...widget,
        selectedOptionIndex: index,
      }));
      if (JSON.stringify(nextProject) === JSON.stringify(state.project)) {
        return state;
      }
      return commitProjectChange(state, nextProject, [widgetId]);
    }
    case "upsertWidgetEventBinding": {
      const widgetId = action.widgetId as string;
      const binding = action.binding as EventBinding;

      if (!widgetId || !binding || !KNOWN_WIDGET_EVENTS.includes(binding.event)) {
        return state;
      }

      const targetWidget = getWidgetById(state.project, widgetId);
      if (!targetWidget || !isBindingValid(state.project, binding)) {
        return state;
      }

      const nextBindings: WidgetEventBindings = {
        ...(targetWidget.eventBindings ?? {}),
        [binding.event]: binding,
      };

      const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => ({
        ...widget,
        eventBindings: nextBindings,
      }));

      if (JSON.stringify(nextProject) === JSON.stringify(state.project)) {
        return state;
      }

      return commitProjectChange(state, nextProject, [widgetId]);
    }
    case "removeWidgetEventBinding": {
      const widgetId = action.widgetId as string;
      const event = action.event as WidgetEventType;
      if (!widgetId || !KNOWN_WIDGET_EVENTS.includes(event)) {
        return state;
      }

      const targetWidget = getWidgetById(state.project, widgetId);
      if (!targetWidget?.eventBindings?.[event]) {
        return state;
      }

      const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => {
        const nextBindings: WidgetEventBindings = { ...(widget.eventBindings ?? {}) };
        delete nextBindings[event];

        return {
          ...widget,
          eventBindings: Object.keys(nextBindings).length > 0 ? nextBindings : undefined,
        };
      });

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
        project: pruneDanglingEventBindings(cloneProject(project)),
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
