import { ChevronRight, ChevronDown, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import {
  buildWidgetTree,
  canContainChildren,
  getActiveScreenFromProject,
  useEditorBackend,
  type WidgetTreeNode,
} from "../backend/editorStore";

type DropPosition = "before" | "inside" | "after";

type WidgetLocation = {
  parentId: string | null;
  index: number;
  widget: WidgetTreeNode;
};

function findWidgetLocation(widget: WidgetTreeNode, widgetId: string, parentId: string | null = null): WidgetLocation | null {
  if (widget.id === widgetId) {
    return { parentId, index: 0, widget };
  }

  for (let index = 0; index < widget.children.length; index += 1) {
    const child = widget.children[index];
    if (child.id === widgetId) {
      return { parentId: widget.id, index, widget: child };
    }

    const nested = findWidgetLocation(child, widgetId, child.id);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function resolveDropPosition(widget: WidgetTreeNode, event: React.DragEvent<HTMLDivElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  const relativeY = (event.clientY - rect.top) / rect.height;

  if (canContainChildren(widget.type) && relativeY >= 0.25 && relativeY <= 0.75) {
    return "inside";
  }

  return relativeY < 0.5 ? "before" : "after";
}

export function HierarchyPanel() {
  const {
    state: {
      project,
      selectedWidgetIds,
    },
    actions: { selectWidget, moveWidget },
  } = useEditorBackend();
  const activeScreen = getActiveScreenFromProject(project);
  const rootTree = buildWidgetTree(project, activeScreen.rootNodeId);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    [activeScreen.rootNodeId]: true,
    Container1: true,
  });
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ widgetId: string; position: DropPosition } | null>(null);

  const clearDragPreview = () => {
    setDraggingWidgetId(null);
    setDropTarget(null);
  };

  const performMove = (widgetId: string, targetWidgetId: string, position: DropPosition) => {
    if (!rootTree) {
      return;
    }
    const root = rootTree;

    if (widgetId === targetWidgetId) {
      return;
    }

    if (position === "inside") {
      const targetWidget = findWidgetLocation(root, targetWidgetId)?.widget;
      if (!targetWidget || !canContainChildren(targetWidget.type)) {
        return;
      }

      moveWidget(widgetId, targetWidget.id, targetWidget.children.length);
      return;
    }

    const targetLocation = findWidgetLocation(root, targetWidgetId);
    if (!targetLocation?.parentId) {
      return;
    }

    const indexOffset = position === "after" ? 1 : 0;
    moveWidget(widgetId, targetLocation.parentId, targetLocation.index + indexOffset);
  };

  const renderItem = (widget: WidgetTreeNode, depth: number = 0) => {
    const hasChildren = widget.children.length > 0;
    const isSelected = selectedWidgetIds.includes(widget.id);
    const expanded = depth === 0 ? true : expandedIds[widget.id] ?? true;
    const isDropTarget = dropTarget?.widgetId === widget.id;
    const dropBefore = isDropTarget && dropTarget?.position === "before";
    const dropInside = isDropTarget && dropTarget?.position === "inside";
    const dropAfter = isDropTarget && dropTarget?.position === "after";
    const isDragging = draggingWidgetId === widget.id;

    return (
      <div key={widget.id}>
        <div
          className={`relative flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-colors border border-transparent ${
            isSelected ? "bg-[#3c4a5d] text-white" : "hover:bg-[#3c3c3c] text-gray-300"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(event) => selectWidget(widget.id, event.metaKey || event.ctrlKey || event.shiftKey)}
          draggable={widget.type !== "Screen"}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("hierarchy-widget-id", widget.id);
            setDraggingWidgetId(widget.id);
          }}
          onDragOver={(event) => {
            const sourceWidgetId = event.dataTransfer.getData("hierarchy-widget-id") || draggingWidgetId;
            if (!sourceWidgetId || sourceWidgetId === widget.id) {
              return;
            }

            event.preventDefault();
            const position = resolveDropPosition(widget, event);
            setDropTarget({ widgetId: widget.id, position });
          }}
          onDrop={(event) => {
            const sourceWidgetId = event.dataTransfer.getData("hierarchy-widget-id") || draggingWidgetId;
            if (!sourceWidgetId) {
              clearDragPreview();
              return;
            }

            event.preventDefault();
            const position = dropTarget?.widgetId === widget.id
              ? dropTarget.position
              : resolveDropPosition(widget, event);

            performMove(sourceWidgetId, widget.id, position);
            clearDragPreview();
          }}
          onDragEnd={clearDragPreview}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }
            if (dropTarget?.widgetId === widget.id) {
              setDropTarget(null);
            }
          }}
        >
          {dropBefore && <div className="absolute left-1 right-1 h-0.5 bg-[#5b9dd9] -translate-y-2" />}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedIds((prev) => ({ ...prev, [widget.id]: !(prev[widget.id] ?? true) }));
              }}
              className="p-0.5 hover:bg-[#4c4c4c] rounded text-gray-400"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <div className="w-5" />
          )}
          <span className="text-xs flex-1">{widget.name}</span>
          <span className="text-[10px] text-gray-500">{widget.type}</span>
          <button className="p-0.5 hover:bg-[#4c4c4c] rounded opacity-0 group-hover:opacity-100 text-gray-400">
            {widget.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          {dropInside && <div className="absolute inset-0 border border-[#5b9dd9] rounded pointer-events-none" />}
          {dropAfter && <div className="absolute left-1 right-1 h-0.5 bg-[#5b9dd9] translate-y-2" />}
          {isDragging && <div className="absolute inset-0 bg-[#5b9dd9]/10 rounded pointer-events-none" />}
        </div>
        {hasChildren && expanded && (
          <div>{widget.children.map((child) => renderItem(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-10 flex items-center justify-between px-3 border-b border-[#1e1e1e]">
        <span className="text-xs font-semibold text-gray-400">HIERARCHY</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 group">
        {rootTree ? renderItem(rootTree) : null}
      </div>
    </div>
  );
}