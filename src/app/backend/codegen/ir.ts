import { buildWidgetTree } from "../tree";
import type { ColorFormat, ProjectSnapshot, WidgetNode, WidgetEventBindings } from "../types";

export type LvglWidgetKind = "container" | "label" | "button" | "slider" | "switch" | "checkbox" | "radio" | "dropdown" | "image";

export interface LvglWidgetIR {
  id: string;
  cName: string;
  kind: LvglWidgetKind;
  parentCName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fillExpression?: string;
  textColorExpression?: string;
  assetSymbol?: string;
  assetMacro?: string;
  options?: string[];
  selectedOptionIndex?: number;
  value?: number;
  checked?: boolean;
  visible: boolean;
  eventBindings?: WidgetEventBindings;
}

export interface LvglAssetIR {
  id: string;
  name: string;
  mimeType: string;
  symbolName: string;
  macroName: string;
  dataUrl: string;
}

export interface LvglScreenIR {
  id: string;
  name: string;
  cName: string;
  width: number;
  height: number;
  fill?: string;
  widgets: LvglWidgetIR[];
}

export interface LvglProjectIR {
  screens: LvglScreenIR[];
  activeScreenCName: string;
  styleTokenMacros: Array<{ name: string; expression: string }>;
  assets: LvglAssetIR[];
  colorFormat: ColorFormat;
}

function sanitizeToken(value: string): string {
  const lowered = value.trim().toLowerCase();
  const normalized = lowered.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "node";
}

function createMacroName(base: string, used: Set<string>): string {
  const normalizedBase = sanitizeToken(base).toUpperCase();
  let candidate = normalizedBase;
  let suffix = 2;

  while (used.has(candidate)) {
    candidate = `${normalizedBase}_${suffix}`;
    suffix += 1;
  }

  used.add(candidate);
  return candidate;
}

function clampInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.round(value);
}

function normalizeHexColor(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const raw = value.trim();
  const short = /^#([0-9a-fA-F]{3})$/;
  const full = /^#([0-9a-fA-F]{6})$/;

  const shortMatch = raw.match(short);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  const fullMatch = raw.match(full);
  if (fullMatch) {
    return `#${fullMatch[1].toUpperCase()}`;
  }

  return undefined;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return null;
  }
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return { r, g, b };
}

export function hexToColorExpression(hex: string, format: ColorFormat): string {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return `lv_color_hex(0x${hex.slice(1).toUpperCase()})`;
  }
  if (format === "monochrome") {
    const rgb = hexToRgb(normalized);
    if (!rgb) {
      return "lv_color_white()";
    }
    // Normalize perceptual luminance to [0, 1] and threshold at 50%
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance >= 0.5 ? "lv_color_white()" : "lv_color_black()";
  }
  if (format === "grayscale8") {
    const rgb = hexToRgb(normalized);
    if (!rgb) {
      return "lv_color_make(128, 128, 128)";
    }
    const gray = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
    return `lv_color_make(${gray}, ${gray}, ${gray})`;
  }
  return `lv_color_hex(0x${normalized.slice(1)})`;
}

function widgetKindFromNode(node: WidgetNode): LvglWidgetKind | null {
  switch (node.type) {
    case "Container":
    case "Panel":
      return "container";
    case "Label":
      return "label";
    case "Button":
      return "button";
    case "Slider":
      return "slider";
    case "Switch":
      return "switch";
    case "Checkbox":
      return "checkbox";
    case "Radio":
      return "radio";
    case "Dropdown":
      return "dropdown";
    case "Image":
      return "image";
    default:
      return null;
  }
}

export function createDeterministicName(base: string, used: Set<string>): string {
  const normalizedBase = sanitizeToken(base);
  let candidate = normalizedBase;
  let suffix = 2;

  while (used.has(candidate)) {
    candidate = `${normalizedBase}_${suffix}`;
    suffix += 1;
  }

  used.add(candidate);
  return candidate;
}

export function projectToLvglIR(project: ProjectSnapshot): LvglProjectIR {
  const colorFormat: ColorFormat = project.colorFormat ?? "rgb888";
  const usedNames = new Set<string>();
  const usedMacroNames = new Set<string>();
  const usedAssetSymbols = new Set<string>();
  const assets: LvglAssetIR[] = Object.values(project.assets).map((asset) => {
    const base = `asset_${sanitizeToken(asset.name.replace(/\.[^.]+$/, ""))}`;
    const symbolName = createDeterministicName(base, usedAssetSymbols);
    const macroName = createMacroName(`UI_ASSET_${asset.name.replace(/\.[^.]+$/, "")}`, usedMacroNames);
    return {
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      symbolName,
      macroName,
      dataUrl: asset.dataUrl,
    };
  });
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const tokenMacroById = new Map<string, string>();
  const styleTokenMacros = project.styleTokens.map((token) => {
    const macroName = createMacroName(`SC_TOKEN_${token.name}`, usedMacroNames);
    tokenMacroById.set(token.id, macroName);
    return {
      name: macroName,
      expression: hexToColorExpression(token.value, colorFormat),
    };
  });
  const screens: LvglScreenIR[] = [];

  for (const screen of project.screens) {
    const screenBase = `ui_${sanitizeToken(screen.name || screen.id)}`;
    const screenName = createDeterministicName(screenBase, usedNames);
    const tree = buildWidgetTree(project, screen.rootNodeId);
    if (!tree) {
      continue;
    }

    const widgetNames = new Set<string>([screenName]);
    const widgets: LvglWidgetIR[] = [];

    const visit = (node: typeof tree, parentCName: string) => {
      for (const child of node.children) {
        const kind = widgetKindFromNode(child);
        const childBase = `${screenName}_${sanitizeToken(child.name || child.id)}`;
        const childName = createDeterministicName(childBase, widgetNames);

        if (kind) {
          const fillExpression = child.fillTokenId
            ? tokenMacroById.get(child.fillTokenId)
            : normalizeHexColor(child.fill)
              ? hexToColorExpression(child.fill!, colorFormat)
              : undefined;
          const textColorExpression = child.textColorTokenId
            ? tokenMacroById.get(child.textColorTokenId)
            : normalizeHexColor(child.textColor)
              ? hexToColorExpression(child.textColor!, colorFormat)
              : undefined;

          const radioText = child.type === "Radio" && child.options?.length
            ? (child.options[child.selectedOptionIndex ?? 0] ?? child.options[0])
            : undefined;

          widgets.push({
            id: child.id,
            cName: childName,
            kind,
            parentCName,
            x: clampInt(child.x, 0),
            y: clampInt(child.y, 0),
            width: Math.max(1, clampInt(child.width, 80)),
            height: Math.max(1, clampInt(child.height, 40)),
            text: radioText ?? child.text ?? "",
            options: child.options,
            selectedOptionIndex: child.selectedOptionIndex,
            fillExpression,
            textColorExpression,
            assetSymbol: child.type === "Image" && child.assetId ? assetById.get(child.assetId)?.symbolName : undefined,
            assetMacro: child.type === "Image" && child.assetId ? assetById.get(child.assetId)?.macroName : undefined,
            value: child.value,
            checked: child.checked,
            visible: child.visible !== false,
            eventBindings: child.eventBindings,
          });
        }

        visit(child, kind ? childName : parentCName);
      }
    };

    visit(tree, screenName);

    screens.push({
      id: screen.id,
      name: screen.name,
      cName: screenName,
      width: Math.max(1, clampInt(screen.meta.width, tree.width || 480)),
      height: Math.max(1, clampInt(screen.meta.height, tree.height || 320)),
      fill: normalizeHexColor(screen.meta.fill ?? tree.fill),
      widgets,
    });
  }

  const activeScreen = screens.find((item) => item.id === project.activeScreenId) ?? screens[0];

  return {
    screens,
    activeScreenCName: activeScreen?.cName ?? "ui_screen",
    styleTokenMacros,
    assets,
    colorFormat,
  };
}
