import {
  type AlignmentOperation,
  type CanvasSnapSettings,
  type ColorFormat,
  type EditorAction,
  type EditorState,
  type Point,
  DEFAULT_CANVAS_SNAP,
} from "../types";
import { applyAlignmentOperation, applyInteraction } from "../interaction";
import { cloneProject } from "../tree";
import { commitProjectChange, pruneDanglingEventBindings } from "./helpers";
import { handleCreateScreen, handleRenameScreen, handleDuplicateScreen, handleDeleteScreen, handleUpdateScreenMeta } from "./screenReducer";
import { handleAddWidget, handleDeleteSelectedWidgets, handleMoveWidget, handleUpdateWidgetProperty, handleClearWidgetProperty, handleSetWidgetOptions, handleSetWidgetSelectedOption, handleBatchUpdateWidgetProperty } from "./widgetReducer";
import { handleCreateStyleToken, handleUpdateStyleToken, handleDeleteStyleToken, handleAssignWidgetStyleToken } from "./tokenReducer";
import { handleImportAssets, handleDeleteAsset, handleAssignWidgetAsset } from "./assetReducer";
import { handleUpsertWidgetEventBinding, handleRemoveWidgetEventBinding, handleBatchUpsertWidgetEventBinding, handleBatchRemoveWidgetEventBinding } from "./eventReducer";

const VALID_COLOR_FORMATS: ColorFormat[] = ["monochrome", "grayscale8", "rgb565", "rgb888", "argb8888"];

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    // --- Selection ---
    case "selectWidget": {
      const widgetId = action.widgetId as string;
      const additive = Boolean(action.additive);
      if (!widgetId) return { ...state, selectedWidgetIds: [] };
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
    case "setSelection": {
      const widgetIds = action.widgetIds as string[];
      return { ...state, selectedWidgetIds: Array.isArray(widgetIds) ? widgetIds : [] };
    }
    case "setActiveScreen": {
      const screenId = action.screenId as string;
      if (!state.project.screens.some((screen) => screen.id === screenId)) return state;
      return { ...state, project: { ...state.project, activeScreenId: screenId }, selectedWidgetIds: [] };
    }

    // --- Screens ---
    case "createScreen":    return handleCreateScreen(state, action);
    case "renameScreen":    return handleRenameScreen(state, action);
    case "duplicateScreen": return handleDuplicateScreen(state, action);
    case "deleteScreen":    return handleDeleteScreen(state, action);
    case "updateScreenMeta": return handleUpdateScreenMeta(state, action);

    // --- Interaction ---
    case "beginInteraction": {
      const widgetIds = action.widgetIds as string[];
      if (!widgetIds.length) return state;
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
      if (!state.interaction) return state;
      return {
        ...state,
        project: applyInteraction(state.interaction.startProject, state.interaction, action.pointer as Point),
      };
    }
    case "commitInteraction": {
      if (!state.interaction) return state;
      if (JSON.stringify(state.project) === JSON.stringify(state.interaction.startProject)) {
        return { ...state, interaction: null };
      }
      return {
        ...state,
        history: { past: [...state.history.past, state.interaction.startProject], future: [] },
        interaction: null,
      };
    }
    case "cancelInteraction": {
      if (!state.interaction) return state;
      return { ...state, project: state.interaction.startProject, interaction: null };
    }

    // --- Widgets ---
    case "addWidget":               return handleAddWidget(state, action);
    case "deleteSelectedWidgets":   return handleDeleteSelectedWidgets(state, action);
    case "moveWidget":              return handleMoveWidget(state, action);
    case "updateWidgetProperty":    return handleUpdateWidgetProperty(state, action);
    case "clearWidgetProperty":     return handleClearWidgetProperty(state, action);
    case "setWidgetOptions":        return handleSetWidgetOptions(state, action);
    case "setWidgetSelectedOption": return handleSetWidgetSelectedOption(state, action);

    // --- Tokens ---
    case "createStyleToken":      return handleCreateStyleToken(state, action);
    case "updateStyleToken":      return handleUpdateStyleToken(state, action);
    case "deleteStyleToken":      return handleDeleteStyleToken(state, action);
    case "assignWidgetStyleToken": return handleAssignWidgetStyleToken(state, action);

    // --- Assets ---
    case "importAssets":      return handleImportAssets(state, action);
    case "deleteAsset":       return handleDeleteAsset(state, action);
    case "assignWidgetAsset": return handleAssignWidgetAsset(state, action);

    // --- Events ---
    case "upsertWidgetEventBinding":       return handleUpsertWidgetEventBinding(state, action);
    case "removeWidgetEventBinding":       return handleRemoveWidgetEventBinding(state, action);
    case "batchUpsertWidgetEventBinding":  return handleBatchUpsertWidgetEventBinding(state, action);
    case "batchRemoveWidgetEventBinding":  return handleBatchRemoveWidgetEventBinding(state, action);

    // --- Batch ---
    case "batchUpdateWidgetProperty": return handleBatchUpdateWidgetProperty(state, action);
    case "applyAlignmentOperation": {
      if (state.interaction) return state;
      const widgetIds = Array.isArray(action.widgetIds) ? (action.widgetIds as string[]) : [];
      const operation = action.operation as AlignmentOperation;
      const nextProject = applyAlignmentOperation(state.project, widgetIds, operation);
      return commitProjectChange(state, nextProject, state.selectedWidgetIds);
    }

    // --- Project / History ---
    case "hydrateProject": {
      if (state.interaction) return state;
      const project = action.project as EditorState["project"];
      if (!project) return state;
      if (JSON.stringify(state.project) === JSON.stringify(project)) return state;
      return {
        ...state,
        project: pruneDanglingEventBindings(cloneProject(project)),
        selectedWidgetIds: [],
        history: { past: [], future: [] },
        interaction: null,
      };
    }
    case "undo": {
      if (state.interaction || state.history.past.length === 0) return state;
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
      if (state.interaction || state.history.future.length === 0) return state;
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

    // --- Settings ---
    case "setColorFormat": {
      const format = action.format as ColorFormat;
      if (!VALID_COLOR_FORMATS.includes(format)) return state;
      return commitProjectChange(state, { ...state.project, colorFormat: format });
    }
    case "setCanvasSnapSettings": {
      const updates = action.settings as Partial<CanvasSnapSettings>;
      const current = state.project.canvasSnap ?? { ...DEFAULT_CANVAS_SNAP };
      const next: CanvasSnapSettings = {
        pixelSnapEnabled: typeof updates.pixelSnapEnabled === "boolean" ? updates.pixelSnapEnabled : current.pixelSnapEnabled,
        magnetSnapEnabled: typeof updates.magnetSnapEnabled === "boolean" ? updates.magnetSnapEnabled : current.magnetSnapEnabled,
        snapThresholdPx: typeof updates.snapThresholdPx === "number" ? updates.snapThresholdPx : current.snapThresholdPx,
      };
      return commitProjectChange(state, { ...state.project, canvasSnap: next });
    }

    default:
      return state;
  }
}
