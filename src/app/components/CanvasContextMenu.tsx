"use client";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "./ui/context-menu";
import type { ProjectSnapshot, WidgetType } from "../backend/types";

export interface ContextMenuData {
  targetId: string | null;
  dropParentId: string;
  dropLocalX: number;
  dropLocalY: number;
}

interface Props {
  data: ContextMenuData | null;
  project: ProjectSnapshot;
  selectedWidgetIds: string[];
  onAddWidget: (parentId: string, type: WidgetType, x: number, y: number) => void;
  onDelete: () => void;
  onCopy: () => void;
  onUpdateVisible: (widgetIds: string[], visible: boolean) => void;
  onMoveWidget: (widgetId: string, parentId: string, index: number) => void;
}

export function CanvasContextMenuContent({
  data,
  project,
  selectedWidgetIds,
  onAddWidget,
  onDelete,
  onCopy,
  onUpdateVisible,
  onMoveWidget,
}: Props) {
  const menuClassName = "min-w-52 rounded-lg border border-neutral-600 bg-neutral-800 p-1.5 text-neutral-100 shadow-2xl";
  const itemClassName = "rounded-md text-sm text-neutral-200 focus:bg-highlight-900 focus:text-neutral-100 data-[disabled]:text-neutral-500";
  const labelClassName = "px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400";
  const separatorClassName = "mx-1 my-1 bg-neutral-600";

  if (!data) {
    return <ContextMenuContent className={menuClassName} />;
  }

  const { targetId, dropParentId, dropLocalX, dropLocalY } = data;
  const isWidgetMenu = targetId !== null && selectedWidgetIds.includes(targetId);

  if (!isWidgetMenu) {
    return (
      <ContextMenuContent className={menuClassName}>
        <ContextMenuLabel className={labelClassName}>Insert</ContextMenuLabel>
        <ContextMenuSeparator className={separatorClassName} />
        <ContextMenuItem className={itemClassName} onSelect={() => onAddWidget(dropParentId, "Button", dropLocalX, dropLocalY)}>
          New Button
        </ContextMenuItem>
        <ContextMenuItem className={itemClassName} onSelect={() => onAddWidget(dropParentId, "Label", dropLocalX, dropLocalY)}>
          New Label
        </ContextMenuItem>
        <ContextMenuItem className={itemClassName} onSelect={() => onAddWidget(dropParentId, "Container", dropLocalX, dropLocalY)}>
          New Container
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  const selectedWidgets = selectedWidgetIds
    .map((id) => project.widgetsById[id])
    .filter(Boolean);

  const canDelete = !selectedWidgetIds.every((id) =>
    project.screens.some((s) => s.rootNodeId === id),
  );

  const visValues = selectedWidgets.map((w) => w.visible !== false);
  const allVisible = visValues.every(Boolean);
  const allHidden = visValues.every((v) => !v);
  const mixedVis = !allVisible && !allHidden;
  const visLabel = mixedVis ? "Visibility (Mixed)" : allVisible ? "Hide" : "Show";

  const singleId = selectedWidgetIds.length === 1 ? selectedWidgetIds[0] : null;
  const singleWidget = singleId ? project.widgetsById[singleId] : null;
  const singleParentId = singleWidget?.parentId ?? null;
  const siblings = singleParentId ? (project.widgetsById[singleParentId]?.childrenIds ?? []) : [];
  const siblingIndex = singleId ? siblings.indexOf(singleId) : -1;
  const isAtFront = siblingIndex === siblings.length - 1;
  const isAtBack = siblingIndex === 0;

  return (
    <ContextMenuContent className={menuClassName}>
      <ContextMenuItem className={itemClassName} onSelect={onCopy}>Copy</ContextMenuItem>
      <ContextMenuItem className="rounded-md text-error-100 focus:bg-error-900 focus:text-error-100 data-[disabled]:text-neutral-500" variant="destructive" disabled={!canDelete} onSelect={onDelete}>
        Delete
      </ContextMenuItem>
      <ContextMenuSeparator className={separatorClassName} />
      <ContextMenuItem
        className={itemClassName}
        disabled={mixedVis}
        onSelect={() => {
          if (!mixedVis) onUpdateVisible(selectedWidgetIds, !allVisible);
        }}
      >
        {visLabel}
      </ContextMenuItem>
      <ContextMenuSeparator className={separatorClassName} />
      <ContextMenuItem
        className={itemClassName}
        disabled={!singleId || isAtFront}
        onSelect={() => {
          if (singleId && singleParentId) onMoveWidget(singleId, singleParentId, siblings.length);
        }}
      >
        Bring to Front
      </ContextMenuItem>
      <ContextMenuItem
        className={itemClassName}
        disabled={!singleId || isAtBack}
        onSelect={() => {
          if (singleId && singleParentId) onMoveWidget(singleId, singleParentId, 0);
        }}
      >
        Send to Back
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
