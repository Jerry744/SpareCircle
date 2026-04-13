import {
  KNOWN_WIDGET_TYPES,
  WIDGET_EDITABLE_PROPERTIES,
  type EditableWidgetProperty,
  type EditableWidgetPropertyValue,
  type ProjectSnapshot,
  type ScreenMeta,
  type ScreenModel,
  type WidgetNode,
  type WidgetType,
} from "./types";

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

function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === "string" && KNOWN_WIDGET_TYPES.includes(value as WidgetType);
}

export function isEditableWidgetProperty(value: unknown): value is EditableWidgetProperty {
  return value === "x"
    || value === "y"
    || value === "width"
    || value === "height"
    || value === "text"
    || value === "fill"
    || value === "textColor"
    || value === "visible";
}

function isValidColorString(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function normalizeEditableWidgetPropertyValue(
  propertyName: EditableWidgetProperty,
  value: EditableWidgetPropertyValue,
): EditableWidgetPropertyValue | null {
  if (propertyName === "visible") {
    return typeof value === "boolean" ? value : null;
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
  const maybeTextColor = input.textColor;
  const maybeRadius = input.radius;
  const maybeVisible = input.visible;
  const maybeLocked = input.locked;

  if (maybeText !== undefined && typeof maybeText !== "string") {
    return { ok: false, error: `${path}.text must be a string when provided` };
  }
  if (maybeFill !== undefined && (typeof maybeFill !== "string" || !isValidColorString(maybeFill))) {
    return { ok: false, error: `${path}.fill must be a valid hex color when provided` };
  }
  if (maybeTextColor !== undefined && (typeof maybeTextColor !== "string" || !isValidColorString(maybeTextColor))) {
    return { ok: false, error: `${path}.textColor must be a valid hex color when provided` };
  }
  if (maybeRadius !== undefined && (typeof maybeRadius !== "number" || !Number.isFinite(maybeRadius))) {
    return { ok: false, error: `${path}.radius must be a finite number when provided` };
  }
  if (maybeVisible !== undefined && typeof maybeVisible !== "boolean") {
    return { ok: false, error: `${path}.visible must be a boolean when provided` };
  }
  if (maybeLocked !== undefined && typeof maybeLocked !== "boolean") {
    return { ok: false, error: `${path}.locked must be a boolean when provided` };
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
      textColor: maybeTextColor,
      radius: maybeRadius,
      visible: maybeVisible,
      locked: maybeLocked,
    },
  };
}

function parseNormalizedProject(input: unknown): { ok: true; project: ProjectSnapshot } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: "Project must be an object" };
  }

  const { screens, activeScreenId, widgetsById } = input;
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
      screens: parsedScreens,
      activeScreenId,
      widgetsById: parsedWidgets,
    },
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

function parseLegacyProject(input: unknown): { ok: true; project: ProjectSnapshot } | { ok: false; error: string } {
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
      screens,
      activeScreenId,
      widgetsById,
    },
  };
}

function parseProjectSnapshot(input: unknown): { ok: true; project: ProjectSnapshot } | { ok: false; error: string } {
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
  | { ok: true; project: ProjectSnapshot }
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
  };
}
