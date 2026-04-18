import type {
  EditableWidgetProperty,
  EditableWidgetPropertyValue,
  WidgetNode,
} from "../../backend/editorStore";
import type { ProjectSnapshot } from "../../backend/types";
import { resolveWidgetColor } from "../../backend/validation";
import type { DraftMap, InspectorField } from "./config";

export function getWidgetPropertyDraftValue(
  project: ProjectSnapshot,
  widget: WidgetNode,
  key: EditableWidgetProperty,
): string | boolean {
  switch (key) {
    case "x":
      return String(widget.x);
    case "y":
      return String(widget.y);
    case "width":
      return String(widget.width);
    case "height":
      return String(widget.height);
    case "text":
      return widget.text ?? "";
    case "fill":
      return resolveWidgetColor(project, widget, "fill");
    case "textColor":
      return resolveWidgetColor(project, widget, "textColor");
    case "visible":
      return widget.visible ?? true;
    case "value":
      return String(widget.value ?? 0);
    case "checked":
      return widget.checked ?? false;
    default:
      return "";
  }
}

export function buildDrafts(project: ProjectSnapshot, widget: WidgetNode, fields: InspectorField[]): DraftMap {
  return fields.reduce<DraftMap>((acc, field) => {
    acc[field.key] = getWidgetPropertyDraftValue(project, widget, field.key);
    return acc;
  }, {});
}

export function validateField(
  widget: WidgetNode,
  field: InspectorField,
  draft: string | boolean,
):
  | { ok: true; normalized: EditableWidgetPropertyValue; display: string | boolean }
  | { ok: false; error: string } {
  if (field.type === "boolean") {
    if (typeof draft !== "boolean") {
      return { ok: false, error: `${field.label} must be true or false` };
    }
    return { ok: true, normalized: draft, display: draft };
  }

  if (field.type === "number") {
    if (typeof draft !== "string" || !draft.trim()) {
      return { ok: false, error: `${field.label} is required` };
    }
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      return { ok: false, error: `${field.label} must be a valid number` };
    }
    const rounded = Math.round(parsed);
    if (field.min !== undefined && rounded < field.min) {
      return { ok: false, error: `${field.label} must be >= ${field.min}` };
    }
    if (field.max !== undefined && rounded > field.max) {
      return { ok: false, error: `${field.label} must be <= ${field.max}` };
    }
    return { ok: true, normalized: rounded, display: String(rounded) };
  }

  if (field.type === "color") {
    if (typeof draft !== "string") {
      return { ok: false, error: `${field.label} must be a string` };
    }
    const normalizedColor = draft.trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizedColor)) {
      return { ok: false, error: `${field.label} must be a hex color like #1f2937` };
    }
    return { ok: true, normalized: normalizedColor, display: normalizedColor };
  }

  if (typeof draft !== "string") {
    return { ok: false, error: `${field.label} must be text` };
  }

  const requiredText = field.key === "text" && (widget.type === "Label" || widget.type === "Button");
  if (requiredText && !draft.trim()) {
    return { ok: false, error: `${field.label} cannot be empty` };
  }

  return { ok: true, normalized: draft, display: draft };
}
