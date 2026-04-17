import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deserializeProjectSnapshot,
  isSupportedAssetMimeType,
  isWithinAssetSizeLimit,
  serializeProjectSnapshot,
  createInitialProject,
} from "./validation";
import { editorReducer } from "./reducer";
import { getActiveScreen } from "./tree";
import { generateLvglZip } from "./codegen/generator";
import { loadActiveProjectFromIndexedDb, saveActiveProjectToIndexedDb } from "./persistence";
import type {
  AlignmentOperation,
  AssetItem,
  AssetMimeType,
  CanvasSnapSettings,
  ColorFormat,
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

function createAssetId(): string {
  const random = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `asset-${random.toLowerCase()}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to read asset file"));
        return;
      }

      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Failed to read asset file"));
    reader.readAsDataURL(file);
  });
}

export function EditorBackendProvider({ children }: { children: ReactNode }) {
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const [state, dispatch] = useReducer(editorReducer, undefined, () => ({
    project: createInitialProject(),
    selectedWidgetIds: [],
    history: {
      past: [],
      future: [],
    },
    interaction: null,
  }));

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const saved = await loadActiveProjectFromIndexedDb();
        if (!saved || cancelled) {
          return;
        }

        const restored = deserializeProjectSnapshot(saved.serializedProject);
        if (restored.ok) {
          dispatch({ type: "hydrateProject", project: restored.project });
          if (restored.warning) {
            console.warn(restored.warning);
          }
        }
      } catch (error) {
        console.warn("Failed to restore project from IndexedDB", error);
      } finally {
        if (!cancelled) {
          setIsPersistenceReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPersistenceReady) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveTimerRef.current = window.setTimeout(() => {
      const serialized = serializeProjectSnapshot(state.project);
      void saveActiveProjectToIndexedDb(serialized).catch((error) => {
        console.warn("Failed to persist project to IndexedDB", error);
      });
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [state.project, isPersistenceReady]);

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
      deleteSelectedWidgets: () => dispatch({ type: "deleteSelectedWidgets" }),
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
      importAssets: async (files: FileList | File[]) => {
        const fileList = Array.from(files);
        const validFiles = fileList.filter((file) => isSupportedAssetMimeType(file.type) && isWithinAssetSizeLimit(file.size));
        if (validFiles.length === 0) {
          return { ok: false, error: "No valid image assets selected (png/jpeg/gif, <= 1MB)" };
        }

        const importedAssets: AssetItem[] = [];
        for (const file of validFiles) {
          const dataUrl = await readFileAsDataUrl(file);
          importedAssets.push({
            id: createAssetId(),
            name: file.name,
            mimeType: file.type as AssetMimeType,
            dataUrl,
          });
        }

        dispatch({ type: "importAssets", assets: importedAssets });
        return { ok: true, importedCount: importedAssets.length };
      },
      deleteAsset: (assetId: string) => dispatch({ type: "deleteAsset", assetId }),
      assignWidgetAsset: (widgetId: string, assetId: string | null) => dispatch({ type: "assignWidgetAsset", widgetId, assetId }),
      setWidgetOptions: (widgetId: string, options: string[]) =>
        dispatch({ type: "setWidgetOptions", widgetId, options }),
      setWidgetSelectedOption: (widgetId: string, index: number) =>
        dispatch({ type: "setWidgetSelectedOption", widgetId, index }),
      upsertWidgetEventBinding: (widgetId: string, binding: EventBinding) =>
        dispatch({ type: "upsertWidgetEventBinding", widgetId, binding }),
      removeWidgetEventBinding: (widgetId: string, event: WidgetEventType) =>
        dispatch({ type: "removeWidgetEventBinding", widgetId, event }),
      batchUpdateWidgetProperty: (widgetIds: string[], propertyName: EditableWidgetProperty, value: EditableWidgetPropertyValue) => {
        if (widgetIds.length === 0) return;
        dispatch({ type: "batchUpdateWidgetProperty", widgetIds, propertyName, value });
      },
      batchUpsertWidgetEventBinding: (widgetIds: string[], binding: EventBinding) => {
        if (widgetIds.length === 0) return;
        dispatch({ type: "batchUpsertWidgetEventBinding", widgetIds, binding });
      },
      batchRemoveWidgetEventBinding: (widgetIds: string[], event: WidgetEventType) => {
        if (widgetIds.length === 0) return;
        dispatch({ type: "batchRemoveWidgetEventBinding", widgetIds, event });
      },
      applyAlignmentOperation: (operation: AlignmentOperation) => {
        if (state.selectedWidgetIds.length === 0) return;
        dispatch({ type: "applyAlignmentOperation", operation, widgetIds: state.selectedWidgetIds });
      },
      setSelection: (widgetIds: string[]) => dispatch({ type: "setSelection", widgetIds }),
      updateScreenMeta: (screenId: string, key: "width" | "height" | "fill", value: EditableWidgetPropertyValue) =>
        dispatch({ type: "updateScreenMeta", screenId, key, value }),
      setColorFormat: (format: ColorFormat) => dispatch({ type: "setColorFormat", format }),
      setCanvasSnapSettings: (settings: Partial<CanvasSnapSettings>) => dispatch({ type: "setCanvasSnapSettings", settings }),
      serializeProject: () => serializeProjectSnapshot(state.project),
      hydrateProject: (serializedProject: string): HydrateProjectResult => {
        const result = deserializeProjectSnapshot(serializedProject);
        if (!result.ok) {
          return result;
        }

        dispatch({ type: "hydrateProject", project: result.project });
        return { ok: true, warning: result.warning };
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
    [state],
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
