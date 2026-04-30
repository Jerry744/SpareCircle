// Cross-reference invariant checks for ProjectSnapshotV2.
// Covers INV-2, INV-3 (strong form), INV-4, INV-6, INV-7, INV-8 from
// `dev-plan/interaction-design-framework/01-data-model.md` §4.
// INV-5 is enforced by `navigationMapParser.ts`; INV-9 and INV-10 are
// runtime (reducer) concerns.

import type { WidgetNode } from "../types/widget";
import type { NavigationMap } from "../types/navigationMap";
import type { StateBoard } from "../types/stateBoard";
import type { Variant } from "../types/variant";
import type { Section, ScreenTreeIndex } from "../types/projectV2";
import type { ScreenGroup } from "../types/screenGroup";
import type { TransitionEventBinding } from "../types/eventBinding";

export interface ProjectV2CrossRefInput {
  navigationMap: NavigationMap;
  stateBoardsById: Record<string, StateBoard>;
  variantsById: Record<string, Variant>;
  widgetsById: Record<string, WidgetNode>;
  sectionsById: Record<string, Section>;
  sectionOrderByScreenId: Record<string, string[]>;
  sectionIdByStateId: Record<string, string>;
  screenTreeByScreenId: Record<string, ScreenTreeIndex>;
  screenIdByRootWidgetId: Record<string, string>;
  transitionEventBindings: Record<string, TransitionEventBinding>;
  screenGroups: Record<string, ScreenGroup>;
}

export type CrossRefResult = { ok: true } | { ok: false; error: string };

function fail(error: string): CrossRefResult {
  return { ok: false, error };
}

// INV-2: StateNode ↔ StateBoard bijection.
function checkStateNodeBoardLink(input: ProjectV2CrossRefInput): CrossRefResult {
  const { navigationMap, stateBoardsById } = input;
  const seenBoards = new Set<string>();
  for (const node of Object.values(navigationMap.stateNodes)) {
    const board = stateBoardsById[node.boardId];
    if (!board) {
      return fail(`StateNode "${node.id}".boardId "${node.boardId}" is not a known StateBoard`);
    }
    if (board.stateNodeId !== node.id) {
      return fail(
        `StateBoard "${board.id}".stateNodeId must equal the owning StateNode id ("${node.id}")`,
      );
    }
    if (seenBoards.has(board.id)) {
      return fail(`StateBoard "${board.id}" is referenced by more than one StateNode`);
    }
    seenBoards.add(board.id);
  }
  for (const board of Object.values(stateBoardsById)) {
    if (!navigationMap.stateNodes[board.stateNodeId]) {
      return fail(`StateBoard "${board.id}" points to unknown StateNode "${board.stateNodeId}"`);
    }
  }
  return { ok: true };
}

// INV-3 (strong form): every variantId on a board must resolve, canonical
// included, and every Variant's boardId must point back consistently.
function checkVariantBoardLink(input: ProjectV2CrossRefInput): CrossRefResult {
  const { stateBoardsById, variantsById } = input;
  for (const board of Object.values(stateBoardsById)) {
    if (board.variantIds.length === 0) {
      return fail(`StateBoard "${board.id}" must contain at least one Variant`);
    }
    for (const variantId of board.variantIds) {
      const variant = variantsById[variantId];
      if (!variant) {
        return fail(`StateBoard "${board.id}" references missing Variant "${variantId}"`);
      }
      if (variant.boardId !== board.id) {
        return fail(
          `Variant "${variant.id}".boardId "${variant.boardId}" does not match owning StateBoard "${board.id}"`,
        );
      }
    }
    if (!variantsById[board.canonicalVariantId]) {
      return fail(
        `StateBoard "${board.id}".canonicalVariantId "${board.canonicalVariantId}" is not a known Variant`,
      );
    }
    if (!board.variantIds.includes(board.canonicalVariantId)) {
      return fail(
        `StateBoard "${board.id}".canonicalVariantId must be included in variantIds`,
      );
    }
  }
  for (const variant of Object.values(variantsById)) {
    if (!stateBoardsById[variant.boardId]) {
      return fail(`Variant "${variant.id}".boardId "${variant.boardId}" is not a known StateBoard`);
    }
  }
  return { ok: true };
}

// INV-4: each Variant's rootWidgetId must be a Screen widget with no parent.
function checkVariantRootWidget(input: ProjectV2CrossRefInput): CrossRefResult {
  const { stateBoardsById, variantsById, widgetsById } = input;
  const rootsSeen = new Map<string, string>();
  for (const variant of Object.values(variantsById)) {
    const widget = widgetsById[variant.rootWidgetId];
    if (!widget) {
      return fail(`Variant "${variant.id}".rootWidgetId "${variant.rootWidgetId}" is not a known widget`);
    }
    if (widget.type !== "Screen") {
      return fail(`Variant "${variant.id}" root widget "${widget.id}" must be of type "Screen"`);
    }
    if (widget.parentId !== null) {
      return fail(`Variant "${variant.id}" root widget "${widget.id}" must have parentId === null`);
    }
    const board = stateBoardsById[variant.boardId];
    if (board && (widget.width !== board.meta.width || widget.height !== board.meta.height)) {
      return fail(`Variant "${variant.id}" root widget "${widget.id}" must match StateBoard resolution`);
    }
    const previousOwner = rootsSeen.get(widget.id);
    if (previousOwner) {
      return fail(
        `Widget "${widget.id}" is used as root by both Variant "${previousOwner}" and Variant "${variant.id}"`,
      );
    }
    rootsSeen.set(widget.id, variant.id);
  }
  return { ok: true };
}

// Widget parent/children integrity, mirroring the v1 parser.
function checkWidgetTree(input: ProjectV2CrossRefInput): CrossRefResult {
  const { widgetsById } = input;
  for (const widget of Object.values(widgetsById)) {
    for (const childId of widget.childrenIds) {
      const child = widgetsById[childId];
      if (!child) return fail(`Widget "${widget.id}" references missing child "${childId}"`);
      if (child.parentId !== widget.id) {
        return fail(`Widget "${childId}".parentId must equal "${widget.id}"`);
      }
    }
  }
  return { ok: true };
}

function checkSections(input: ProjectV2CrossRefInput): CrossRefResult {
  const {
    navigationMap,
    stateBoardsById,
    variantsById,
    sectionsById,
    sectionIdByStateId,
    sectionOrderByScreenId,
    screenTreeByScreenId,
    screenIdByRootWidgetId,
  } = input;
  const seenSections = new Set<string>();
  const sectionOrderMembership = new Set(Object.values(sectionOrderByScreenId).flat());

  for (const board of Object.values(stateBoardsById)) {
    const stateNode = navigationMap.stateNodes[board.stateNodeId];
    if (!stateNode) continue;
    for (const variantId of board.variantIds) {
      const variant = variantsById[variantId];
      if (!variant) continue;
      const sectionId = sectionIdByStateId[variant.id];
    const section = sectionId ? sectionsById[sectionId] : undefined;
      if (!section) return fail(`Variant "${variant.id}" must map to exactly one Section`);
    if (seenSections.has(section.id)) return fail(`Section "${section.id}" is mapped from more than one StateNode`);
    seenSections.add(section.id);
      if (section.stateId !== variant.id) return fail(`Section "${section.id}".stateId must equal "${variant.id}"`);
    if (!sectionOrderMembership.has(section.id)) return fail(`Section "${section.id}" must be present in sectionOrderByScreenId`);

      if (section.canonicalFrameId !== variant.rootWidgetId) {
        return fail(`Section "${section.id}".canonicalFrameId must equal its Variant root frame`);
    }
      for (const draftNodeId of section.draftNodeIds) {
        const draftNode = input.widgetsById[draftNodeId];
        if (!draftNode) return fail(`Section "${section.id}".draftNodeIds references missing widget "${draftNodeId}"`);
        if (draftNode.parentId !== null) return fail(`Section "${section.id}".draftNodeIds widget "${draftNodeId}" must have parentId === null`);
        if (draftNode.type === "Screen" && (draftNode.width !== board.meta.width || draftNode.height !== board.meta.height)) {
          return fail(`Section "${section.id}" draft frame "${draftNodeId}" must match StateBoard resolution`);
        }
      }
      const frameRootIds = [variant.rootWidgetId, ...section.draftNodeIds.filter((nodeId) => input.widgetsById[nodeId]?.type === "Screen")];
      for (const rootWidgetId of frameRootIds) {
        if (screenIdByRootWidgetId[rootWidgetId] !== section.screenId) {
          return fail(`Frame root "${rootWidgetId}" must belong to Section "${section.id}" screen tree`);
        }
        if (!screenTreeByScreenId[section.screenId]?.rootWidgetIds.includes(rootWidgetId)) {
          return fail(`screenTreeByScreenId["${section.screenId}"] must include frame root "${rootWidgetId}"`);
        }
      }
    }
  }

  for (const section of Object.values(sectionsById)) {
    if (!variantsById[section.stateId]) {
      return fail(`Section "${section.id}" points to unknown Variant "${section.stateId}"`);
    }
  }
  return { ok: true };
}

// INV-6, INV-7, INV-8: binding integrity.
function checkTransitionEventBindings(input: ProjectV2CrossRefInput): CrossRefResult {
  const { navigationMap, transitionEventBindings, widgetsById } = input;
  const bindingsPerTransition = new Map<string, string>();
  for (const binding of Object.values(transitionEventBindings)) {
    const transition = navigationMap.transitions[binding.transitionId];
    if (!transition) {
      return fail(`TransitionEventBinding "${binding.id}" references missing Transition "${binding.transitionId}"`);
    }
    if (binding.trigger.kind === "widget_event") {
      if (!widgetsById[binding.trigger.widgetId]) {
        return fail(
          `TransitionEventBinding "${binding.id}".trigger.widgetId "${binding.trigger.widgetId}" is not a known widget`,
        );
      }
    }
    const existing = bindingsPerTransition.get(binding.transitionId);
    if (existing) {
      return fail(
        `Transition "${binding.transitionId}" has more than one EventBinding ("${existing}", "${binding.id}")`,
      );
    }
    bindingsPerTransition.set(binding.transitionId, binding.id);
  }
  // Transition.eventBindingId (when present) must resolve to a binding that
  // also points back at the same Transition.
  for (const transition of Object.values(navigationMap.transitions)) {
    if (!transition.eventBindingId) continue;
    const binding = transitionEventBindings[transition.eventBindingId];
    if (!binding) {
      return fail(
        `Transition "${transition.id}".eventBindingId "${transition.eventBindingId}" is not a known binding`,
      );
    }
    if (binding.transitionId !== transition.id) {
      return fail(
        `Binding "${binding.id}".transitionId "${binding.transitionId}" must equal "${transition.id}"`,
      );
    }
  }
  return { ok: true };
}

// ScreenGroup ↔ StateNode reverse-index consistency.
function checkScreenGroupMembership(input: ProjectV2CrossRefInput): CrossRefResult {
  const { navigationMap, screenGroups } = input;
  for (const node of Object.values(navigationMap.stateNodes)) {
    if (!node.screenGroupId) continue;
    const group = screenGroups[node.screenGroupId];
    if (!group) {
      return fail(`StateNode "${node.id}".screenGroupId "${node.screenGroupId}" is not a known ScreenGroup`);
    }
    if (!group.stateNodeIds.includes(node.id)) {
      return fail(
        `ScreenGroup "${group.id}".stateNodeIds must include StateNode "${node.id}" because that node declares the group`,
      );
    }
  }
  for (const group of Object.values(screenGroups)) {
    for (const nodeId of group.stateNodeIds) {
      const node = navigationMap.stateNodes[nodeId];
      if (!node) {
        return fail(`ScreenGroup "${group.id}" lists unknown StateNode "${nodeId}"`);
      }
      if (node.screenGroupId !== group.id) {
        return fail(
          `StateNode "${node.id}".screenGroupId must equal "${group.id}" because the group claims ownership`,
        );
      }
    }
  }
  return { ok: true };
}

export function runProjectV2CrossRefChecks(input: ProjectV2CrossRefInput): CrossRefResult {
  const checks: Array<(input: ProjectV2CrossRefInput) => CrossRefResult> = [
    checkStateNodeBoardLink,
    checkVariantBoardLink,
    checkVariantRootWidget,
    checkWidgetTree,
    checkSections,
    checkTransitionEventBindings,
    checkScreenGroupMembership,
  ];
  for (const check of checks) {
    const result = check(input);
    if (!result.ok) return result;
  }
  return { ok: true };
}
