import {
  KNOWN_WIDGET_ACTIONS,
  KNOWN_WIDGET_EVENTS,
  KNOWN_WIDGET_TYPES,
  WIDGET_EDITABLE_PROPERTIES,
  type AssetItem,
  type AssetMimeType,
  type EventBinding,
  type StyleToken,
  type EditableWidgetProperty,
  type EditableWidgetPropertyValue,
  type ProjectSnapshot,
  type ScreenMeta,
  type ScreenModel,
  type WidgetNode,
  type WidgetEventAction,
  type WidgetEventBindings,
  type WidgetEventType,
  type WidgetType,
} from "./types";
import { MATERIAL_COLOR_PRESET } from "../constants/designTokens";

const SUPPORTED_ASSET_MIME_TYPES: ReadonlySet<AssetMimeType> = new Set(["image/png", "image/jpeg", "image/gif"]);
export const MAX_ASSET_SIZE_BYTES = 1024 * 1024;
export const CURRENT_PROJECT_SCHEMA_VERSION = 1;

type LegacyWidgetNode = Omit<WidgetNode, "parentId" | "childrenIds"> & { children: LegacyWidgetNode[] };

type LegacyScreenModel = {
  id: string;
  name: string;
  width: number;
  height: number;
  rootWidget: LegacyWidgetNode;
};

type LegacyProjectSnapshot = {
  screens: LegacyScreenModel[];
  activeScreenId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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
    return {
      ok: false,
      error: `Project schema v${input} is newer than supported v${CURRENT_PROJECT_SCHEMA_VERSION}`,
    };
  }

  if (input < CURRENT_PROJECT_SCHEMA_VERSION) {
    return {
      ok: true,
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      warning: `Project schema v${input} upgraded to v${CURRENT_PROJECT_SCHEMA_VERSION}.`,
    };
  }

  return {
    ok: true,
    schemaVersion: input,
  };
}

function isAssetMimeType(value: unknown): value is AssetMimeType {
  return typeof value === "string" && SUPPORTED_ASSET_MIME_TYPES.has(value as AssetMimeType);
}

export function isValidAssetId(value: unknown): value is string {
  return typeof value === "string" && /^asset-[a-z0-9-]{6,}$/i.test(value.trim());
}

export function isSupportedAssetMimeType(value: string): value is AssetMimeType {
  return SUPPORTED_ASSET_MIME_TYPES.has(value as AssetMimeType);
}

export function isWithinAssetSizeLimit(sizeBytes: number): boolean {
  return Number.isFinite(sizeBytes) && sizeBytes > 0 && sizeBytes <= MAX_ASSET_SIZE_BYTES;
}

function estimateDataUrlSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    return Number.POSITIVE_INFINITY;
  }

  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function isValidDataUrl(dataUrl: string, mimeType: AssetMimeType): boolean {
  if (!dataUrl.startsWith(`data:${mimeType};base64,`)) {
    return false;
  }

  return isWithinAssetSizeLimit(estimateDataUrlSize(dataUrl));
}

function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === "string" && KNOWN_WIDGET_TYPES.includes(value as WidgetType);
}

function isWidgetEventType(value: unknown): value is WidgetEventType {
  return typeof value === "string" && KNOWN_WIDGET_EVENTS.includes(value as WidgetEventType);
}

function isWidgetActionType(value: unknown): value is WidgetEventAction["type"] {
  return typeof value === "string" && KNOWN_WIDGET_ACTIONS.includes(value as WidgetEventAction["type"]);
}

function parseEventBinding(input: unknown, path: string): { ok: true; binding: EventBinding } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const event = input.event;
  if (!isWidgetEventType(event)) {
    return { ok: false, error: `${path}.event is invalid` };
  }

  const action = input.action;
  if (!isRecord(action) || !isWidgetActionType(action.type)) {
    return { ok: false, error: `${path}.action.type is invalid` };
  }

  if (action.type === "switch_screen") {
    if (typeof action.targetScreenId !== "string" || !action.targetScreenId.trim()) {
      return { ok: false, error: `${path}.action.targetScreenId must be a non-empty string` };
    }

    return {
      ok: true,
      binding: {
        event,
        action: {
          type: "switch_screen",
          targetScreenId: action.targetScreenId,
        },
      },
    };
  }

  if (typeof action.targetWidgetId !== "string" || !action.targetWidgetId.trim()) {
    return { ok: false, error: `${path}.action.targetWidgetId must be a non-empty string` };
  }

  return {
    ok: true,
    binding: {
      event,
      action: {
        type: "toggle_visibility",
        targetWidgetId: action.targetWidgetId,
      },
    },
  };
}

function parseEventBindingsMap(input: unknown, path: string):
  { ok: true; eventBindings: WidgetEventBindings | undefined }
  | { ok: false; error: string } {
  if (input === undefined) {
    return { ok: true, eventBindings: undefined };
  }

  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object when provided` };
  }

  const eventBindings: WidgetEventBindings = {};
  for (const event of KNOWN_WIDGET_EVENTS) {
    const bindingRaw = input[event];
    if (bindingRaw === undefined) {
      continue;
    }

    const parsed = parseEventBinding(bindingRaw, `${path}.${event}`);
    if (!parsed.ok) {
      return parsed;
    }

    if (parsed.binding.event !== event) {
      return { ok: false, error: `${path}.${event}.event must match its map key` };
    }

    eventBindings[event] = parsed.binding;
  }

  return {
    ok: true,
    eventBindings: Object.keys(eventBindings).length > 0 ? eventBindings : undefined,
  };
}

export function isEditableWidgetProperty(value: unknown): value is EditableWidgetProperty {
  return value === "x"
    || value === "y"
    || value === "width"
    || value === "height"
    || value === "text"
    || value === "fill"
    || value === "textColor"
    || value === "visible"
    || value === "value"
    || value === "checked";
}

export function isValidHexColorString(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function isValidColorString(value: string): boolean {
  return isValidHexColorString(value);
}

export function getDefaultWidgetFill(widgetType: WidgetType): string {
  if (widgetType === "Screen") {
    return "#1f2937";
  }
  if (widgetType === "Container") {
    return "#252525";
  }
  if (widgetType === "Panel") {
    return "#111827";
  }
  if (widgetType === "Button") {
    return "#3b82f6";
  }
  if (widgetType === "Image") {
    return "#374151";
  }

  return "#1e1e1e";
}

export function getDefaultWidgetTextColor(widgetType: WidgetType): string {
  if (widgetType === "Label") {
    return "#f3f4f6";
  }

  if (widgetType === "Button") {
    return "#ffffff";
  }

  return "#ffffff";
}

export function getStyleTokenById(project: ProjectSnapshot, tokenId: string | undefined): StyleToken | null {
  if (!tokenId) {
    return null;
  }

  return project.styleTokens.find((token) => token.id === tokenId) ?? null;
}

export function getWidgetStyleTokenId(widget: Pick<WidgetNode, "fillTokenId" | "textColorTokenId">, propertyName: "fill" | "textColor") {
  return propertyName === "fill" ? widget.fillTokenId : widget.textColorTokenId;
}

export function resolveWidgetColor(
  project: ProjectSnapshot,
  widget: Pick<WidgetNode, "type" | "fill" | "fillTokenId" | "textColor" | "textColorTokenId">,
  propertyName: "fill" | "textColor",
): string {
  const localValue = propertyName === "fill" ? widget.fill : widget.textColor;
  if (localValue && isValidHexColorString(localValue)) {
    return localValue;
  }

  const token = getStyleTokenById(project, propertyName === "fill" ? widget.fillTokenId : widget.textColorTokenId);
  if (token) {
    return token.value;
  }

  return propertyName === "fill"
    ? getDefaultWidgetFill(widget.type)
    : getDefaultWidgetTextColor(widget.type);
}

export function normalizeEditableWidgetPropertyValue(
  propertyName: EditableWidgetProperty,
  value: EditableWidgetPropertyValue,
): EditableWidgetPropertyValue | null {
  if (propertyName === "visible" || propertyName === "checked") {
    return typeof value === "boolean" ? value : null;
  }

  if (propertyName === "value") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  if (propertyName === "text") {
    return typeof value === "string" ? value : null;
  }

  if (propertyName === "fill" || propertyName === "textColor") {
    if (typeof value !== "string") {
      return null;
    }

    const normalizedColor = value.trim();
    return isValidColorString(normalizedColor) ? normalizedColor : null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (propertyName === "width" || propertyName === "height") {
    return Math.max(24, Math.round(value));
  }

  return Math.round(value);
}

export function canEditWidgetProperty(widgetType: WidgetType, propertyName: EditableWidgetProperty): boolean {
  return WIDGET_EDITABLE_PROPERTIES[widgetType].has(propertyName);
}

function parseMeta(input: unknown, path: string): { ok: true; meta: ScreenMeta } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

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

  return {
    ok: true,
    meta: {
      width,
      height,
      fill,
    },
  };
}

function parseNormalizedWidget(input: unknown, path: string): { ok: true; widget: WidgetNode } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const { id, name, type, parentId, childrenIds, x, y, width, height } = input;
  if (typeof id !== "string" || !id.trim()) {
    return { ok: false, error: `${path}.id must be a non-empty string` };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: `${path}.name must be a non-empty string` };
  }
  if (!isWidgetType(type)) {
    return { ok: false, error: `${path}.type is invalid` };
  }
  if (parentId !== null && typeof parentId !== "string") {
    return { ok: false, error: `${path}.parentId must be a string or null` };
  }
  if (!Array.isArray(childrenIds) || childrenIds.some((childId) => typeof childId !== "string" || !childId.trim())) {
    return { ok: false, error: `${path}.childrenIds must be a string array` };
  }
  if (typeof x !== "number" || !Number.isFinite(x)) {
    return { ok: false, error: `${path}.x must be a finite number` };
  }
  if (typeof y !== "number" || !Number.isFinite(y)) {
    return { ok: false, error: `${path}.y must be a finite number` };
  }
  if (typeof width !== "number" || !Number.isFinite(width) || width < 24) {
    return { ok: false, error: `${path}.width must be a number >= 24` };
  }
  if (typeof height !== "number" || !Number.isFinite(height) || height < 24) {
    return { ok: false, error: `${path}.height must be a number >= 24` };
  }

  const maybeText = input.text;
  const maybeFill = input.fill;
  const maybeFillTokenId = input.fillTokenId;
  const maybeTextColor = input.textColor;
  const maybeTextColorTokenId = input.textColorTokenId;
  const maybeRadius = input.radius;
  const maybeAssetId = input.assetId;
  const maybeOptions = input.options;
  const maybeSelectedOptionIndex = input.selectedOptionIndex;
  const maybeValue = input.value;
  const maybeChecked = input.checked;
  const maybeVisible = input.visible;
  const maybeLocked = input.locked;
  const maybeEventBindings = input.eventBindings;

  if (maybeText !== undefined && typeof maybeText !== "string") {
    return { ok: false, error: `${path}.text must be a string when provided` };
  }
  if (maybeFill !== undefined && (typeof maybeFill !== "string" || !isValidColorString(maybeFill))) {
    return { ok: false, error: `${path}.fill must be a valid hex color when provided` };
  }
  if (maybeFillTokenId !== undefined && typeof maybeFillTokenId !== "string") {
    return { ok: false, error: `${path}.fillTokenId must be a string when provided` };
  }
  if (maybeTextColor !== undefined && (typeof maybeTextColor !== "string" || !isValidColorString(maybeTextColor))) {
    return { ok: false, error: `${path}.textColor must be a valid hex color when provided` };
  }
  if (maybeTextColorTokenId !== undefined && typeof maybeTextColorTokenId !== "string") {
    return { ok: false, error: `${path}.textColorTokenId must be a string when provided` };
  }
  if (maybeRadius !== undefined && (typeof maybeRadius !== "number" || !Number.isFinite(maybeRadius))) {
    return { ok: false, error: `${path}.radius must be a finite number when provided` };
  }
  if (maybeAssetId !== undefined && !isValidAssetId(maybeAssetId)) {
    return { ok: false, error: `${path}.assetId must match asset id format when provided` };
  }
  if (maybeOptions !== undefined && (!Array.isArray(maybeOptions) || (maybeOptions as unknown[]).some((o) => typeof o !== "string"))) {
    return { ok: false, error: `${path}.options must be a string array when provided` };
  }
  if (maybeSelectedOptionIndex !== undefined && (typeof maybeSelectedOptionIndex !== "number" || !Number.isFinite(maybeSelectedOptionIndex) || maybeSelectedOptionIndex < 0)) {
    return { ok: false, error: `${path}.selectedOptionIndex must be a non-negative number when provided` };
  }
  if (maybeValue !== undefined && (typeof maybeValue !== "number" || !Number.isFinite(maybeValue) || maybeValue < 0 || maybeValue > 100)) {
    return { ok: false, error: `${path}.value must be a number between 0 and 100 when provided` };
  }
  if (maybeChecked !== undefined && typeof maybeChecked !== "boolean") {
    return { ok: false, error: `${path}.checked must be a boolean when provided` };
  }
  if (maybeVisible !== undefined && typeof maybeVisible !== "boolean") {
    return { ok: false, error: `${path}.visible must be a boolean when provided` };
  }
  if (maybeLocked !== undefined && typeof maybeLocked !== "boolean") {
    return { ok: false, error: `${path}.locked must be a boolean when provided` };
  }

  const parsedEventBindings = parseEventBindingsMap(maybeEventBindings, `${path}.eventBindings`);
  if (!parsedEventBindings.ok) {
    return parsedEventBindings;
  }

  return {
    ok: true,
    widget: {
      id,
      name,
      type,
      parentId,
      childrenIds,
      x,
      y,
      width,
      height,
      text: maybeText,
      fill: maybeFill,
      fillTokenId: maybeFillTokenId,
      textColor: maybeTextColor,
      textColorTokenId: maybeTextColorTokenId,
      radius: maybeRadius,
      assetId: maybeAssetId,
      options: maybeOptions as string[] | undefined,
      selectedOptionIndex: maybeSelectedOptionIndex as number | undefined,
      value: maybeValue as number | undefined,
      checked: maybeChecked as boolean | undefined,
      visible: maybeVisible,
      locked: maybeLocked,
      eventBindings: parsedEventBindings.eventBindings,
    },
  };
}

function parseAsset(input: unknown, path: string): { ok: true; asset: AssetItem } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const { id, name, mimeType, dataUrl } = input;
  if (!isValidAssetId(id)) {
    return { ok: false, error: `${path}.id must be a valid asset id` };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: `${path}.name must be a non-empty string` };
  }
  if (!isAssetMimeType(mimeType)) {
    return { ok: false, error: `${path}.mimeType is not supported` };
  }
  if (typeof dataUrl !== "string" || !isValidDataUrl(dataUrl, mimeType)) {
    return { ok: false, error: `${path}.dataUrl is invalid or exceeds size limit` };
  }

  return {
    ok: true,
    asset: {
      id,
      name: name.trim(),
      mimeType,
      dataUrl,
    },
  };
}

function parseAssets(input: unknown): { ok: true; assets: Record<string, AssetItem> } | { ok: false; error: string } {
  if (input === undefined) {
    return { ok: true, assets: {} };
  }

  if (!isRecord(input)) {
    return { ok: false, error: "Project.assets must be an object" };
  }

  const assets: Record<string, AssetItem> = {};
  for (const [assetId, rawAsset] of Object.entries(input)) {
    const parsed = parseAsset(rawAsset, `Project.assets.${assetId}`);
    if (!parsed.ok) {
      return parsed;
    }

    if (parsed.asset.id !== assetId) {
      return { ok: false, error: `Project.assets.${assetId}.id must match key` };
    }

    assets[assetId] = parsed.asset;
  }

  return { ok: true, assets };
}

function parseStyleToken(input: unknown, path: string): { ok: true; token: StyleToken } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const { id, name, type, value } = input;
  if (typeof id !== "string" || !id.trim()) {
    return { ok: false, error: `${path}.id must be a non-empty string` };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: `${path}.name must be a non-empty string` };
  }
  if (type !== "color") {
    return { ok: false, error: `${path}.type is invalid` };
  }
  if (typeof value !== "string" || !isValidHexColorString(value)) {
    return { ok: false, error: `${path}.value must be a valid hex color` };
  }

  return {
    ok: true,
    token: {
      id,
      name,
      type,
      value: value.trim(),
    },
  };
}

function parseStyleTokens(input: unknown): { ok: true; tokens: StyleToken[] } | { ok: false; error: string } {
  if (input === undefined) {
    return { ok: true, tokens: [] };
  }

  if (!Array.isArray(input)) {
    return { ok: false, error: "Project.styleTokens must be an array" };
  }

  const tokens: StyleToken[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (let index = 0; index < input.length; index += 1) {
    const parsed = parseStyleToken(input[index], `Project.styleTokens[${index}]`);
    if (!parsed.ok) {
      return parsed;
    }

    if (seenIds.has(parsed.token.id)) {
      return { ok: false, error: `Project.styleTokens[${index}].id must be unique` };
    }
    if (seenNames.has(parsed.token.name)) {
      return { ok: false, error: `Project.styleTokens[${index}].name must be unique` };
    }

    seenIds.add(parsed.token.id);
    seenNames.add(parsed.token.name);
    tokens.push(parsed.token);
  }

  return { ok: true, tokens };
}

function parseNormalizedProject(input: unknown): { ok: true; project: ProjectSnapshot; warning?: string } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: "Project must be an object" };
  }

  const { screens, activeScreenId, widgetsById } = input;
  const schemaVersionResult = parseSchemaVersion(input.schemaVersion);
  if (!schemaVersionResult.ok) {
    return schemaVersionResult;
  }
  const styleTokensResult = parseStyleTokens(input.styleTokens);
  if (!styleTokensResult.ok) {
    return styleTokensResult;
  }
  const assetsResult = parseAssets(input.assets);
  if (!assetsResult.ok) {
    return assetsResult;
  }
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
    if (!parsedWidget.ok) {
      return parsedWidget;
    }

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
    if (!isRecord(screenRaw)) {
      return { ok: false, error: `Project.screens[${index}] must be an object` };
    }

    const { id, name, rootNodeId, meta } = screenRaw;
    if (typeof id !== "string" || !id.trim()) {
      return { ok: false, error: `Project.screens[${index}].id must be a non-empty string` };
    }
    if (typeof name !== "string" || !name.trim()) {
      return { ok: false, error: `Project.screens[${index}].name must be a non-empty string` };
    }
    if (typeof rootNodeId !== "string" || !rootNodeId.trim()) {
      return { ok: false, error: `Project.screens[${index}].rootNodeId must be a non-empty string` };
    }

    const parsedMeta = parseMeta(meta, `Project.screens[${index}].meta`);
    if (!parsedMeta.ok) {
      return parsedMeta;
    }

    const rootWidget = parsedWidgets[rootNodeId];
    if (!rootWidget) {
      return { ok: false, error: `Project.screens[${index}].rootNodeId does not exist in widgetsById` };
    }
    if (rootWidget.type !== "Screen") {
      return { ok: false, error: `Project.screens[${index}].rootNodeId must reference a Screen widget` };
    }
    if (rootWidget.parentId !== null) {
      return { ok: false, error: `Project.screens[${index}] root widget parentId must be null` };
    }

    parsedScreens.push({
      id,
      name,
      rootNodeId,
      meta: parsedMeta.meta,
    });
    screenIds.add(id);
  }

  for (const widget of Object.values(parsedWidgets)) {
    const bindings = widget.eventBindings;
    if (!bindings) {
      continue;
    }

    for (const event of KNOWN_WIDGET_EVENTS) {
      const binding = bindings[event];
      if (!binding) {
        continue;
      }

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
      if (!child) {
        return { ok: false, error: `Widget ${widget.id} references missing child ${childId}` };
      }
      if (child.parentId !== widget.id) {
        return { ok: false, error: `Widget ${childId} parentId must be ${widget.id}` };
      }
    }
  }

  const hasActiveScreen = parsedScreens.some((screen) => screen.id === activeScreenId);
  if (!hasActiveScreen) {
    return { ok: false, error: "Project.activeScreenId does not exist in screens" };
  }

  return {
    ok: true,
    project: {
      schemaVersion: schemaVersionResult.schemaVersion,
      screens: parsedScreens,
      activeScreenId,
      widgetsById: parsedWidgets,
      styleTokens: styleTokensResult.tokens,
      assets: assetsResult.assets,
    },
    warning: schemaVersionResult.warning,
  };
}

function parseLegacyWidget(input: unknown, path: string): { ok: true; widget: LegacyWidgetNode } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const { id, name, type, x, y, width, height, children } = input;
  if (typeof id !== "string" || !id.trim()) {
    return { ok: false, error: `${path}.id must be a non-empty string` };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: `${path}.name must be a non-empty string` };
  }
  if (!isWidgetType(type)) {
    return { ok: false, error: `${path}.type is invalid` };
  }
  if (typeof x !== "number" || !Number.isFinite(x)) {
    return { ok: false, error: `${path}.x must be a finite number` };
  }
  if (typeof y !== "number" || !Number.isFinite(y)) {
    return { ok: false, error: `${path}.y must be a finite number` };
  }
  if (typeof width !== "number" || !Number.isFinite(width) || width < 24) {
    return { ok: false, error: `${path}.width must be a number >= 24` };
  }
  if (typeof height !== "number" || !Number.isFinite(height) || height < 24) {
    return { ok: false, error: `${path}.height must be a number >= 24` };
  }
  if (!Array.isArray(children)) {
    return { ok: false, error: `${path}.children must be an array` };
  }

  const parsedChildren: LegacyWidgetNode[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const childResult = parseLegacyWidget(children[index], `${path}.children[${index}]`);
    if (!childResult.ok) {
      return childResult;
    }
    parsedChildren.push(childResult.widget);
  }

  const nextWidget: LegacyWidgetNode = {
    id,
    name,
    type,
    x,
    y,
    width,
    height,
    children: parsedChildren,
  };

  if (input.text !== undefined) {
    nextWidget.text = input.text as string;
  }
  if (input.fill !== undefined) {
    nextWidget.fill = input.fill as string;
  }
  if (input.textColor !== undefined) {
    nextWidget.textColor = input.textColor as string;
  }
  if (input.radius !== undefined) {
    nextWidget.radius = input.radius as number;
  }
  if (input.visible !== undefined) {
    nextWidget.visible = input.visible as boolean;
  }
  if (input.locked !== undefined) {
    nextWidget.locked = input.locked as boolean;
  }
  if (input.assetId !== undefined) {
    nextWidget.assetId = input.assetId as string;
  }

  return { ok: true, widget: nextWidget };
}

function flattenLegacyTree(
  widget: LegacyWidgetNode,
  parentId: string | null,
  accumulator: Record<string, WidgetNode>,
): void {
  accumulator[widget.id] = {
    id: widget.id,
    name: widget.name,
    type: widget.type,
    parentId,
    childrenIds: widget.children.map((child) => child.id),
    x: widget.x,
    y: widget.y,
    width: widget.width,
    height: widget.height,
    text: widget.text,
    fill: widget.fill,
    textColor: widget.textColor,
    radius: widget.radius,
    visible: widget.visible,
    locked: widget.locked,
  };

  for (const child of widget.children) {
    flattenLegacyTree(child, widget.id, accumulator);
  }
}

function parseLegacyProject(input: unknown): { ok: true; project: ProjectSnapshot; warning: string } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: "Project must be an object" };
  }

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
    const screenRaw = rawScreens[index];
    if (!isRecord(screenRaw)) {
      return { ok: false, error: `Project.screens[${index}] must be an object` };
    }

    const id = screenRaw.id;
    const name = screenRaw.name;
    const width = screenRaw.width;
    const height = screenRaw.height;
    if (typeof id !== "string" || !id.trim()) {
      return { ok: false, error: `Project.screens[${index}].id must be a non-empty string` };
    }
    if (typeof name !== "string" || !name.trim()) {
      return { ok: false, error: `Project.screens[${index}].name must be a non-empty string` };
    }
    if (typeof width !== "number" || !Number.isFinite(width) || width < 24) {
      return { ok: false, error: `Project.screens[${index}].width must be a number >= 24` };
    }
    if (typeof height !== "number" || !Number.isFinite(height) || height < 24) {
      return { ok: false, error: `Project.screens[${index}].height must be a number >= 24` };
    }

    const parsedRoot = parseLegacyWidget(screenRaw.rootWidget, `Project.screens[${index}].rootWidget`);
    if (!parsedRoot.ok) {
      return parsedRoot;
    }

    flattenLegacyTree(parsedRoot.widget, null, widgetsById);

    screens.push({
      id,
      name,
      rootNodeId: parsedRoot.widget.id,
      meta: {
        width,
        height,
        fill: parsedRoot.widget.fill,
      },
    });
  }

  const hasActiveScreen = screens.some((screen) => screen.id === activeScreenId);
  if (!hasActiveScreen) {
    return { ok: false, error: "Project.activeScreenId does not exist in screens" };
  }

  return {
    ok: true,
    project: {
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      screens,
      activeScreenId,
      widgetsById,
      styleTokens: [],
      assets: {},
    },
    warning: `Legacy project format upgraded to schema v${CURRENT_PROJECT_SCHEMA_VERSION}.`,
  };
}

function parseProjectSnapshot(input: unknown): { ok: true; project: ProjectSnapshot; warning?: string } | { ok: false; error: string } {
  const normalized = parseNormalizedProject(input);
  if (normalized.ok) {
    return normalized;
  }

  return parseLegacyProject(input);
}

export function serializeProjectSnapshot(project: ProjectSnapshot): string {
  return JSON.stringify(project, null, 2);
}

export function deserializeProjectSnapshot(serializedProject: string):
  | { ok: true; project: ProjectSnapshot; warning?: string }
  | { ok: false; error: string } {
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
        meta: {
          width: 480,
          height: 320,
          fill: "#1f2937",
        },
      },
    ],
    widgetsById,
    styleTokens: MATERIAL_COLOR_PRESET.map((token, index) => ({
      id: `material-${index + 1}`,
      name: token.name,
      type: "color",
      value: token.value,
    })),
    assets: {},
  };
}
