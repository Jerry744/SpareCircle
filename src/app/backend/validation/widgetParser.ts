import type { WidgetNode } from "../types";
import {
  isRecord,
  isWidgetType,
  isValidAssetId,
  isValidColorString,
} from "./helpers";
import { parseEventBindingsMap } from "./eventParser";

export type LegacyWidgetNode = Omit<WidgetNode, "parentId" | "childrenIds"> & { children: LegacyWidgetNode[] };

export function parseNormalizedWidget(
  input: unknown,
  path: string,
): { ok: true; widget: WidgetNode } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const { id, name, type, parentId, childrenIds, x, y, width, height } = input;
  if (typeof id !== "string" || !id.trim()) return { ok: false, error: `${path}.id must be a non-empty string` };
  if (typeof name !== "string" || !name.trim()) return { ok: false, error: `${path}.name must be a non-empty string` };
  if (!isWidgetType(type)) return { ok: false, error: `${path}.type is invalid` };
  if (parentId !== null && typeof parentId !== "string") return { ok: false, error: `${path}.parentId must be a string or null` };
  if (!Array.isArray(childrenIds) || childrenIds.some((childId) => typeof childId !== "string" || !childId.trim())) {
    return { ok: false, error: `${path}.childrenIds must be a string array` };
  }
  if (typeof x !== "number" || !Number.isFinite(x)) return { ok: false, error: `${path}.x must be a finite number` };
  if (typeof y !== "number" || !Number.isFinite(y)) return { ok: false, error: `${path}.y must be a finite number` };
  if (typeof width !== "number" || !Number.isFinite(width) || width < 24) return { ok: false, error: `${path}.width must be a number >= 24` };
  if (typeof height !== "number" || !Number.isFinite(height) || height < 24) return { ok: false, error: `${path}.height must be a number >= 24` };

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

  if (maybeText !== undefined && typeof maybeText !== "string") return { ok: false, error: `${path}.text must be a string when provided` };
  if (maybeFill !== undefined && (typeof maybeFill !== "string" || !isValidColorString(maybeFill))) return { ok: false, error: `${path}.fill must be a valid hex color when provided` };
  if (maybeFillTokenId !== undefined && typeof maybeFillTokenId !== "string") return { ok: false, error: `${path}.fillTokenId must be a string when provided` };
  if (maybeTextColor !== undefined && (typeof maybeTextColor !== "string" || !isValidColorString(maybeTextColor))) return { ok: false, error: `${path}.textColor must be a valid hex color when provided` };
  if (maybeTextColorTokenId !== undefined && typeof maybeTextColorTokenId !== "string") return { ok: false, error: `${path}.textColorTokenId must be a string when provided` };
  if (maybeRadius !== undefined && (typeof maybeRadius !== "number" || !Number.isFinite(maybeRadius))) return { ok: false, error: `${path}.radius must be a finite number when provided` };
  if (maybeAssetId !== undefined && !isValidAssetId(maybeAssetId)) return { ok: false, error: `${path}.assetId must match asset id format when provided` };
  if (maybeOptions !== undefined && (!Array.isArray(maybeOptions) || (maybeOptions as unknown[]).some((o) => typeof o !== "string"))) return { ok: false, error: `${path}.options must be a string array when provided` };
  if (maybeSelectedOptionIndex !== undefined && (typeof maybeSelectedOptionIndex !== "number" || !Number.isFinite(maybeSelectedOptionIndex) || maybeSelectedOptionIndex < 0)) return { ok: false, error: `${path}.selectedOptionIndex must be a non-negative number when provided` };
  if (maybeValue !== undefined && (typeof maybeValue !== "number" || !Number.isFinite(maybeValue) || maybeValue < 0 || maybeValue > 100)) return { ok: false, error: `${path}.value must be a number between 0 and 100 when provided` };
  if (maybeChecked !== undefined && typeof maybeChecked !== "boolean") return { ok: false, error: `${path}.checked must be a boolean when provided` };
  if (maybeVisible !== undefined && typeof maybeVisible !== "boolean") return { ok: false, error: `${path}.visible must be a boolean when provided` };
  if (maybeLocked !== undefined && typeof maybeLocked !== "boolean") return { ok: false, error: `${path}.locked must be a boolean when provided` };

  const parsedEventBindings = parseEventBindingsMap(maybeEventBindings, `${path}.eventBindings`);
  if (!parsedEventBindings.ok) return parsedEventBindings;

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

export function parseLegacyWidget(
  input: unknown,
  path: string,
): { ok: true; widget: LegacyWidgetNode } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const { id, name, type, x, y, width, height, children } = input;
  if (typeof id !== "string" || !id.trim()) return { ok: false, error: `${path}.id must be a non-empty string` };
  if (typeof name !== "string" || !name.trim()) return { ok: false, error: `${path}.name must be a non-empty string` };
  if (!isWidgetType(type)) return { ok: false, error: `${path}.type is invalid` };
  if (typeof x !== "number" || !Number.isFinite(x)) return { ok: false, error: `${path}.x must be a finite number` };
  if (typeof y !== "number" || !Number.isFinite(y)) return { ok: false, error: `${path}.y must be a finite number` };
  if (typeof width !== "number" || !Number.isFinite(width) || width < 24) return { ok: false, error: `${path}.width must be a number >= 24` };
  if (typeof height !== "number" || !Number.isFinite(height) || height < 24) return { ok: false, error: `${path}.height must be a number >= 24` };
  if (!Array.isArray(children)) return { ok: false, error: `${path}.children must be an array` };

  const parsedChildren: LegacyWidgetNode[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const childResult = parseLegacyWidget(children[index], `${path}.children[${index}]`);
    if (!childResult.ok) return childResult;
    parsedChildren.push(childResult.widget);
  }

  const nextWidget: LegacyWidgetNode = { id, name, type, x, y, width, height, children: parsedChildren };
  if (input.text !== undefined) nextWidget.text = input.text as string;
  if (input.fill !== undefined) nextWidget.fill = input.fill as string;
  if (input.textColor !== undefined) nextWidget.textColor = input.textColor as string;
  if (input.radius !== undefined) nextWidget.radius = input.radius as number;
  if (input.visible !== undefined) nextWidget.visible = input.visible as boolean;
  if (input.locked !== undefined) nextWidget.locked = input.locked as boolean;
  if (input.assetId !== undefined) nextWidget.assetId = input.assetId as string;

  return { ok: true, widget: nextWidget };
}

export function flattenLegacyTree(
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
