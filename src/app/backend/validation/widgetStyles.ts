import {
  WIDGET_EDITABLE_PROPERTIES,
  type EditableWidgetProperty,
  type EditableWidgetPropertyValue,
  type ProjectSnapshot,
  type StyleToken,
  type WidgetNode,
  type WidgetType,
} from "../types";
import { isValidColorString, isValidHexColorString } from "./helpers";

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

export function getDefaultWidgetFill(widgetType: WidgetType): string {
  if (widgetType === "Screen") return "#1f2937";
  if (widgetType === "Container") return "#252525";
  if (widgetType === "Panel") return "#111827";
  if (widgetType === "Button") return "#3b82f6";
  if (widgetType === "Image") return "#374151";
  return "#1e1e1e";
}

export function getDefaultWidgetTextColor(widgetType: WidgetType): string {
  if (widgetType === "Label") return "#f3f4f6";
  if (widgetType === "Button") return "#ffffff";
  return "#ffffff";
}

export function getStyleTokenById(project: ProjectSnapshot, tokenId: string | undefined): StyleToken | null {
  if (!tokenId) return null;
  return project.styleTokens.find((token) => token.id === tokenId) ?? null;
}

export function getWidgetStyleTokenId(
  widget: Pick<WidgetNode, "fillTokenId" | "textColorTokenId">,
  propertyName: "fill" | "textColor",
) {
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
  if (token) return token.value;
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
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (propertyName === "text") {
    return typeof value === "string" ? value : null;
  }
  if (propertyName === "fill" || propertyName === "textColor") {
    if (typeof value !== "string") return null;
    const normalizedColor = value.trim();
    return isValidColorString(normalizedColor) ? normalizedColor : null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (propertyName === "width" || propertyName === "height") {
    return Math.max(24, Math.round(value));
  }
  return Math.round(value);
}

export function canEditWidgetProperty(widgetType: WidgetType, propertyName: EditableWidgetProperty): boolean {
  return WIDGET_EDITABLE_PROPERTIES[widgetType].has(propertyName);
}
