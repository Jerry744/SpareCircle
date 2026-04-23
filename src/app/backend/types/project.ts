import type { WidgetNode } from "./widget";
import type { StyleToken, ColorFormat } from "./style";
import type { AssetItem } from "./asset";

export interface ScreenMeta {
  width: number;
  height: number;
  fill?: string;
}

export interface ScreenModel {
  id: string;
  name: string;
  rootNodeId: string;
  meta: ScreenMeta;
}

export interface CanvasSnapSettings {
  pixelSnapEnabled: boolean;
  magnetSnapEnabled: boolean;
  snapThresholdPx: number;
}

export const DEFAULT_CANVAS_SNAP: CanvasSnapSettings = {
  pixelSnapEnabled: false,
  magnetSnapEnabled: true,
  snapThresholdPx: 6,
};

export const DEFAULT_PROJECT_NAME = "smart_thermostat.lvproj";

export interface ProjectSnapshot {
  schemaVersion: number;
  projectName: string;
  screens: ScreenModel[];
  activeScreenId: string;
  widgetsById: Record<string, WidgetNode>;
  styleTokens: StyleToken[];
  assets: Record<string, AssetItem>;
  colorFormat?: ColorFormat;
  canvasSnap?: CanvasSnapSettings;
}

export type HydrateProjectResult = { ok: true; warning?: string } | { ok: false; error: string };
export type ExportLvglResult = { ok: true; fileName: string } | { ok: false; error: string };
