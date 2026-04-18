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
  if (!data) {
    return <ContextMenuContent />;
  }

  const { targetId, dropParentId, dropLocalX, dropLocalY } = data;
  const isWidgetMenu = targetId !== null && selectedWidgetIds.includes(targetId);

  if (!isWidgetMenu) {
    return (
      <ContextMenuContent>
        <ContextMenuLabel>Insert</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onAddWidget(dropParentId, "Button", dropLocalX, dropLocalY)}>
          New Button
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onAddWidget(dropParentId, "Label", dropLocalX, dropLocalY)}>
          New Label
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onAddWidget(dropParentId, "Container", dropLocalX, dropLocalY)}>
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
    <ContextMenuContent>
      <ContextMenuItem onSelect={onCopy}>Copy</ContextMenuItem>
      <ContextMenuItem variant="destructive" disabled={!canDelete} onSelect={onDelete}>
        Delete
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={mixedVis}
        onSelect={() => {
          if (!mixedVis) onUpdateVisible(selectedWidgetIds, !allVisible);
        }}
      >
        {visLabel}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={!singleId || isAtFront}
        onSelect={() => {
          if (singleId && singleParentId) onMoveWidget(singleId, singleParentId, siblings.length);
        }}
      >
        Bring to Front
      </ContextMenuItem>
      <ContextMenuItem
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
