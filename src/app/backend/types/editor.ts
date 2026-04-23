import type {
  WidgetType,
  EditableWidgetProperty,
  EditableWidgetPropertyValue,
} from "./widget";
import type { EventBinding, WidgetEventType } from "./event";
import type { AlignmentOperation, ColorFormat } from "./style";
import type {
  ProjectSnapshot,
  CanvasSnapSettings,
  HydrateProjectResult,
  ExportLvglResult,
} from "./project";

export interface Point {
  // World-space point used by canvas interactions.
  x: number;
  y: number;
}

export interface HistoryState {
  past: ProjectSnapshot[];
  future: ProjectSnapshot[];
}

export interface InteractionState {
  kind: "move" | "resize";
  widgetIds: string[];
  pointerStart: Point;
  startProject: ProjectSnapshot;
  handle?: "se";
}

export interface EditorState {
  project: ProjectSnapshot;
  selectedWidgetIds: string[];
  history: HistoryState;
  interaction: InteractionState | null;
}

export interface EditorAction {
  type: string;
  [key: string]: unknown;
}

export interface EditorBackendValue {
  state: EditorState;
  actions: {
    selectWidget: (widgetId: string, additive?: boolean) => void;
    clearSelection: () => void;
    setActiveScreen: (screenId: string) => void;
    createScreen: () => void;
    renameScreen: (screenId: string, name: string) => void;
    duplicateScreen: (screenId: string) => void;
    deleteScreen: (screenId: string) => void;
    beginInteraction: (kind: "move" | "resize", widgetIds: string[], pointer: Point, handle?: "se") => void;
    updateInteraction: (pointer: Point) => void;
    commitInteraction: (squash?: boolean) => void;
    cancelInteraction: () => void;
    addWidget: (parentId: string, widgetType: WidgetType, x: number, y: number) => void;
    deleteSelectedWidgets: () => void;
    moveWidget: (widgetId: string, targetParentId: string, targetIndex: number) => void;
    updateWidgetProperty: (
      widgetId: string,
      propertyName: EditableWidgetProperty,
      value: EditableWidgetPropertyValue,
    ) => void;
    clearWidgetProperty: (widgetId: string, propertyName: "fill" | "textColor") => void;
    createStyleToken: (name: string, value: string) => void;
    updateStyleToken: (tokenId: string, updates: { name?: string; value?: string }) => void;
    deleteStyleToken: (tokenId: string) => void;
    assignWidgetStyleToken: (widgetId: string, propertyName: "fill" | "textColor", tokenId: string | null) => void;
    importAssets: (files: FileList | File[]) => Promise<{ ok: true; importedCount: number } | { ok: false; error: string }>;
    deleteAsset: (assetId: string) => void;
    assignWidgetAsset: (widgetId: string, assetId: string | null) => void;
    setWidgetOptions: (widgetId: string, options: string[]) => void;
    setWidgetSelectedOption: (widgetId: string, index: number) => void;
    upsertWidgetEventBinding: (widgetId: string, binding: EventBinding) => void;
    removeWidgetEventBinding: (widgetId: string, event: WidgetEventType) => void;
    batchUpdateWidgetProperty: (widgetIds: string[], propertyName: EditableWidgetProperty, value: EditableWidgetPropertyValue) => void;
    batchUpsertWidgetEventBinding: (widgetIds: string[], binding: EventBinding) => void;
    batchRemoveWidgetEventBinding: (widgetIds: string[], event: WidgetEventType) => void;
    applyAlignmentOperation: (operation: AlignmentOperation) => void;
    setSelection: (widgetIds: string[]) => void;
    updateScreenMeta: (screenId: string, key: "width" | "height" | "fill", value: EditableWidgetPropertyValue) => void;
    setColorFormat: (format: ColorFormat) => void;
    setCanvasSnapSettings: (settings: Partial<CanvasSnapSettings>) => void;
    setProjectName: (projectName: string) => void;
    copySelectionToClipboard: () => void;
    pasteFromClipboard: () => void;
    duplicateWidgets: (sourceIds: string[]) => string[];
    duplicateSelectionInPlace: () => string[];
    duplicateToTarget: (sourceIds: string[], targetParentId: string, targetIndex: number) => void;
    serializeProject: () => string;
    hydrateProject: (serializedProject: string) => HydrateProjectResult;
    exportLvglC: () => Promise<ExportLvglResult>;
    undo: () => void;
    redo: () => void;
  };
}
