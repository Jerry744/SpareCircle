import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildWidgetTree,
  flattenWidgetTree,
  getActiveScreenFromProject,
  mapPaletteWidgetToType,
  useEditorBackend,
  type Point,
} from "../backend/editorStore";
import { collectSnapGuides } from "../backend/interaction";
import { CanvasContextMenuContent, type ContextMenuData } from "./CanvasContextMenu";
import { ContextMenu, ContextMenuTrigger } from "./ui/context-menu";
import { CanvasViewportToolbar } from "./canvasViewport/CanvasViewportToolbar";
import { renderCanvas } from "./canvasViewport/render";
import type { Camera, DragState, MarqueeState, SafariGestureEvent } from "./canvasViewport/types";
import {
  filterTopLevelIds,
  getDropContainer,
  getHitTarget,
  screenToWorldForCamera,
} from "./canvasViewport/utils";

export function CanvasViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);
  const [contextMenuData, setContextMenuData] = useState<ContextMenuData | null>(null);
  const cameraRef = useRef(camera);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const zoomAnchorWorld = useRef<Point | null>(null);
  const zoomTimeoutRef = useRef<number | null>(null);
  const lastGestureScaleRef = useRef<number | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const dragStateRef = useRef<DragState | null>(null);
  const snapGuidesRef = useRef<{ xGuides: number[]; yGuides: number[] } | null>(null);
  const isAltDupDragRef = useRef(false);
  cameraRef.current = camera;

  const {
    state: { project, selectedWidgetIds },
    actions: {
      addWidget,
      deleteSelectedWidgets,
      selectWidget,
      clearSelection,
      beginInteraction,
      updateInteraction,
      commitInteraction,
      cancelInteraction,
      setSelection,
      copySelectionToClipboard,
      pasteFromClipboard,
      duplicateWidgets,
      moveWidget,
      batchUpdateWidgetProperty,
    },
  } = useEditorBackend();

  const activeScreen = getActiveScreenFromProject(project);
  const rootTree = buildWidgetTree(project, activeScreen.rootNodeId);

  const screenToWorldRef = useCallback(
    (screenX: number, screenY: number) =>
      screenToWorldForCamera(canvasRef.current, cameraRef.current, screenX, screenY),
    [],
  );

  const render = useCallback(() => {
    renderCanvas({
      canvas: canvasRef.current,
      camera,
      rootTree,
      project,
      selectedWidgetIds,
      marquee,
      dragState: dragStateRef.current,
      snapGuides: snapGuidesRef.current,
      imageCache: imageCacheRef.current,
      rerender: render,
    });
  }, [camera, marquee, project, rootTree, selectedWidgetIds]);

  const finalizeMarquee = useCallback(() => {
    const current = marqueeRef.current;
    if (!current) {
      return;
    }

    marqueeRef.current = null;
    setMarquee(null);

    if (!rootTree) {
      return;
    }

    const allWidgets = flattenWidgetTree(rootTree);
    const dx = current.currentWorld.x - current.startWorld.x;
    const dy = current.currentWorld.y - current.startWorld.y;
    const minX = Math.min(current.startWorld.x, current.currentWorld.x);
    const maxX = Math.max(current.startWorld.x, current.currentWorld.x);
    const minY = Math.min(current.startWorld.y, current.currentWorld.y);
    const maxY = Math.max(current.startWorld.y, current.currentWorld.y);
    const useContains = dx >= 0 && dy >= 0;

    const hitIds: string[] = [];
    for (const item of allWidgets) {
      if (item.widget.type === "Screen" || item.widget.visible === false) {
        continue;
      }

      const wL = item.absX;
      const wR = item.absX + item.widget.width;
      const wT = item.absY;
      const wB = item.absY + item.widget.height;
      if (useContains) {
        if (wL >= minX && wR <= maxX && wT >= minY && wB <= maxY) {
          hitIds.push(item.widget.id);
        }
      } else if (wL < maxX && wR > minX && wT < maxY && wB > minY) {
        hitIds.push(item.widget.id);
      }
    }

    if (hitIds.length > 0) {
      setSelection(current.additive ? [...new Set([...selectedWidgetIds, ...hitIds])] : hitIds);
      return;
    }

    if (!current.additive) {
      clearSelection();
    }
  }, [clearSelection, rootTree, selectedWidgetIds, setSelection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const updateSize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      render();
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(container);

    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [render]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const getAnchorWorldFromGesture = (event: SafariGestureEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return { x: 0, y: 0 };
      }

      const rect = canvas.getBoundingClientRect();
      const clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2;
      const clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2;
      return screenToWorldRef(clientX, clientY);
    };

    const handleNativeWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    const handleGestureStart = (event: Event) => {
      const gesture = event as SafariGestureEvent;
      gesture.preventDefault();
      lastGestureScaleRef.current = gesture.scale;
      zoomAnchorWorld.current = getAnchorWorldFromGesture(gesture);
    };

    const handleGestureChange = (event: Event) => {
      const gesture = event as SafariGestureEvent;
      gesture.preventDefault();

      const previousScale = lastGestureScaleRef.current ?? gesture.scale;
      if (!Number.isFinite(previousScale) || !Number.isFinite(gesture.scale) || previousScale === 0) {
        lastGestureScaleRef.current = gesture.scale;
        return;
      }

      const ratio = gesture.scale / previousScale;
      const anchor = zoomAnchorWorld.current ?? getAnchorWorldFromGesture(gesture);
      setCamera((prev) => {
        const newZoom = Math.max(0.1, Math.min(5, prev.zoom * ratio));
        return {
          x: (anchor.x + prev.x) * prev.zoom / newZoom - anchor.x,
          y: (anchor.y + prev.y) * prev.zoom / newZoom - anchor.y,
          zoom: newZoom,
        };
      });

      lastGestureScaleRef.current = gesture.scale;
    };

    const handleGestureEnd = (event: Event) => {
      const gesture = event as SafariGestureEvent;
      gesture.preventDefault();
      lastGestureScaleRef.current = null;
      zoomAnchorWorld.current = null;
    };

    container.addEventListener("wheel", handleNativeWheel, { passive: false });
    container.addEventListener("gesturestart", handleGestureStart, { passive: false });
    container.addEventListener("gesturechange", handleGestureChange, { passive: false });
    container.addEventListener("gestureend", handleGestureEnd, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleNativeWheel);
      container.removeEventListener("gesturestart", handleGestureStart);
      container.removeEventListener("gesturechange", handleGestureChange);
      container.removeEventListener("gestureend", handleGestureEnd);
    };
  }, [screenToWorldRef]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return Boolean(target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
    };

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
    copySelectionToClipboard,
    deleteSelectedWidgets,
    isSpacePressed,
    pasteFromClipboard,
    selectedWidgetIds,
  ]);

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const widgetType = mapPaletteWidgetToType(event.dataTransfer.getData("widget"));
    if (!widgetType) {
      return;
    }

    const world = screenToWorldRef(event.clientX, event.clientY);
    const parentInfo = getDropContainer(rootTree, world);
    if (!parentInfo) {
      return;
    }

    addWidget(
      parentInfo.widget.id,
      widgetType,
      Math.round(world.x - parentInfo.absX),
      Math.round(world.y - parentInfo.absY),
    );
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    if (dragStateRef.current || marqueeRef.current) {
      return;
    }

    const world = screenToWorldRef(event.clientX, event.clientY);
    const hit = getHitTarget(rootTree, selectedWidgetIds, world);
    const dropContainer = getDropContainer(rootTree, world);
    setContextMenuData({
      targetId: hit?.widget.id ?? null,
      dropParentId: dropContainer?.widget.id ?? activeScreen.rootNodeId,
      dropLocalX: Math.round(world.x - (dropContainer?.absX ?? 0)),
      dropLocalY: Math.round(world.y - (dropContainer?.absY ?? 0)),
    });
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement !== event.target) {
      if (activeElement.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) {
        activeElement.blur();
      }
    }

    if (isSpacePressed) {
      setIsPanning(true);
      lastMousePos.current = { x: event.clientX, y: event.clientY };
      if (containerRef.current) {
        containerRef.current.style.cursor = "grabbing";
      }
      return;
    }

    if (event.button === 1) {
      setIsMiddlePanning(true);
      lastMousePos.current = { x: event.clientX, y: event.clientY };
      if (containerRef.current) {
        containerRef.current.style.cursor = "grabbing";
      }
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const world = screenToWorldRef(event.clientX, event.clientY);
    const target = getHitTarget(rootTree, selectedWidgetIds, world);
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    const isAltDrag = event.altKey && !additive;

    if (!target) {
      const nextMarquee: MarqueeState = { startWorld: world, currentWorld: world, additive };
      marqueeRef.current = nextMarquee;
      setMarquee(nextMarquee);
      if (!additive) {
        clearSelection();
      }
      return;
    }

    if (!additive && selectedWidgetIds.includes(target.widget.id) && selectedWidgetIds.length > 1) {
      if (target.mode === "resize") {
        dragStateRef.current = { kind: "resize", pointerStart: world, widgetIds: [target.widget.id], handle: "se" };
        beginInteraction("resize", [target.widget.id], world, "se");
        return;
      }

      const dragIds = filterTopLevelIds(selectedWidgetIds, project);
      if (isAltDrag) {
        const newIds = duplicateWidgets(dragIds);
        const actualIds = newIds.length > 0 ? newIds : dragIds;
        isAltDupDragRef.current = true;
        dragStateRef.current = { kind: "move", pointerStart: world, widgetIds: actualIds };
        beginInteraction("move", actualIds, world);
        return;
      }

      dragStateRef.current = { kind: "move", pointerStart: world, widgetIds: dragIds };
      beginInteraction("move", dragIds, world);
      return;
    }

    const nextSelection = additive
      ? selectedWidgetIds.includes(target.widget.id)
        ? selectedWidgetIds.filter((widgetId) => widgetId !== target.widget.id)
        : [...selectedWidgetIds, target.widget.id]
      : [target.widget.id];

    selectWidget(target.widget.id, additive);

    if (nextSelection.length === 0) {
      clearSelection();
      return;
    }

    if (target.mode === "resize") {
      dragStateRef.current = { kind: "resize", pointerStart: world, widgetIds: nextSelection.slice(0, 1), handle: "se" };
      beginInteraction("resize", nextSelection.slice(0, 1), world, "se");
      return;
    }

    const moveDragIds = filterTopLevelIds(nextSelection, project);
    if (isAltDrag) {
      const newIds = duplicateWidgets(moveDragIds);
      const actualIds = newIds.length > 0 ? newIds : moveDragIds;
      isAltDupDragRef.current = true;
      dragStateRef.current = { kind: "move", pointerStart: world, widgetIds: actualIds };
      beginInteraction("move", actualIds, world);
      return;
    }

    dragStateRef.current = { kind: "move", pointerStart: world, widgetIds: moveDragIds };
    beginInteraction("move", moveDragIds, world);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (isPanning && isSpacePressed) {
      const dx = event.clientX - lastMousePos.current.x;
      const dy = event.clientY - lastMousePos.current.y;
      setCamera((prev) => ({ ...prev, x: prev.x + dx / prev.zoom, y: prev.y + dy / prev.zoom }));
      lastMousePos.current = { x: event.clientX, y: event.clientY };
      return;
    }

    if (isMiddlePanning) {
      const dx = event.clientX - lastMousePos.current.x;
      const dy = event.clientY - lastMousePos.current.y;
      setCamera((prev) => ({ ...prev, x: prev.x + dx / prev.zoom, y: prev.y + dy / prev.zoom }));
      lastMousePos.current = { x: event.clientX, y: event.clientY };
      return;
    }

    if (marqueeRef.current) {
      const updated = { ...marqueeRef.current, currentWorld: screenToWorldRef(event.clientX, event.clientY) };
      marqueeRef.current = updated;
      setMarquee(updated);
      return;
    }

    if (dragStateRef.current) {
      const world = screenToWorldRef(event.clientX, event.clientY);
      snapGuidesRef.current = project.canvasSnap?.magnetSnapEnabled
        ? collectSnapGuides(project, new Set(dragStateRef.current.widgetIds), activeScreen.meta)
        : null;
      updateInteraction(world);
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      if (containerRef.current && isSpacePressed) {
        containerRef.current.style.cursor = "grab";
      }
    } else if (isMiddlePanning) {
      setIsMiddlePanning(false);
      if (containerRef.current) {
        containerRef.current.style.cursor = "default";
      }
    }

    if (marqueeRef.current) {
      finalizeMarquee();
      return;
    }

    if (dragStateRef.current) {
      commitInteraction(isAltDupDragRef.current);
      dragStateRef.current = null;
      snapGuidesRef.current = null;
      isAltDupDragRef.current = false;
    }
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();

    if (!event.ctrlKey) {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
      zoomAnchorWorld.current = null;
      setCamera((prev) => ({
        ...prev,
        x: prev.x - event.deltaX / prev.zoom,
        y: prev.y - event.deltaY / prev.zoom,
      }));
      return;
    }

    if (!zoomAnchorWorld.current) {
      zoomAnchorWorld.current = screenToWorldRef(event.clientX, event.clientY);
    }
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }
    zoomTimeoutRef.current = window.setTimeout(() => {
      zoomAnchorWorld.current = null;
    }, 150);

    const anchor = zoomAnchorWorld.current;
    const delta = -event.deltaY * 0.001;
    setCamera((prev) => {
      const newZoom = Math.max(0.1, Math.min(5, prev.zoom * (1 + delta)));
      return {
        x: (anchor.x + prev.x) * prev.zoom / newZoom - anchor.x,
        y: (anchor.y + prev.y) * prev.zoom / newZoom - anchor.y,
        zoom: newZoom,
      };
    });
  };

  return (
    <div className="h-full bg-neutral-900 flex flex-col">
      <CanvasViewportToolbar
        camera={camera}
        screenSize={activeScreen.meta}
        onZoomIn={() => setCamera((prev) => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.2) }))}
        onZoomOut={() => setCamera((prev) => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.2) }))}
        onResetView={() => setCamera({ x: 0, y: 0, zoom: 1 })}
      />

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden relative"
            onContextMenu={handleContextMenu}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              onDoubleClick={(event) => {
                const target = getHitTarget(rootTree, selectedWidgetIds, screenToWorldRef(event.clientX, event.clientY));
                if (target) {
                  selectWidget(target.widget.id, false);
                }
              }}
            />
          </div>
        </ContextMenuTrigger>
        <CanvasContextMenuContent
          data={contextMenuData}
          project={project}
          selectedWidgetIds={selectedWidgetIds}
          onAddWidget={addWidget}
          onDelete={deleteSelectedWidgets}
          onCopy={copySelectionToClipboard}
          onUpdateVisible={(ids, visible) => batchUpdateWidgetProperty(ids, "visible", visible)}
          onMoveWidget={moveWidget}
        />
      </ContextMenu>
    </div>
  );
}
