// ProjectSnapshotV2 parser.
// Wires together the per-domain parsers and runs the cross-reference
// invariant checks. Tightly mirrors the v1 `projectParser.ts` layout, with
// the addition of the Navigation Map centric relationships.

import type { WidgetNode } from "../types/widget";
import type { StateBoard } from "../types/stateBoard";
import type { Variant } from "../types/variant";
import type { ScreenGroup } from "../types/screenGroup";
import type { TransitionEventBinding } from "../types/eventBinding";
import type {
  ProjectSnapshotCore,
  ProjectSnapshotV2,
  TreeNode,
} from "../types/projectV2";
import { CURRENT_PROJECT_SCHEMA_VERSION_V2 } from "../types/projectV2";
import type { Snapshot } from "../types/snapshot";
import type { NavigationZoomLevel } from "../types/zoomLevel";
import { DEFAULT_ZOOM_LEVEL } from "../types/zoomLevel";
import type { WorkspaceMode } from "../types/mode";
import { DEFAULT_WORKSPACE_MODE, WORKSPACE_MODES } from "../types/mode";
import { DEFAULT_CANVAS_SNAP, DEFAULT_PROJECT_NAME } from "../types/project";
import type { CanvasSnapSettings } from "../types/project";

import { isColorFormat, isRecord } from "./helpers";
import { parseNormalizedWidget } from "./widgetParser";
import { parseAssets } from "./assetParser";
import { parseStyleTokens } from "./tokenParser";
import { parseNavigationMap } from "./navigationMapParser";
import { parseStateBoard } from "./stateBoardParser";
import { parseVariant } from "./variantParser";
import { parseScreenGroup } from "./screenGroupParser";
import { parseTransitionEventBinding } from "./transitionEventBindingParser";
import { runProjectV2CrossRefChecks } from "./projectV2CrossRef";
import type { ParseResult } from "./parseResult";
import { parseFail, parseOk } from "./parseResult";
import { syncSectionIndexes } from "../stateBoard/sectionModel";

function parseCanvasSnap(input: unknown): CanvasSnapSettings {
  if (!isRecord(input)) return { ...DEFAULT_CANVAS_SNAP };
  return {
    pixelSnapEnabled:
      typeof input.pixelSnapEnabled === "boolean" ? input.pixelSnapEnabled : DEFAULT_CANVAS_SNAP.pixelSnapEnabled,
    magnetSnapEnabled:
      typeof input.magnetSnapEnabled === "boolean" ? input.magnetSnapEnabled : DEFAULT_CANVAS_SNAP.magnetSnapEnabled,
    snapThresholdPx:
      typeof input.snapThresholdPx === "number" &&
      Number.isFinite(input.snapThresholdPx) &&
      input.snapThresholdPx > 0
        ? input.snapThresholdPx
        : DEFAULT_CANVAS_SNAP.snapThresholdPx,
  };
}

function parseWorkspaceMode(input: unknown): WorkspaceMode {
  return typeof input === "string" && WORKSPACE_MODES.includes(input as WorkspaceMode)
    ? (input as WorkspaceMode)
    : DEFAULT_WORKSPACE_MODE;
}

function parseZoomLevel(input: unknown): NavigationZoomLevel {
  if (!isRecord(input)) return { ...DEFAULT_ZOOM_LEVEL };
  if (input.level === "map") return { level: "map" };
  if (
    input.level === "board" &&
    typeof input.stateNodeId === "string" &&
    typeof input.variantId === "string"
  ) {
    return { level: "board", stateNodeId: input.stateNodeId, variantId: input.variantId };
  }
  return { ...DEFAULT_ZOOM_LEVEL };
}

function parseRecord<T>(
  input: unknown,
  path: string,
  parse: (raw: unknown, path: string) => ParseResult<T>,
  idOf: (value: T) => string,
): ParseResult<Record<string, T>> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);
  const result: Record<string, T> = {};
  for (const [key, raw] of Object.entries(input)) {
    const parsed = parse(raw, `${path}["${key}"]`);
    if (!parsed.ok) return parsed;
    if (idOf(parsed.value) !== key) {
      return parseFail(`${path}["${key}"].id must equal the record key`);
    }
    result[key] = parsed.value;
  }
  return parseOk(result);
}

function parseOrderedKeys(
  input: unknown,
  path: string,
  knownIds: Set<string>,
): ParseResult<string[]> {
  if (!Array.isArray(input)) return parseFail(`${path} must be an array`);
  const seen = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    const value = input[index];
    if (typeof value !== "string" || !knownIds.has(value)) {
      return parseFail(`${path}[${index}] must reference an existing id`);
    }
    if (seen.has(value)) return parseFail(`${path}[${index}] "${value}" is duplicated`);
    seen.add(value);
  }
  for (const id of knownIds) {
    if (!seen.has(id)) return parseFail(`${path} is missing id "${id}"`);
  }
  return parseOk([...input] as string[]);
}

function parseWidgets(input: unknown, path: string): ParseResult<Record<string, WidgetNode>> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);
  const widgets: Record<string, WidgetNode> = {};
  for (const [key, raw] of Object.entries(input)) {
    const parsed = parseNormalizedWidget(raw, `${path}["${key}"]`);
    if (!parsed.ok) return parseFail(parsed.error);
    if (parsed.widget.id !== key) {
      return parseFail(`${path}["${key}"].id must equal the record key`);
    }
    widgets[key] = parsed.widget;
  }
  return parseOk(widgets);
}

function parseStringArray(input: unknown, path: string): ParseResult<string[]> {
  if (!Array.isArray(input)) return parseFail(`${path} must be an array`);
  const out: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    const value = input[index];
    if (typeof value !== "string" || !value.trim()) return parseFail(`${path}[${index}] must be a non-empty string`);
    if (seen.has(value)) return parseFail(`${path}[${index}] "${value}" is duplicated`);
    seen.add(value);
    out.push(value);
  }
  return parseOk(out);
}



function parseTreeNodesById(input: unknown, path: string): ParseResult<Record<string, TreeNode>> {
  if (!isRecord(input)) return parseFail(`${path} must be a non-empty object — tree structure is required`);
  if (Object.keys(input).length === 0) return parseFail(`${path} must contain at least one tree node`);
  const result: Record<string, TreeNode> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!isRecord(raw)) return parseFail(`${path}["${key}"] must be an object`);
    const { id, kind, parentId, childrenIds } = raw as Record<string, unknown>;
    if (typeof id !== "string" || id !== key) return parseFail(`${path}["${key}"].id must match key`);
    if (!["screen_root", "state_section", "free_layer"].includes(kind as string)) {
      return parseFail(`${path}["${key}"].kind must be one of screen_root/state_section/free_layer`);
    }
    if (parentId !== null && typeof parentId !== "string") return parseFail(`${path}["${key}"].parentId must be null or string`);
    if (!Array.isArray(childrenIds)) return parseFail(`${path}["${key}"].childrenIds must be an array`);
    result[key] = raw as unknown as TreeNode;
  }
  // Validate parent references exist within tree
  for (const [nodeId, node] of Object.entries(result)) {
    if (node.parentId && !result[node.parentId]) {
      return parseFail(`${path}["${nodeId}"].parentId "${node.parentId}" does not exist in tree`);
    }
  }
  return parseOk(result);
}

function applyAndValidateSectionIndexes(
  core: ProjectSnapshotCore,
  path: string,
): ParseResult<ProjectSnapshotCore> {
  // Derive all indexes from the tree (or derive tree from nav map if tree is empty).
  // This is a one-way path: tree → derived indexes.
  const derived = syncSectionIndexes(core);
  return parseOk(derived);
}

function parseProjectSnapshotCore(
  input: unknown,
  path = "project",
): ParseResult<ProjectSnapshotCore> {
  if (!isRecord(input)) return parseFail(`${path} must be an object`);

  if (input.schemaVersion !== CURRENT_PROJECT_SCHEMA_VERSION_V2) {
    return parseFail(`${path}.schemaVersion must equal ${CURRENT_PROJECT_SCHEMA_VERSION_V2}`);
  }

  const projectName =
    typeof input.projectName === "string" && input.projectName.trim().length > 0
      ? input.projectName.trim()
      : DEFAULT_PROJECT_NAME;

  const navigationMapResult = parseNavigationMap(input.navigationMap, `${path}.navigationMap`);
  if (!navigationMapResult.ok) return navigationMapResult;

  const stateBoardsResult = parseRecord<StateBoard>(
    input.stateBoardsById,
    `${path}.stateBoardsById`,
    parseStateBoard,
    (board) => board.id,
  );
  if (!stateBoardsResult.ok) return stateBoardsResult;

  const variantsResult = parseRecord<Variant>(
    input.variantsById,
    `${path}.variantsById`,
    parseVariant,
    (variant) => variant.id,
  );
  if (!variantsResult.ok) return variantsResult;

  const widgetsResult = parseWidgets(input.widgetsById, `${path}.widgetsById`);
  if (!widgetsResult.ok) return widgetsResult;

  const bindingsResult = parseRecord<TransitionEventBinding>(
    input.transitionEventBindings,
    `${path}.transitionEventBindings`,
    parseTransitionEventBinding,
    (binding) => binding.id,
  );
  if (!bindingsResult.ok) return bindingsResult;

  const screenGroupsResult = parseRecord<ScreenGroup>(
    input.screenGroups,
    `${path}.screenGroups`,
    parseScreenGroup,
    (group) => group.id,
  );
  if (!screenGroupsResult.ok) return screenGroupsResult;

  const screenGroupOrderResult = parseOrderedKeys(
    input.screenGroupOrder,
    `${path}.screenGroupOrder`,
    new Set(Object.keys(screenGroupsResult.value)),
  );
  if (!screenGroupOrderResult.ok) return screenGroupOrderResult;

  const styleTokensResult = parseStyleTokens(input.styleTokens);
  if (!styleTokensResult.ok) return parseFail(styleTokensResult.error);

  const assetsResult = parseAssets(input.assets);
  if (!assetsResult.ok) return parseFail(assetsResult.error);

  // Asset references on widgets must resolve — reuse the same rule as v1.
  for (const widget of Object.values(widgetsResult.value)) {
    if (widget.assetId && !assetsResult.assets[widget.assetId]) {
      return parseFail(`Widget ${widget.id}.assetId does not exist in assets`);
    }
    if (widget.assetId && widget.type !== "Image") {
      return parseFail(`Widget ${widget.id}.assetId can only be used by Image widgets`);
    }
  }

  const treeNodesResult = parseTreeNodesById(input.treeNodesById, `${path}.treeNodesById`);
  if (!treeNodesResult.ok) return treeNodesResult;

  const coreWithoutSections: ProjectSnapshotCore = {
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION_V2,
    projectName,
    navigationMap: navigationMapResult.value,
    stateBoardsById: stateBoardsResult.value,
    variantsById: variantsResult.value,
    widgetsById: widgetsResult.value,
    treeNodesById: treeNodesResult.value,
    sectionsById: {},
    sectionOrderByScreenId: {},
    sectionIdByStateId: {},
    screenTreeByScreenId: {},
    screenIdByRootWidgetId: {},
    transitionEventBindings: bindingsResult.value,
    screenGroups: screenGroupsResult.value,
    screenGroupOrder: screenGroupOrderResult.value,
    styleTokens: styleTokensResult.tokens,
    assets: assetsResult.assets,
    colorFormat: isColorFormat(input.colorFormat) ? input.colorFormat : undefined,
    canvasSnap: parseCanvasSnap(input.canvasSnap),
  };

  const sectionResult = applyAndValidateSectionIndexes(coreWithoutSections, path);
  if (!sectionResult.ok) return sectionResult;

  const crossRefResult = runProjectV2CrossRefChecks({
    navigationMap: navigationMapResult.value,
    stateBoardsById: stateBoardsResult.value,
    variantsById: variantsResult.value,
    widgetsById: widgetsResult.value,
    treeNodesById: sectionResult.value.treeNodesById,
    sectionsById: sectionResult.value.sectionsById,
    sectionOrderByScreenId: sectionResult.value.sectionOrderByScreenId,
    sectionIdByStateId: sectionResult.value.sectionIdByStateId,
    screenTreeByScreenId: sectionResult.value.screenTreeByScreenId,
    screenIdByRootWidgetId: sectionResult.value.screenIdByRootWidgetId,
    transitionEventBindings: bindingsResult.value,
    screenGroups: screenGroupsResult.value,
  });
  if (!crossRefResult.ok) return parseFail(crossRefResult.error);

  return parseOk(sectionResult.value);
}

function parseSnapshots(input: unknown, path: string): ParseResult<Snapshot[]> {
  if (input === undefined) return parseOk([]);
  if (!Array.isArray(input)) return parseFail(`${path} must be an array when provided`);
  const snapshots: Snapshot[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index];
    if (!isRecord(raw)) return parseFail(`${path}[${index}] must be an object`);
    const { id, name, createdAt, description, project } = raw;
    if (typeof id !== "string" || !id.trim()) return parseFail(`${path}[${index}].id must be a non-empty string`);
    if (typeof name !== "string" || !name.trim()) return parseFail(`${path}[${index}].name must be a non-empty string`);
    if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) {
      return parseFail(`${path}[${index}].createdAt must be a valid ISO-8601 timestamp`);
    }
    if (description !== undefined && typeof description !== "string") {
      return parseFail(`${path}[${index}].description must be a string when provided`);
    }
    const coreResult = parseProjectSnapshotCore(project, `${path}[${index}].project`);
    if (!coreResult.ok) return coreResult;
    snapshots.push({ id, name, createdAt, description, project: coreResult.value });
  }
  return parseOk(snapshots);
}

export function parseProjectSnapshotV2(
  input: unknown,
  path = "project",
): ParseResult<ProjectSnapshotV2> {
  const coreResult = parseProjectSnapshotCore(input, path);
  if (!coreResult.ok) return coreResult;
  const record = input as Record<string, unknown>;

  const snapshotsResult = parseSnapshots(record.snapshots, `${path}.snapshots`);
  if (!snapshotsResult.ok) return snapshotsResult;

  return parseOk({
    ...coreResult.value,
    snapshots: snapshotsResult.value,
    workspaceMode: parseWorkspaceMode(record.workspaceMode),
    zoomLevel: parseZoomLevel(record.zoomLevel),
  });
}

export { parseProjectSnapshotCore };
