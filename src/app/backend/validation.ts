import {
  KNOWN_WIDGET_TYPES,
  WIDGET_EDITABLE_PROPERTIES,
  type EditableWidgetProperty,
  type EditableWidgetPropertyValue,
  type ProjectSnapshot,
  type ScreenModel,
  type WidgetNode,
  type WidgetType,
} from "./types";

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

function parseWidgetNode(input: unknown, path: string): { ok: true; widget: WidgetNode } | { ok: false; error: string } {
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

  const parsedChildren: WidgetNode[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const childResult = parseWidgetNode(children[index], `${path}.children[${index}]`);
    if (!childResult.ok) {
      return childResult;
    }
    parsedChildren.push(childResult.widget);
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

  const nextWidget: WidgetNode = {
    id,
    name,
    type,
    x,
    y,
    width,
    height,
    children: parsedChildren,
  };

  if (maybeText !== undefined) {
    nextWidget.text = maybeText;
  }
  if (maybeFill !== undefined) {
    nextWidget.fill = maybeFill;
  }
  if (maybeTextColor !== undefined) {
    nextWidget.textColor = maybeTextColor;
  }
  if (maybeRadius !== undefined) {
    nextWidget.radius = maybeRadius;
  }
  if (maybeVisible !== undefined) {
    nextWidget.visible = maybeVisible;
  }
  if (maybeLocked !== undefined) {
    nextWidget.locked = maybeLocked;
  }

  return { ok: true, widget: nextWidget };
}

function parseProjectSnapshot(input: unknown): { ok: true; project: ProjectSnapshot } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: "Project must be an object" };
  }

  const { screens, activeScreenId } = input;
  if (!Array.isArray(screens) || screens.length === 0) {
    return { ok: false, error: "Project.screens must be a non-empty array" };
  }
  if (typeof activeScreenId !== "string" || !activeScreenId.trim()) {
    return { ok: false, error: "Project.activeScreenId must be a non-empty string" };
  }

  const parsedScreens: ScreenModel[] = [];
  for (let index = 0; index < screens.length; index += 1) {
    const screenRaw = screens[index];
    if (!isRecord(screenRaw)) {
      return { ok: false, error: `Project.screens[${index}] must be an object` };
    }

    const { id, name, width, height, rootWidget } = screenRaw;
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

    const parsedRoot = parseWidgetNode(rootWidget, `Project.screens[${index}].rootWidget`);
    if (!parsedRoot.ok) {
      return parsedRoot;
    }
    if (parsedRoot.widget.type !== "Screen") {
      return { ok: false, error: `Project.screens[${index}].rootWidget.type must be Screen` };
    }

    parsedScreens.push({
      id,
      name,
      width,
      height,
      rootWidget: parsedRoot.widget,
    });
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
    },
  };
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
  return {
    activeScreenId: "screen-1",
    screens: [
      {
        id: "screen-1",
        name: "Screen1",
        width: 480,
        height: 320,
        rootWidget: {
          id: "screen-1-root",
          name: "Screen1",
          type: "Screen",
          x: 0,
          y: 0,
          width: 480,
          height: 320,
          fill: "#1f2937",
          radius: 0,
          children: [
            {
              id: "Container1",
              name: "Container1",
              type: "Container",
              x: 24,
              y: 24,
              width: 432,
              height: 272,
              fill: "#252525",
              radius: 16,
              children: [
                {
                  id: "Label1",
                  name: "Title Label",
                  type: "Label",
                  x: 20,
                  y: 18,
                  width: 220,
                  height: 32,
                  text: "Smart Thermostat",
                  textColor: "#f3f4f6",
                  children: [],
                },
                {
                  id: "Panel1",
                  name: "Panel1",
                  type: "Panel",
                  x: 20,
                  y: 72,
                  width: 392,
                  height: 152,
                  fill: "#111827",
                  radius: 14,
                  children: [
                    {
                      id: "TempLabel",
                      name: "Temperature",
                      type: "Label",
                      x: 36,
                      y: 34,
                      width: 140,
                      height: 56,
                      text: "72°",
                      textColor: "#7eb3e5",
                      children: [],
                    },
                    {
                      id: "Button1",
                      name: "Button1",
                      type: "Button",
                      x: 250,
                      y: 88,
                      width: 96,
                      height: 36,
                      text: "Auto",
                      fill: "#3b82f6",
                      textColor: "#ffffff",
                      radius: 10,
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  };
}
