import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Eye, EyeOff, FolderOpen, Monitor, Plus, Star, Trash2 } from "lucide-react";
import type { VariantAction } from "../../backend/reducer/variantActions";
import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { StateBoard } from "../../backend/types/stateBoard";
import type { Variant } from "../../backend/types/variant";
import { CONTAINER_WIDGET_TYPES, type WidgetNode } from "../../backend/types/widget";
import { ID_PREFIX, makeId } from "../../backend/types/idPrefixes";
import type { StateBoardSelection } from "./stateBoardSelection";
import { getSelectedVariantIds, getSelectedWidgetIdsByVariant, getSelectedWidgetIdsForVariant } from "./stateBoardSelection";

type DropPosition = "before" | "inside" | "after";
type DragSource =
  | { kind: "screen"; variantId: string }
  | { kind: "widget"; widgetId: string };
type TreeNode = WidgetNode & { children: TreeNode[] };
type TreeLocation = { parentId: string | null; index: number; widget: TreeNode };
type SectionFrame = { variant: Variant; root: TreeNode; sectionId: string; isCanonicalFrame: boolean };
type SectionGroup = { variant: Variant; sectionId: string; frames: SectionFrame[] };

export interface StateHierarchyContext {
  project: ProjectSnapshotV2;
  board: StateBoard;
  activeVariantId: string;
  selection: StateBoardSelection;
  onSelectVariant(variantId: string): void;
  onSelectionChange(selection: StateBoardSelection): void;
  onVariantAction(action: VariantAction): void;
}

interface StateHierarchyPanelProps {
  context: StateHierarchyContext;
}

function buildTree(widgetsById: Record<string, WidgetNode>, rootId: string): TreeNode | null {
  const build = (id: string, visiting: Set<string>): TreeNode | null => {
    const widget = widgetsById[id];
    if (!widget || visiting.has(id)) return null;
    const nextVisiting = new Set(visiting);
    nextVisiting.add(id);
    return {
      ...widget,
      children: widget.childrenIds
        .map((childId) => build(childId, nextVisiting))
        .filter((child): child is TreeNode => Boolean(child)),
    };
  };
  return build(rootId, new Set());
}

function findLocation(root: TreeNode, widgetId: string, parentId: string | null = null): TreeLocation | null {
  if (root.id === widgetId) return { parentId, index: 0, widget: root };
  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (child.id === widgetId) return { parentId: root.id, index, widget: child };
    const nested = findLocation(child, widgetId, child.id);
    if (nested) return nested;
  }
  return null;
}

function collectVisibleIds(root: TreeNode, expandedIds: Record<string, boolean>, depth = 0): string[] {
  const ids = [root.id];
  const expanded = depth === 0 ? true : expandedIds[root.id] ?? true;
  if (expanded) {
    for (const child of root.children) ids.push(...collectVisibleIds(child, expandedIds, depth + 1));
  }
  return ids;
}

function resolveDropPosition(widget: TreeNode, event: React.DragEvent<HTMLDivElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  const relativeY = (event.clientY - rect.top) / rect.height;
  if (CONTAINER_WIDGET_TYPES.has(widget.type) && relativeY >= 0.25 && relativeY <= 0.75) return "inside";
  return relativeY < 0.5 ? "before" : "after";
}

function getStorageKey(project: ProjectSnapshotV2, board: StateBoard): string {
  return `sparecircle:stateHierarchy:${project.projectName}:${board.id}`;
}

function readExpandedState(key: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as Record<string, boolean> : {};
  } catch {
    return {};
  }
}

export function StateHierarchyPanel({ context }: StateHierarchyPanelProps): JSX.Element {
  const { project, board, activeVariantId, selection, onSelectVariant, onSelectionChange, onVariantAction } = context;
  const storageKey = useMemo(() => getStorageKey(project, board), [project.projectName, board.id]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => readExpandedState(storageKey));
  const [dragging, setDragging] = useState<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<{ key: string; position: DropPosition } | null>(null);
  const rangeAnchorRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(expandedIds));
  }, [expandedIds, storageKey]);

  const sectionGroups = useMemo(() => board.variantIds
    .map((variantId): SectionGroup | null => {
      const variant = project.variantsById[variantId];
      if (!variant) return null;
      const sectionId = project.sectionIdByStateId[variant.id];
      const section = project.sectionsById[sectionId];
      const canonicalRoot = buildTree(project.widgetsById, variant.rootWidgetId);
      const frames: SectionFrame[] = canonicalRoot && section
        ? [{ variant, root: canonicalRoot, sectionId, isCanonicalFrame: true }]
        : [];
      for (const draftNodeId of section?.draftNodeIds ?? []) {
        const draftTree = buildTree(project.widgetsById, draftNodeId);
        if (draftTree) frames.push({ variant, root: draftTree, sectionId, isCanonicalFrame: false });
      }
      return section && frames.length > 0 ? { variant, sectionId, frames } : null;
    })
    .filter((item): item is SectionGroup => Boolean(item)), [board.variantIds, project.sectionIdByStateId, project.sectionsById, project.variantsById, project.widgetsById]);

  const selectedFrameRootIdsByVariant = useMemo(() => {
    const result: Record<string, Set<string>> = {};
    const selectedWidgetIdsByVariant = getSelectedWidgetIdsByVariant(selection);
    for (const [variantId, widgetIds] of Object.entries(selectedWidgetIdsByVariant)) {
      const variant = project.variantsById[variantId];
      if (!variant) continue;
      const sectionId = project.sectionIdByStateId[variant.id];
      const section = project.sectionsById[sectionId];
      if (!section) continue;
      const frameRootIds = new Set<string>([variant.rootWidgetId, ...section.draftNodeIds]);
      const roots = new Set<string>();
      for (const widgetId of widgetIds) {
        if (frameRootIds.has(widgetId)) {
          roots.add(widgetId);
          continue;
        }
        let current = project.widgetsById[widgetId];
        while (current?.parentId) {
          const parent = project.widgetsById[current.parentId];
          if (!parent) break;
          if (frameRootIds.has(parent.id)) {
            roots.add(parent.id);
            break;
          }
          current = parent;
        }
      }
      if (roots.size > 0) result[variantId] = roots;
    }
    return result;
  }, [selection, project.variantsById, project.sectionIdByStateId, project.sectionsById, project.widgetsById]);

  const addState = () => {
    const variantId = makeId(ID_PREFIX.variant);
    onVariantAction({ type: "createVariant", boardId: board.id, mode: "blank", name: "State", variantId });
    onSelectVariant(variantId);
    onSelectionChange({ kind: "screen", variantIds: [variantId] });
  };

  const duplicateFrame = (sectionId = project.sectionIdByStateId[activeVariantId], frameId = project.variantsById[activeVariantId]?.rootWidgetId) => {
    if (!sectionId || !frameId) return;
    onVariantAction({
      type: "duplicateSectionFrame",
      sectionId,
      frameId,
      newFrameId: makeId(ID_PREFIX.variant),
    });
  };

  const deleteState = () => {
    if (board.variantIds.length <= 1) return;
    const deleteIndex = board.variantIds.indexOf(activeVariantId);
    const fallbackVariantId = board.variantIds[deleteIndex + 1] ?? board.variantIds[deleteIndex - 1] ?? board.canonicalVariantId;
    onVariantAction({ type: "deleteVariant", variantId: activeVariantId });
    onSelectVariant(fallbackVariantId);
    onSelectionChange({ kind: "screen", variantIds: [fallbackVariantId] });
  };

  const clearDrag = () => {
    setDragging(null);
    setDropTarget(null);
  };

  const selectWidgetRow = (
    widgetId: string,
    variantId: string,
    variantVisibleIds: string[],
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    onSelectVariant(variantId);
    const isCtrl = event.metaKey || event.ctrlKey;
    const currentWidgetIds = getSelectedWidgetIdsForVariant(selection, variantId);
    if (event.shiftKey) {
      const anchorId = rangeAnchorRef.current ?? widgetId;
      const anchorIndex = variantVisibleIds.indexOf(anchorId);
      const currentIndex = variantVisibleIds.indexOf(widgetId);
      const start = anchorIndex < 0 ? currentIndex : Math.min(anchorIndex, currentIndex);
      const end = anchorIndex < 0 ? currentIndex : Math.max(anchorIndex, currentIndex);
      const range = variantVisibleIds.slice(start, end + 1);
      onSelectionChange({
        kind: "widget",
        variantId,
        widgetIds: isCtrl ? [...new Set([...currentWidgetIds, ...range])] : range,
      });
      return;
    }

    const widgetIds = isCtrl
      ? currentWidgetIds.includes(widgetId)
        ? currentWidgetIds.filter((id) => id !== widgetId)
        : [...currentWidgetIds, widgetId]
      : [widgetId];
    onSelectionChange({ kind: "widget", variantId, widgetIds });
    rangeAnchorRef.current = widgetId;
  };

  const performScreenReorder = (sourceVariantId: string, targetVariantId: string, position: DropPosition) => {
    if (sourceVariantId === targetVariantId || position === "inside") return;
    const orderedIds = board.variantIds.filter((id) => id !== sourceVariantId);
    const targetIndex = orderedIds.indexOf(targetVariantId);
    if (targetIndex < 0) return;
    orderedIds.splice(targetIndex + (position === "after" ? 1 : 0), 0, sourceVariantId);
    onVariantAction({ type: "reorderVariants", boardId: board.id, orderedIds });
  };

  const performWidgetMove = (sourceWidgetId: string, targetRoot: TreeNode, targetWidgetId: string, position: DropPosition) => {
    if (sourceWidgetId === targetWidgetId) return;
    if (position === "inside") {
      const target = findLocation(targetRoot, targetWidgetId)?.widget;
      if (!target || !CONTAINER_WIDGET_TYPES.has(target.type)) return;
      onVariantAction({ type: "moveVariantWidget", widgetId: sourceWidgetId, targetParentId: target.id, targetIndex: target.children.length });
      return;
    }
    const target = findLocation(targetRoot, targetWidgetId);
    if (!target?.parentId) return;
    onVariantAction({
      type: "moveVariantWidget",
      widgetId: sourceWidgetId,
      targetParentId: target.parentId,
      targetIndex: target.index + (position === "after" ? 1 : 0),
    });
  };
  const performWidgetMoveToSection = (sourceWidgetId: string, sectionId: string) => {
    const section = project.sectionsById[sectionId];
    if (!section || section.draftNodeIds.includes(sourceWidgetId)) return;
    onVariantAction({ type: "moveVariantWidget", widgetId: sourceWidgetId, targetParentId: sectionId, targetIndex: section.draftNodeIds.length });
  };

  const renderWidget = (widget: TreeNode, variant: Variant, root: TreeNode, depth: number, sectionId: string, isCanonicalFrame: boolean) => {
    const isRoot = widget.id === root.id;
    const isScreenRoot = isRoot && widget.type === "Screen";
    const hasChildren = widget.children.length > 0;
    const expanded = isRoot ? true : expandedIds[widget.id] ?? true;
    const variantVisibleIds = collectVisibleIds(root, expandedIds).filter((id) => id !== root.id);
    const isActiveScreen = isScreenRoot && variant.id === activeVariantId && widget.id === variant.rootWidgetId;
    const isCanonicalFrameRoot = isScreenRoot && isCanonicalFrame && board.canonicalVariantId === variant.id;
    const isSelected = isRoot
      ? (
          getSelectedWidgetIdsForVariant(selection, variant.id).includes(widget.id) ||
          Boolean(selectedFrameRootIdsByVariant[variant.id]?.has(widget.id)) ||
          (isCanonicalFrameRoot && getSelectedVariantIds(selection).includes(variant.id))
        )
      : getSelectedWidgetIdsForVariant(selection, variant.id).includes(widget.id);
    const isDropTarget = dropTarget?.key === widget.id;
    const dropBefore = isDropTarget && dropTarget.position === "before";
    const dropInside = isDropTarget && dropTarget.position === "inside";
    const dropAfter = isDropTarget && dropTarget.position === "after";

    return (
      <div key={widget.id}>
        <div
          className={`relative flex items-center gap-1 px-2 py-1 rounded cursor-pointer border border-transparent transition-colors ${
            isSelected
              ? "bg-highlight-900 text-white"
              : isActiveScreen
                ? "bg-neutral-700 text-neutral-100"
                : "hover:bg-neutral-600 text-neutral-200"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(event) => {
            if (isRoot) {
              onSelectVariant(variant.id);
              const isCtrl = event.metaKey || event.ctrlKey;
              const currentWidgetIds = getSelectedWidgetIdsForVariant(selection, variant.id);
              const nextIds = isCtrl
                ? currentWidgetIds.includes(widget.id)
                  ? currentWidgetIds.filter((id) => id !== widget.id)
                  : [...currentWidgetIds, widget.id]
                : [widget.id];
              onSelectionChange({ kind: "widget", variantId: variant.id, widgetIds: nextIds });
              rangeAnchorRef.current = null;
            } else {
              selectWidgetRow(widget.id, variant.id, variantVisibleIds, event);
            }
          }}
          draggable
          onDragStart={(event) => {
            const source: DragSource = isCanonicalFrameRoot ? { kind: "screen", variantId: variant.id } : { kind: "widget", widgetId: widget.id };
            setDragging(source);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("state-hierarchy-source", JSON.stringify(source));
          }}
          onDragOver={(event) => {
            const source = dragging;
            if (!source || (source.kind === "widget" && source.widgetId === widget.id)) return;
            event.preventDefault();
            const position = isScreenRoot && source.kind === "screen" ? resolveDropPosition({ ...widget, type: "Label" }, event) : resolveDropPosition(widget, event);
            setDropTarget({ key: widget.id, position });
          }}
          onDrop={(event) => {
            event.preventDefault();
            const source = dragging;
            const position = dropTarget?.key === widget.id ? dropTarget.position : resolveDropPosition(widget, event);
            if (source?.kind === "screen" && isScreenRoot) performScreenReorder(source.variantId, variant.id, position);
            if (source?.kind === "widget") performWidgetMove(source.widgetId, root, widget.id, position);
            clearDrag();
          }}
          onDragEnd={clearDrag}
        >
          {dropBefore && <div className="absolute left-1 right-1 h-0.5 bg-highlight-500 -translate-y-2" />}
          {hasChildren && !isRoot ? (
            <button
              className="p-0.5 hover:bg-neutral-500 rounded text-neutral-300"
              onClick={(event) => {
                event.stopPropagation();
                setExpandedIds((prev) => ({ ...prev, [widget.id]: !(prev[widget.id] ?? true) }));
              }}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <div className="w-5 flex items-center justify-center">{isScreenRoot ? <Monitor size={13} /> : null}</div>
          )}
          <span className="text-xs flex-1 truncate">{isRoot && isCanonicalFrame ? variant.name : widget.name}</span>
          {isCanonicalFrameRoot && isRoot ? <Star size={12} className="text-amber-300 fill-amber-300" /> : null}
          <span className="text-[10px] text-neutral-400">{isScreenRoot ? (isCanonicalFrameRoot ? "Canonical Frame" : "Draft Frame") : widget.type}</span>
          {isScreenRoot ? (
            <button
              className="p-0.5 hover:bg-neutral-500 rounded text-neutral-300 opacity-0 group-hover:opacity-100"
              title="Duplicate frame"
              aria-label="Duplicate frame"
              onClick={(event) => {
                event.stopPropagation();
                duplicateFrame(sectionId, widget.id);
              }}
            >
              <Copy size={12} />
            </button>
          ) : null}
          {!isRoot && (
            <button
              className={`p-0.5 hover:bg-neutral-500 rounded ${widget.visible === false ? "text-neutral-500" : "text-neutral-300 opacity-0 group-hover:opacity-100"}`}
              title={widget.visible === false ? "Show widget" : "Hide widget"}
              onClick={(event) => {
                event.stopPropagation();
                onVariantAction({ type: "setVariantWidgetVisibility", widgetId: widget.id, visible: widget.visible === false });
              }}
            >
              {widget.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          )}
          {dropInside && <div className="absolute inset-0 border border-highlight-500 rounded pointer-events-none" />}
          {dropAfter && <div className="absolute left-1 right-1 h-0.5 bg-highlight-500 translate-y-2" />}
        </div>
        {hasChildren && expanded ? (
          <div>{widget.children.map((child) => renderWidget(child, variant, root, depth + 1, sectionId, isCanonicalFrame))}</div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-10 flex items-center justify-between px-3 border-b border-neutral-900">
        <span className="text-xs font-semibold text-neutral-300">HIERARCHY</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1 rounded text-neutral-300 hover:bg-neutral-600 hover:text-neutral-100"
            title="Add state"
            aria-label="Add state"
            onClick={addState}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="p-1 rounded text-neutral-300 hover:bg-neutral-600 hover:text-neutral-100"
            title="Duplicate frame"
            aria-label="Duplicate frame"
            onClick={() => duplicateFrame()}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className="p-1 rounded text-neutral-300 hover:bg-neutral-600 hover:text-error-300 disabled:opacity-40"
            title="Delete state"
            aria-label="Delete state"
            disabled={board.variantIds.length <= 1}
            onClick={deleteState}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 group">
        {sectionGroups.map(({ variant, sectionId, frames }) => {
          const section = project.sectionsById[sectionId];
          return section ? (
          <div key={section.id} className="mb-2">
            <div
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-200"
              onDragOver={(event) => {
                if (dragging?.kind !== "widget") return;
                event.preventDefault();
                setDropTarget({ key: section.id, position: "inside" });
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging?.kind === "widget") performWidgetMoveToSection(dragging.widgetId, section.id);
                clearDrag();
              }}
            >
              <div className="w-5 flex items-center justify-center"><FolderOpen size={13} /></div>
              <span className="min-w-0 flex-1 truncate font-medium">{section.name}</span>
              <span className="text-[10px] text-neutral-400">Section</span>
            </div>
            {frames.map(({ root, isCanonicalFrame }) => renderWidget(root, variant, root, 1, sectionId, isCanonicalFrame))}
          </div>
          ) : null;
        })}
      </div>
    </div>
  );
}
