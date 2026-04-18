import {
  KNOWN_WIDGET_EVENTS,
  DEFAULT_CANVAS_SNAP,
  type CanvasSnapSettings,
  type ProjectSnapshot,
  type ScreenMeta,
  type ScreenModel,
  type WidgetNode,
} from "../types";
import { createDefaultUserStyleTokens } from "../../constants/styleTokenPresets";
import { isRecord, isColorFormat, isValidColorString } from "./helpers";
import { parseNormalizedWidget, parseLegacyWidget, flattenLegacyTree } from "./widgetParser";
import { parseAssets } from "./assetParser";
import { parseStyleTokens } from "./tokenParser";

function parseCanvasSnap(input: unknown): CanvasSnapSettings {
  if (!isRecord(input)) return { ...DEFAULT_CANVAS_SNAP };
  return {
    pixelSnapEnabled: typeof input.pixelSnapEnabled === "boolean" ? input.pixelSnapEnabled : DEFAULT_CANVAS_SNAP.pixelSnapEnabled,
    magnetSnapEnabled: typeof input.magnetSnapEnabled === "boolean" ? input.magnetSnapEnabled : DEFAULT_CANVAS_SNAP.magnetSnapEnabled,
    snapThresholdPx: typeof input.snapThresholdPx === "number" && Number.isFinite(input.snapThresholdPx) && input.snapThresholdPx > 0
      ? input.snapThresholdPx
      : DEFAULT_CANVAS_SNAP.snapThresholdPx,
  };
}

export const CURRENT_PROJECT_SCHEMA_VERSION = 1;
export const MAX_ASSET_SIZE_BYTES = 1024 * 1024;

type LegacyScreenModel = {
  id: string;
  name: string;
  width: number;
  height: number;
  rootWidget: ReturnType<typeof parseLegacyWidget> extends { ok: true; widget: infer W } ? W : never;
};

function parseSchemaVersion(input: unknown):
  | { ok: true; schemaVersion: number; warning?: string }
  | { ok: false; error: string } {
  if (input === undefined) {
    return {
      ok: true,
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      warning: `Project is missing schemaVersion. Treated as legacy and upgraded to v${CURRENT_PROJECT_SCHEMA_VERSION}.`,
    };
  }
  if (typeof input !== "number" || !Number.isInteger(input) || input <= 0) {
    return { ok: false, error: "Project.schemaVersion must be a positive integer" };
  }
  if (input > CURRENT_PROJECT_SCHEMA_VERSION) {
    return { ok: false, error: `Project schema v${input} is newer than supported v${CURRENT_PROJECT_SCHEMA_VERSION}` };
  }
  if (input < CURRENT_PROJECT_SCHEMA_VERSION) {
    return {
      ok: true,
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      warning: `Project schema v${input} upgraded to v${CURRENT_PROJECT_SCHEMA_VERSION}.`,
    };
  }
  return { ok: true, schemaVersion: input };
}

function parseMeta(input: unknown, path: string): { ok: true; meta: ScreenMeta } | { ok: false; error: string } {
  if (!isRecord(input)) return { ok: false, error: `${path} must be an object` };

  const { width, height, fill } = input;
  if (typeof width !== "number" || !Number.isFinite(width) || width < 24) {
    return { ok: false, error: `${path}.width must be a number >= 24` };
  }
  if (typeof height !== "number" || !Number.isFinite(height) || height < 24) {
    return { ok: false, error: `${path}.height must be a number >= 24` };
  }
  if (fill !== undefined && (typeof fill !== "string" || !isValidColorString(fill))) {
    return { ok: false, error: `${path}.fill must be a valid hex color when provided` };
  }
  return { ok: true, meta: { width, height, fill } };
}

function parseNormalizedProject(
  input: unknown,
): { ok: true; project: ProjectSnapshot; warning?: string } | { ok: false; error: string } {
  if (!isRecord(input)) return { ok: false, error: "Project must be an object" };

  const { screens, activeScreenId, widgetsById } = input;
  const schemaVersionResult = parseSchemaVersion(input.schemaVersion);
  if (!schemaVersionResult.ok) return schemaVersionResult;

  const styleTokensResult = parseStyleTokens(input.styleTokens);
  if (!styleTokensResult.ok) return styleTokensResult;

  const assetsResult = parseAssets(input.assets);
  if (!assetsResult.ok) return assetsResult;

  if (!Array.isArray(screens) || screens.length === 0) {
    return { ok: false, error: "Project.screens must be a non-empty array" };
  }
  if (typeof activeScreenId !== "string" || !activeScreenId.trim()) {
    return { ok: false, error: "Project.activeScreenId must be a non-empty string" };
  }
  if (!isRecord(widgetsById)) {
    return { ok: false, error: "Project.widgetsById must be an object" };
  }

  const parsedWidgets: Record<string, WidgetNode> = {};
  for (const [widgetId, rawWidget] of Object.entries(widgetsById)) {
    const parsedWidget = parseNormalizedWidget(rawWidget, `Project.widgetsById.${widgetId}`);
    if (!parsedWidget.ok) return parsedWidget;
    if (parsedWidget.widget.id !== widgetId) {
      return { ok: false, error: `Project.widgetsById.${widgetId}.id must match key` };
    }
    parsedWidgets[widgetId] = parsedWidget.widget;
  }

  const tokenIds = new Set(styleTokensResult.tokens.map((token) => token.id));
  for (const widget of Object.values(parsedWidgets)) {
    if (widget.fillTokenId && !tokenIds.has(widget.fillTokenId)) {
      return { ok: false, error: `Widget ${widget.id}.fillTokenId does not exist in styleTokens` };
    }
    if (widget.textColorTokenId && !tokenIds.has(widget.textColorTokenId)) {
      return { ok: false, error: `Widget ${widget.id}.textColorTokenId does not exist in styleTokens` };
    }
    if (widget.assetId && !assetsResult.assets[widget.assetId]) {
      return { ok: false, error: `Widget ${widget.id}.assetId does not exist in assets` };
    }
    if (widget.assetId && widget.type !== "Image") {
      return { ok: false, error: `Widget ${widget.id}.assetId can only be used by Image widgets` };
    }
  }

  const screenIds = new Set<string>();
  const parsedScreens: ScreenModel[] = [];
  for (let index = 0; index < screens.length; index += 1) {
    const screenRaw = screens[index];
    if (!isRecord(screenRaw)) return { ok: false, error: `Project.screens[${index}] must be an object` };

    const { id, name, rootNodeId, meta } = screenRaw;
    if (typeof id !== "string" || !id.trim()) return { ok: false, error: `Project.screens[${index}].id must be a non-empty string` };
    if (typeof name !== "string" || !name.trim()) return { ok: false, error: `Project.screens[${index}].name must be a non-empty string` };
    if (typeof rootNodeId !== "string" || !rootNodeId.trim()) return { ok: false, error: `Project.screens[${index}].rootNodeId must be a non-empty string` };

    const parsedMeta = parseMeta(meta, `Project.screens[${index}].meta`);
    if (!parsedMeta.ok) return parsedMeta;

    const rootWidget = parsedWidgets[rootNodeId];
    if (!rootWidget) return { ok: false, error: `Project.screens[${index}].rootNodeId does not exist in widgetsById` };
    if (rootWidget.type !== "Screen") return { ok: false, error: `Project.screens[${index}].rootNodeId must reference a Screen widget` };
    if (rootWidget.parentId !== null) return { ok: false, error: `Project.screens[${index}] root widget parentId must be null` };

    parsedScreens.push({ id, name, rootNodeId, meta: parsedMeta.meta });
    screenIds.add(id);
  }

  for (const widget of Object.values(parsedWidgets)) {
    const bindings = widget.eventBindings;
    if (!bindings) continue;
    for (const event of KNOWN_WIDGET_EVENTS) {
      const binding = bindings[event];
      if (!binding) continue;
      if (binding.action.type === "switch_screen" && !screenIds.has(binding.action.targetScreenId)) {
        return { ok: false, error: `Widget ${widget.id} binding ${event} references missing screen ${binding.action.targetScreenId}` };
      }
      if (binding.action.type === "toggle_visibility" && !parsedWidgets[binding.action.targetWidgetId]) {
        return { ok: false, error: `Widget ${widget.id} binding ${event} references missing widget ${binding.action.targetWidgetId}` };
      }
    }
  }

  for (const widget of Object.values(parsedWidgets)) {
    for (const childId of widget.childrenIds) {
      const child = parsedWidgets[childId];
      if (!child) return { ok: false, error: `Widget ${widget.id} references missing child ${childId}` };
      if (child.parentId !== widget.id) return { ok: false, error: `Widget ${childId} parentId must be ${widget.id}` };
    }
  }

  const hasActiveScreen = parsedScreens.some((screen) => screen.id === activeScreenId);
  if (!hasActiveScreen) return { ok: false, error: "Project.activeScreenId does not exist in screens" };

  const colorFormat = isColorFormat(input.colorFormat) ? input.colorFormat : undefined;
  const canvasSnap = parseCanvasSnap(input.canvasSnap);

  return {
    ok: true,
    project: {
      schemaVersion: schemaVersionResult.schemaVersion,
      screens: parsedScreens,
      activeScreenId,
      widgetsById: parsedWidgets,
      styleTokens: styleTokensResult.tokens,
      assets: assetsResult.assets,
      colorFormat,
      canvasSnap,
    },
    warning: schemaVersionResult.warning,
  };
}

function parseLegacyProject(
  input: unknown,
): { ok: true; project: ProjectSnapshot; warning: string } | { ok: false; error: string } {
  if (!isRecord(input)) return { ok: false, error: "Project must be an object" };

  const rawScreens = input.screens;
  const activeScreenId = input.activeScreenId;
  if (!Array.isArray(rawScreens) || rawScreens.length === 0) {
    return { ok: false, error: "Project.screens must be a non-empty array" };
  }
  if (typeof activeScreenId !== "string" || !activeScreenId.trim()) {
    return { ok: false, error: "Project.activeScreenId must be a non-empty string" };
  }

  const widgetsById: Record<string, WidgetNode> = {};
  const screens: ScreenModel[] = [];

  for (let index = 0; index < rawScreens.length; index += 1) {
    const screenRaw = rawScreens[index] as LegacyScreenModel;
    if (!isRecord(screenRaw)) return { ok: false, error: `Project.screens[${index}] must be an object` };

    const id = (screenRaw as unknown as Record<string, unknown>).id as string;
    const name = (screenRaw as unknown as Record<string, unknown>).name as string;
    const width = (screenRaw as unknown as Record<string, unknown>).width as number;
    const height = (screenRaw as unknown as Record<string, unknown>).height as number;

    if (typeof id !== "string" || !id.trim()) return { ok: false, error: `Project.screens[${index}].id must be a non-empty string` };
    if (typeof name !== "string" || !name.trim()) return { ok: false, error: `Project.screens[${index}].name must be a non-empty string` };
    if (typeof width !== "number" || !Number.isFinite(width) || width < 24) return { ok: false, error: `Project.screens[${index}].width must be a number >= 24` };
    if (typeof height !== "number" || !Number.isFinite(height) || height < 24) return { ok: false, error: `Project.screens[${index}].height must be a number >= 24` };

    const parsedRoot = parseLegacyWidget(
      (screenRaw as unknown as Record<string, unknown>).rootWidget,
      `Project.screens[${index}].rootWidget`,
    );
    if (!parsedRoot.ok) return parsedRoot;

    flattenLegacyTree(parsedRoot.widget, null, widgetsById);
    screens.push({
      id,
      name,
      rootNodeId: parsedRoot.widget.id,
      meta: { width, height, fill: parsedRoot.widget.fill },
    });
  }

  const hasActiveScreen = screens.some((screen) => screen.id === activeScreenId);
  if (!hasActiveScreen) return { ok: false, error: "Project.activeScreenId does not exist in screens" };

  return {
    ok: true,
    project: {
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      screens,
      activeScreenId,
      widgetsById,
      styleTokens: [],
      assets: {},
      canvasSnap: { ...DEFAULT_CANVAS_SNAP },
    },
    warning: `Legacy project format upgraded to schema v${CURRENT_PROJECT_SCHEMA_VERSION}.`,
  };
}

function parseProjectSnapshot(
  input: unknown,
): { ok: true; project: ProjectSnapshot; warning?: string } | { ok: false; error: string } {
  const normalized = parseNormalizedProject(input);
  if (normalized.ok) return normalized;
  return parseLegacyProject(input);
}

export function serializeProjectSnapshot(project: ProjectSnapshot): string {
  return JSON.stringify(project, null, 2);
}

export function deserializeProjectSnapshot(
  serializedProject: string,
): { ok: true; project: ProjectSnapshot; warning?: string } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(serializedProject) as unknown;
    return parseProjectSnapshot(parsed);
  } catch {
    return { ok: false, error: "Invalid JSON format" };
  }
}

export function createInitialProject(): ProjectSnapshot {
  const widgetsById: Record<string, WidgetNode> = {
    "screen-1-root": {
      id: "screen-1-root",
      name: "Screen1",
      type: "Screen",
      parentId: null,
      childrenIds: ["Container1"],
      x: 0,
      y: 0,
      width: 480,
      height: 320,
      fill: "#1f2937",
      radius: 0,
      visible: true,
    },
    Container1: {
      id: "Container1",
      name: "Container1",
      type: "Container",
      parentId: "screen-1-root",
      childrenIds: ["Label1", "Panel1"],
      x: 24,
      y: 24,
      width: 432,
      height: 272,
      fill: "#252525",
      radius: 16,
    },
    Label1: {
      id: "Label1",
      name: "Title Label",
      type: "Label",
      parentId: "Container1",
      childrenIds: [],
      x: 20,
      y: 18,
      width: 220,
      height: 32,
      text: "Smart Thermostat",
      textColor: "#f3f4f6",
    },
    Panel1: {
      id: "Panel1",
      name: "Panel1",
      type: "Panel",
      parentId: "Container1",
      childrenIds: ["TempLabel", "Button1"],
      x: 20,
      y: 72,
      width: 392,
      height: 152,
      fill: "#111827",
      radius: 14,
    },
    TempLabel: {
      id: "TempLabel",
      name: "Temperature",
      type: "Label",
      parentId: "Panel1",
      childrenIds: [],
      x: 36,
      y: 34,
      width: 140,
      height: 56,
      text: "72°",
      textColor: "#7eb3e5",
    },
    Button1: {
      id: "Button1",
      name: "Button1",
      type: "Button",
      parentId: "Panel1",
      childrenIds: [],
      x: 250,
      y: 88,
      width: 96,
      height: 36,
      text: "Auto",
      fill: "#3b82f6",
      textColor: "#ffffff",
      radius: 10,
    },
  };

  return {
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    activeScreenId: "screen-1",
    screens: [
      {
        id: "screen-1",
        name: "Screen1",
        rootNodeId: "screen-1-root",
        meta: { width: 480, height: 320, fill: "#1f2937" },
      },
    ],
    widgetsById,
    styleTokens: createDefaultUserStyleTokens(),
    assets: {},
    canvasSnap: { ...DEFAULT_CANVAS_SNAP },
  };
}
