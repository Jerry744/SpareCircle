import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "../ui/context-menu";
import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { WidgetType } from "../../backend/types/widget";
import { makeSectionId } from "../../backend/stateBoard/sectionModel";

export interface StateBoardContextMenuData {
  kind: "canvas" | "screen" | "widget";
  targetVariantId?: string;
  targetWidgetIds?: string[];
  dropParentId?: string;
  dropLocalX?: number;
  dropLocalY?: number;
}

interface StateBoardContextMenuContentProps {
  data: StateBoardContextMenuData | null;
  project: ProjectSnapshotV2;
  onAddWidget(parentId: string, type: WidgetType, x: number, y: number): void;
  onSetWidgetVisible(widgetIds: string[], visible: boolean): void;
  onMoveWidget(widgetId: string, parentId: string, index: number): void;
  onSetCanonical(variantId: string): void;
  onCopyWidgets(widgetIds: string[]): void;
  onPasteWidgets(): void;
  onDuplicateWidgets(widgetIds: string[]): void;
  onDeleteWidgets(widgetIds: string[]): void;
}

export function StateBoardContextMenuContent({
  data,
  project,
  onAddWidget,
  onSetWidgetVisible,
  onMoveWidget,
  onSetCanonical,
  onCopyWidgets,
  onPasteWidgets,
  onDuplicateWidgets,
  onDeleteWidgets,
}: StateBoardContextMenuContentProps): JSX.Element {
  const menuClassName = "min-w-52 rounded-lg border border-neutral-600 bg-neutral-800 p-1.5 text-neutral-100 shadow-2xl";
  const itemClassName = "rounded-md text-sm text-neutral-200 focus:bg-highlight-900 focus:text-neutral-100 data-[disabled]:text-neutral-500";
  const labelClassName = "px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400";
  const separatorClassName = "mx-1 my-1 bg-neutral-600";

  if (!data) return <ContextMenuContent className={menuClassName} />;

  if (data.kind === "canvas" && data.dropParentId !== undefined && data.dropLocalX !== undefined && data.dropLocalY !== undefined) {
    return (
      <ContextMenuContent className={menuClassName}>
        <ContextMenuLabel className={labelClassName}>Insert</ContextMenuLabel>
        <ContextMenuSeparator className={separatorClassName} />
        <ContextMenuItem className={itemClassName} onSelect={() => onAddWidget(data.dropParentId!, "Button", data.dropLocalX!, data.dropLocalY!)}>
          New Button
        </ContextMenuItem>
        <ContextMenuItem className={itemClassName} onSelect={() => onAddWidget(data.dropParentId!, "Label", data.dropLocalX!, data.dropLocalY!)}>
          New Label
        </ContextMenuItem>
        <ContextMenuItem className={itemClassName} onSelect={() => onAddWidget(data.dropParentId!, "Container", data.dropLocalX!, data.dropLocalY!)}>
          New Container
        </ContextMenuItem>
        <ContextMenuSeparator className={separatorClassName} />
        <ContextMenuItem className={itemClassName} onSelect={onPasteWidgets}>
          Paste
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  if (data.kind === "screen" && data.targetVariantId) {
    const variant = project.variantsById[data.targetVariantId];
    const board = variant ? project.stateBoardsById[variant.boardId] : null;
    const isCanonical = board?.canonicalVariantId === data.targetVariantId;
    return (
      <ContextMenuContent className={menuClassName}>
        <ContextMenuItem
          className={itemClassName}
          disabled={isCanonical}
          onSelect={() => onSetCanonical(data.targetVariantId!)}
        >
          Set as Canonical
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  const widgetIds = data.targetWidgetIds ?? [];
  const widgets = widgetIds.map((widgetId) => project.widgetsById[widgetId]).filter(Boolean);
  const visValues = widgets.map((widget) => widget.visible !== false);
  const allVisible = visValues.every(Boolean);
  const allHidden = visValues.every((value) => !value);
  const mixedVis = !allVisible && !allHidden;
  const visibilityLabel = mixedVis ? "Visibility (Mixed)" : allVisible ? "Hide" : "Show";

  const singleWidget = widgetIds.length === 1 ? project.widgetsById[widgetIds[0]] : null;
  const parentId = singleWidget?.parentId ?? null;
  const siblings = parentId ? (project.widgetsById[parentId]?.childrenIds ?? []) : [];
  const index = singleWidget ? siblings.indexOf(singleWidget.id) : -1;
  const isScreenFrame = singleWidget?.type === "Screen";
  const frameVariantId = isScreenFrame && data.targetVariantId ? data.targetVariantId : null;
  const frameBoard = frameVariantId ? project.stateBoardsById[project.variantsById[frameVariantId]?.boardId ?? ""] : null;
  const frameIsCanonical = frameBoard?.canonicalVariantId === frameVariantId;
  const sectionId = makeSectionId(frameVariantId ?? "");
  const sectionNode = frameVariantId ? project.treeNodesById?.[sectionId] : undefined;
  const isDraftFrame = sectionNode?.kind === "state_section" && sectionNode.childrenIds.includes(singleWidget?.id ?? "") &&
    singleWidget?.id !== project.variantsById[frameVariantId ?? ""]?.rootWidgetId;

  return (
    <ContextMenuContent className={menuClassName}>
      {isScreenFrame ? (
        <>
          <ContextMenuItem
            className={itemClassName}
            disabled={frameIsCanonical}
            onSelect={() => { if (frameVariantId) onSetCanonical(frameVariantId); }}
          >
            Set as Canonical
          </ContextMenuItem>
          <ContextMenuSeparator className={separatorClassName} />
        </>
      ) : null}
      {isScreenFrame && isDraftFrame ? (
        <>
          <ContextMenuSeparator className={separatorClassName} />
        </>
      ) : null}
      <ContextMenuItem
        className={itemClassName}
        disabled={mixedVis}
        onSelect={() => {
          if (!mixedVis) onSetWidgetVisible(widgetIds, !allVisible);
        }}
      >
        {visibilityLabel}
      </ContextMenuItem>
      <ContextMenuItem
        className={itemClassName}
        disabled={widgetIds.length === 0}
        onSelect={() => onDuplicateWidgets(widgetIds)}
      >
        Duplicate
      </ContextMenuItem>
      <ContextMenuItem
        className={itemClassName}
        disabled={widgetIds.length === 0}
        onSelect={() => onCopyWidgets(widgetIds)}
      >
        Copy
      </ContextMenuItem>
      <ContextMenuItem
        className={itemClassName}
        onSelect={onPasteWidgets}
      >
        Paste
      </ContextMenuItem>
      <ContextMenuItem
        className={itemClassName}
        disabled={widgetIds.length === 0}
        onSelect={() => onDeleteWidgets(widgetIds)}
      >
        Delete
      </ContextMenuItem>
      <ContextMenuSeparator className={separatorClassName} />
      <ContextMenuItem
        className={itemClassName}
        disabled={!singleWidget || !parentId || index === siblings.length - 1}
        onSelect={() => {
          if (singleWidget && parentId) onMoveWidget(singleWidget.id, parentId, siblings.length);
        }}
      >
        Bring to Front
      </ContextMenuItem>
      <ContextMenuItem
        className={itemClassName}
        disabled={!singleWidget || !parentId || index <= 0}
        onSelect={() => {
          if (singleWidget && parentId) onMoveWidget(singleWidget.id, parentId, 0);
        }}
      >
        Send to Back
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
