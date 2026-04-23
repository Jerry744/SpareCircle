import { useEffect, type RefObject, type MutableRefObject, type Dispatch, type SetStateAction } from "react";
import type { DragState } from "./types";

interface Params {
  containerRef: RefObject<HTMLDivElement | null>;
  dragStateRef: MutableRefObject<DragState | null>;
  isSpacePressed: boolean;
  setIsSpacePressed: Dispatch<SetStateAction<boolean>>;
  setIsPanning: Dispatch<SetStateAction<boolean>>;
  selectedWidgetIds: string[];
  deleteSelectedWidgets: () => void;
  copySelectionToClipboard: () => void;
  pasteFromClipboard: () => void;
  cancelInteraction: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
}

/**
 * Global keyboard shortcuts for the canvas:
 * Delete/Backspace, Cmd/Ctrl+C/V, Space (pan mode), Escape (cancel drag).
 *
 * Listens on window so shortcuts work regardless of focus, but bails when the
 * event originates from an editable element.
 */
export function useCanvasKeyboardShortcuts({
  containerRef,
  dragStateRef,
  isSpacePressed,
  setIsSpacePressed,
  setIsPanning,
  selectedWidgetIds,
  deleteSelectedWidgets,
  copySelectionToClipboard,
  pasteFromClipboard,
  cancelInteraction,
}: Params): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedWidgetIds.length === 0) {
          return;
        }
        event.preventDefault();
        deleteSelectedWidgets();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectionToClipboard();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteFromClipboard();
        return;
      }

      if (event.code === "Space" && !isSpacePressed) {
        event.preventDefault();
        setIsSpacePressed(true);
        if (containerRef.current) {
          containerRef.current.style.cursor = "grab";
        }
        return;
      }

      if (event.code === "Escape" && dragStateRef.current) {
        cancelInteraction();
        dragStateRef.current = null;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" && isSpacePressed) {
        event.preventDefault();
        setIsSpacePressed(false);
        setIsPanning(false);
        if (containerRef.current) {
          containerRef.current.style.cursor = "default";
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    cancelInteraction,
    containerRef,
    copySelectionToClipboard,
    deleteSelectedWidgets,
    dragStateRef,
    isSpacePressed,
    pasteFromClipboard,
    selectedWidgetIds,
    setIsPanning,
    setIsSpacePressed,
  ]);
}
