// NavMapContextMenu — right-click menu wrapping the Navigation Map canvas.
// See `dev-plan/interaction-design-framework/02-navigation-map.md` §2.

import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../ui/context-menu";
import type { NavMapSelection } from "../../../backend/types/navMapSelection";

export interface NavMapContextMenuProps {
  children: ReactNode;
  selection: NavMapSelection;
  onEnterBoard?(stateNodeId: string): void;
  onMarkInitial?(stateNodeId: string): void;
  onAddToGroup?(stateNodeId: string): void;
  onDelete?(): void;
}

const CONTENT_CLASS =
  "min-w-52 rounded-lg border border-neutral-600 bg-neutral-800 p-1.5 text-neutral-100 shadow-2xl";
const ITEM_CLASS =
  "rounded-md text-sm text-neutral-200 focus:bg-highlight-900 focus:text-neutral-100 data-[disabled]:text-neutral-500";
const DESTRUCTIVE_CLASS =
  "rounded-md text-error-100 focus:bg-error-900 focus:text-error-100 data-[disabled]:text-neutral-500";
const SEPARATOR_CLASS = "mx-1 my-1 bg-neutral-600";

/**
 * NavMapContextMenu — wraps the map region with a Radix-backed right-click
 * menu. Items auto-disable when the current selection does not support them.
 */
export function NavMapContextMenu({
  children,
  selection,
  onEnterBoard,
  onMarkInitial,
  onAddToGroup,
  onDelete,
}: NavMapContextMenuProps) {
  const singleNodeId =
    selection.kind === "node" && selection.nodeIds.length === 1
      ? selection.nodeIds[0]
      : null;
  const canDelete =
    selection.nodeIds.length > 0 || selection.transitionIds.length > 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className={CONTENT_CLASS}>
        <ContextMenuItem
          className={ITEM_CLASS}
          disabled={!singleNodeId || !onEnterBoard}
          onSelect={() => {
            if (singleNodeId && onEnterBoard) onEnterBoard(singleNodeId);
          }}
        >
          Enter board
        </ContextMenuItem>
        <ContextMenuItem
          className={ITEM_CLASS}
          disabled={!singleNodeId || !onMarkInitial}
          onSelect={() => {
            if (singleNodeId && onMarkInitial) onMarkInitial(singleNodeId);
          }}
        >
          Mark as initial
        </ContextMenuItem>
        <ContextMenuItem
          className={ITEM_CLASS}
          disabled={!singleNodeId || !onAddToGroup}
          onSelect={() => {
            if (singleNodeId && onAddToGroup) onAddToGroup(singleNodeId);
          }}
        >
          Add to screen group…
        </ContextMenuItem>
        <ContextMenuSeparator className={SEPARATOR_CLASS} />
        <ContextMenuItem
          className={DESTRUCTIVE_CLASS}
          variant="destructive"
          disabled={!canDelete || !onDelete}
          onSelect={() => {
            if (onDelete) onDelete();
          }}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
