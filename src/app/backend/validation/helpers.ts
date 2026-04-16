import {
  KNOWN_WIDGET_ACTIONS,
  KNOWN_WIDGET_EVENTS,
  KNOWN_WIDGET_TYPES,
  type AssetMimeType,
  type ColorFormat,
  type WidgetEventAction,
  type WidgetEventType,
  type WidgetType,
} from "../types";

export const SUPPORTED_ASSET_MIME_TYPES: ReadonlySet<AssetMimeType> = new Set(["image/png", "image/jpeg", "image/gif"]);

export const MAX_ASSET_SIZE_BYTES = 1024 * 1024;

export const KNOWN_COLOR_FORMATS: ColorFormat[] = ["monochrome", "grayscale8", "rgb565", "rgb888", "argb8888"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isAssetMimeType(value: unknown): value is AssetMimeType {
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

export function estimateDataUrlSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    return Number.POSITIVE_INFINITY;
  }
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function isValidDataUrl(dataUrl: string, mimeType: AssetMimeType): boolean {
  if (!dataUrl.startsWith(`data:${mimeType};base64,`)) {
    return false;
  }
  return isWithinAssetSizeLimit(estimateDataUrlSize(dataUrl));
}

export function isColorFormat(value: unknown): value is ColorFormat {
  return typeof value === "string" && KNOWN_COLOR_FORMATS.includes(value as ColorFormat);
}

export function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === "string" && KNOWN_WIDGET_TYPES.includes(value as WidgetType);
}

export function isWidgetEventType(value: unknown): value is WidgetEventType {
  return typeof value === "string" && KNOWN_WIDGET_EVENTS.includes(value as WidgetEventType);
}

export function isWidgetActionType(value: unknown): value is WidgetEventAction["type"] {
  return typeof value === "string" && KNOWN_WIDGET_ACTIONS.includes(value as WidgetEventAction["type"]);
}

export function isValidHexColorString(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function isValidColorString(value: string): boolean {
  return isValidHexColorString(value);
}
