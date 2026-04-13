import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  deserializeProjectSnapshot,
  serializeProjectSnapshot,
  createInitialProject,
} from "./validation";
import { editorReducer } from "./reducer";
import { getActiveScreen } from "./tree";
import { generateLvglZip } from "./codegen/generator";
import type {
  EventBinding,
  EditableWidgetProperty,
  EditableWidgetPropertyValue,
  EditorBackendValue,
  ExportLvglResult,
  HydrateProjectResult,
  Point,
  ProjectSnapshot,
  WidgetEventType,
  WidgetType,
} from "./types";

const EditorBackendContext = createContext<EditorBackendValue | null>(null);

export function EditorBackendProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, undefined, () => ({
    project: createInitialProject(),
    selectedWidgetIds: [],
    history: {
      past: [],
      future: [],
    },
    interaction: null,
  }));

  const actions = useMemo(
    () => ({
      selectWidget: (widgetId: string, additive = false) => dispatch({ type: "selectWidget", widgetId, additive }),
      clearSelection: () => dispatch({ type: "clearSelection" }),
      setActiveScreen: (screenId: string) => dispatch({ type: "setActiveScreen", screenId }),
      createScreen: () => dispatch({ type: "createScreen" }),
      renameScreen: (screenId: string, name: string) => dispatch({ type: "renameScreen", screenId, name }),
      duplicateScreen: (screenId: string) => dispatch({ type: "duplicateScreen", screenId }),
      deleteScreen: (screenId: string) => dispatch({ type: "deleteScreen", screenId }),
      beginInteraction: (kind: "move" | "resize", widgetIds: string[], pointer: Point, handle?: "se") =>
        dispatch({ type: "beginInteraction", kind, widgetIds, pointer, handle }),
      updateInteraction: (pointer: Point) => dispatch({ type: "updateInteraction", pointer }),
      commitInteraction: () => dispatch({ type: "commitInteraction" }),
      cancelInteraction: () => dispatch({ type: "cancelInteraction" }),
      addWidget: (parentId: string, widgetType: WidgetType, x: number, y: number) =>
        dispatch({ type: "addWidget", parentId, widgetType, x, y }),
      moveWidget: (widgetId: string, targetParentId: string, targetIndex: number) =>
        dispatch({ type: "moveWidget", widgetId, targetParentId, targetIndex }),
      updateWidgetProperty: (widgetId: string, propertyName: EditableWidgetProperty, value: EditableWidgetPropertyValue) =>
        dispatch({ type: "updateWidgetProperty", widgetId, propertyName, value }),
      clearWidgetProperty: (widgetId: string, propertyName: "fill" | "textColor") =>
        dispatch({ type: "clearWidgetProperty", widgetId, propertyName }),
      createStyleToken: (name: string, value: string) => dispatch({ type: "createStyleToken", name, value }),
      updateStyleToken: (tokenId: string, updates: { name?: string; value?: string }) =>
        dispatch({ type: "updateStyleToken", tokenId, updates }),
      deleteStyleToken: (tokenId: string) => dispatch({ type: "deleteStyleToken", tokenId }),
      assignWidgetStyleToken: (widgetId: string, propertyName: "fill" | "textColor", tokenId: string | null) =>
        dispatch({ type: "assignWidgetStyleToken", widgetId, propertyName, tokenId }),
      upsertWidgetEventBinding: (widgetId: string, binding: EventBinding) =>
        dispatch({ type: "upsertWidgetEventBinding", widgetId, binding }),
      removeWidgetEventBinding: (widgetId: string, event: WidgetEventType) =>
        dispatch({ type: "removeWidgetEventBinding", widgetId, event }),
      updateScreenMeta: (screenId: string, key: "width" | "height" | "fill", value: EditableWidgetPropertyValue) =>
        dispatch({ type: "updateScreenMeta", screenId, key, value }),
      serializeProject: () => serializeProjectSnapshot(state.project),
      hydrateProject: (serializedProject: string): HydrateProjectResult => {
        const result = deserializeProjectSnapshot(serializedProject);
        if (!result.ok) {
          return result;
        }

        dispatch({ type: "hydrateProject", project: result.project });
        return { ok: true };
      },
      exportLvglC: async (): Promise<ExportLvglResult> => {
        try {
          const zipBlob = await generateLvglZip(state.project);
          const url = URL.createObjectURL(zipBlob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = "sparecircle-lvgl-ui.zip";
          anchor.click();
          URL.revokeObjectURL(url);

          return { ok: true, fileName: "sparecircle-lvgl-ui.zip" };
        } catch {
          return { ok: false, error: "Failed to export LVGL C package" };
        }
      },
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
    }),
    [state.project],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <EditorBackendContext.Provider value={value}>{children}</EditorBackendContext.Provider>;
}

export function useEditorBackend() {
  const context = useContext(EditorBackendContext);

  if (!context) {
    throw new Error("useEditorBackend must be used within EditorBackendProvider");
  }

  return context;
}

export function getActiveScreenFromProject(project: ProjectSnapshot) {
  return getActiveScreen(project);
}
