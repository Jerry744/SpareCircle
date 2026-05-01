import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";
import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { StateBoard } from "../../backend/types/stateBoard";
import type { Variant } from "../../backend/types/variant";
import type { VariantAction } from "../../backend/reducer/variantActions";
import { buildWidgetTree } from "../../backend/tree";
import { mapPaletteWidgetToType, type Point } from "../../backend/editorStore";
import { getNextWidgetId } from "../../backend/widgets";
import { ID_PREFIX, makeId } from "../../backend/types/idPrefixes";
import type { Camera, MarqueeState } from "../canvasViewport/types";
import { renderCanvasBackdrop, renderWidgetTree } from "../canvasViewport/render";
import { screenToWorldForCamera } from "../canvasViewport/utils";
import { useCanvasGestures } from "../canvasViewport/useCanvasGestures";
import { useCanvasResize } from "../canvasViewport/useCanvasResize";
import { resolveStateBoardWidgetDropTarget } from "./stateBoardDrop";
import { filterTopLevelWidgetIds, getStateBoardWidgetHit } from "./stateBoardHitTest";
import { computeStateBoardMarqueeSelection } from "./stateBoardMarquee";
import { StateBoardContextMenuContent, type StateBoardContextMenuData } from "./stateBoardContextMenu";
import { makeSectionId } from "../../backend/stateBoard/sectionModel";
import {
  getSelectedVariantIds,
  getSelectedWidgetIds,
  getSelectedWidgetIdsByVariant,
  getSelectedWidgetIdsForVariant,
  normalizeStateBoardSelection,
  type StateBoardSelection,
} from "./stateBoardSelection";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";

interface StateBoardSurfaceProps {
  project: ProjectSnapshotV2;
  board: StateBoard;
  activeVariantId: string;
  selection: StateBoardSelection;
  onSelectionChange(selection: StateBoardSelection): void;
  onSelectVariant(variantId: string): void;
  onVariantAction(action: VariantAction): void;
  onEndContinuousChange?(): void;
}

type DragState =
  | { kind: "screen"; startWorld: Point; starts: Record<string, Point> }
  | { kind: "widget"; variantId: string; startWorld: Point; starts: Record<string, Point> };

export function StateBoardSurface({
  project,
  board,
  activeVariantId,
  selection,
  onSelectionChange,
  onSelectVariant,
  onVariantAction,
  onEndContinuousChange,
}: StateBoardSurfaceProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);
  const [contextMenuData, setContextMenuData] = useState<StateBoardContextMenuData | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const clipboardWidgetIdsRef = useRef<string[]>([]);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const variants = useMemo(
    () => board.variantIds.map((id) => project.variantsById[id]).filter((item): item is Variant => Boolean(item)),
    [board.variantIds, project.variantsById],
  );

  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => screenToWorldForCamera(canvasRef.current, cameraRef.current, screenX, screenY),
    [],
  );

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    if (!event.ctrlKey) {
      setCamera((prev) => ({
        ...prev,
        x: prev.x - event.deltaX / prev.zoom,
        y: prev.y - event.deltaY / prev.zoom,
      }));
      return;
    }

    const anchor = screenToWorld(event.clientX, event.clientY);
    const delta = -event.deltaY * 0.001;
    setCamera((prev) => {
      const newZoom = Math.max(0.1, Math.min(5, prev.zoom * (1 + delta)));
      return {
        x: (anchor.x + prev.x) * prev.zoom / newZoom - anchor.x,
        y: (anchor.y + prev.y) * prev.zoom / newZoom - anchor.y,
        zoom: newZoom,
      };
    });
  }, [screenToWorld]);

  const frameById = useMemo(() => {
    const out: Record<string, { variant: Variant; x: number; y: number; width: number; height: number }> = {};
    for (const variant of variants) {
      const root = project.widgetsById[variant.rootWidgetId];
      if (root) out[variant.id] = { variant, x: root.x, y: root.y, width: root.width, height: root.height };
    }
    return out;
  }, [project.widgetsById, variants]);
  const draftFrameBounds = useMemo(() => {
    const out: { widgetId: string; variant: Variant; x: number; y: number; width: number; height: number }[] = [];
    for (const variant of variants) {
      const sectionId = makeSectionId(variant.id);
      const sectionNode = project.treeNodesById?.[sectionId];
      const draftIds: string[] = sectionNode?.kind === "state_section"
        ? sectionNode.childrenIds.filter((cid) => cid !== variant.rootWidgetId)
        : [];
      for (const draftNodeId of draftIds) {
        const draftRoot = project.widgetsById[draftNodeId];
        if (draftRoot) out.push({ widgetId: draftNodeId, variant, x: draftRoot.x, y: draftRoot.y, width: draftRoot.width, height: draftRoot.height });
      }
    }
    return out;
  }, [project.widgetsById, project.treeNodesById, variants]);
  const rootTreesByVariant = useMemo(() => {
    const out: Record<string, ReturnType<typeof buildWidgetTree>> = {};
    for (const variant of variants) out[variant.id] = buildWidgetTree(project, variant.rootWidgetId);
    return out;
  }, [project, variants]);
  const hitTreesByVariant = useMemo(() => {
    const out: Record<string, ReturnType<typeof buildWidgetTree>[]> = {};
    for (const variant of variants) {
      const sectionId = makeSectionId(variant.id);
      const sectionNode = project.treeNodesById?.[sectionId];
      const draftIds: string[] = sectionNode?.kind === "state_section"
        ? sectionNode.childrenIds.filter((cid) => cid !== variant.rootWidgetId)
        : [];
      out[variant.id] = [
        buildWidgetTree(project, variant.rootWidgetId),
        ...draftIds.map((draftNodeId) => buildWidgetTree(project, draftNodeId)),
      ];
    }
    return out;
  }, [project, variants]);
  const sectionBoundsByVariant = useMemo(() => {
    const out: Record<string, Rect> = {};
    for (const variant of variants) {
      const root = project.widgetsById[variant.rootWidgetId];
      const rootTree = rootTreesByVariant[variant.id];
      let bounds = root && rootTree ? getWidgetTreeBounds(rootTree, root.x, root.y) : null;
      const sectionId = makeSectionId(variant.id);
      const sectionNode = project.treeNodesById?.[sectionId];
      const draftIds: string[] = sectionNode?.kind === "state_section"
        ? sectionNode.childrenIds.filter((cid) => cid !== variant.rootWidgetId)
        : [];
      for (const draftNodeId of draftIds) {
        const draftRoot = project.widgetsById[draftNodeId];
        const draftTree = buildWidgetTree(project, draftNodeId);
        const draftBounds = draftRoot && draftTree ? getWidgetTreeBounds(draftTree, draftRoot.x, draftRoot.y) : null;
        if (draftBounds) bounds = unionRect(bounds, draftBounds);
      }
      if (bounds) out[variant.id] = bounds;
    }
    return out;
  }, [project, rootTreesByVariant, variants]);

  const selectedVariantIds = getSelectedVariantIds(selection);
  const selectedWidgetIds = getSelectedWidgetIds(selection);
  const selectedWidgetIdsByVariant = getSelectedWidgetIdsByVariant(selection);
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    renderCanvasBackdrop(ctx, canvas, camera);
    ctx.save();
    ctx.translate(canvas.width / 2 + camera.x * camera.zoom, canvas.height / 2 + camera.y * camera.zoom);
    ctx.scale(camera.zoom, camera.zoom);
    for (const variant of variants) {
      const root = project.widgetsById[variant.rootWidgetId];
      if (!root) continue;
      renderWidgetTree({
        ctx,
        project,
        rootTree: rootTreesByVariant[variant.id],
        selectedWidgetIds: selectedWidgetIdsByVariant[variant.id] ?? [],
        imageCache: imageCacheRef.current,
        rerender: render,
        offsetX: root.x,
        offsetY: root.y,
      });
      const sectionId = makeSectionId(variant.id);
      const sectionNode = project.treeNodesById?.[sectionId];
      const draftIds: string[] = sectionNode?.kind === "state_section"
        ? sectionNode.childrenIds.filter((cid) => cid !== variant.rootWidgetId)
        : [];
      for (const draftNodeId of draftIds) {
        const draftRoot = project.widgetsById[draftNodeId];
        const draftTree = buildWidgetTree(project, draftNodeId);
        if (!draftRoot || !draftTree) continue;
        renderWidgetTree({
          ctx,
          project,
          rootTree: draftTree,
          selectedWidgetIds: selectedWidgetIdsByVariant[variant.id] ?? [],
          imageCache: imageCacheRef.current,
          rerender: render,
          offsetX: draftRoot.x,
          offsetY: draftRoot.y,
        });
      }
    }
    ctx.restore();
  }, [camera, project, rootTreesByVariant, selectedWidgetIdsByVariant, variants]);

  useCanvasResize(canvasRef, containerRef, render);
  useCanvasGestures(containerRef, canvasRef, setCamera, screenToWorld);
  useEffect(() => {
    render();
  }, [render]);

  const hitTest = (world: Point): { kind: "canonical"; variantId: string } | { kind: "draft"; widgetId: string; variant: Variant } | null => {
    for (let index = variants.length - 1; index >= 0; index -= 1) {
      const frame = frameById[variants[index].id];
      if (frame && world.x >= frame.x && world.x <= frame.x + frame.width && world.y >= frame.y && world.y <= frame.y + frame.height) {
        return { kind: "canonical", variantId: frame.variant.id };
      }
    }
    for (let index = draftFrameBounds.length - 1; index >= 0; index -= 1) {
      const frame = draftFrameBounds[index];
      if (world.x >= frame.x && world.x <= frame.x + frame.width && world.y >= frame.y && world.y <= frame.y + frame.height) {
        return { kind: "draft", widgetId: frame.widgetId, variant: frame.variant };
      }
    }
    return null;
  };

  const updateSelection = (variantId: string, additive: boolean) => {
    onSelectVariant(variantId);
    const rootWidgetId = project.variantsById[variantId]?.rootWidgetId;
    if (!rootWidgetId) return;
    const currentWidgetIds = getSelectedWidgetIdsForVariant(selection, variantId);
    const nextWidgetIds = additive
      ? currentWidgetIds.includes(rootWidgetId)
        ? currentWidgetIds.filter((id) => id !== rootWidgetId)
        : [...currentWidgetIds, rootWidgetId]
      : [rootWidgetId];
    onSelectionChange(
      additive
        ? normalizeStateBoardSelection({
            variantIds: selectedVariantIds,
            widgetIdsByVariant: { ...selectedWidgetIdsByVariant, [variantId]: nextWidgetIds },
          })
        : { kind: "widget", variantId, widgetIds: nextWidgetIds },
    );
  };

  const startDrag = (variantIds: string[], world: Point) => {
    const starts: Record<string, Point> = {};
    for (const id of variantIds) {
      const frame = frameById[id];
      if (frame) starts[id] = { x: frame.x, y: frame.y };
    }
    setDrag({ kind: "screen", startWorld: world, starts });
  };

  const startWidgetDrag = (variantId: string, widgetIds: string[], world: Point) => {
    const starts: Record<string, Point> = {};
    for (const id of widgetIds) {
      const widget = project.widgetsById[id];
      if (widget) starts[id] = { x: widget.x, y: widget.y };
    }
    if (Object.keys(starts).length === 0) return;
    setDrag({ kind: "widget", variantId, startWorld: world, starts });
  };

  const makeDuplicateRootIds = (widgetIds: string[]) => widgetIds.map(() => makeId(ID_PREFIX.variant));

  const copyWidgets = (widgetIds: string[]) => {
    clipboardWidgetIdsRef.current = filterTopLevelWidgetIds(widgetIds, project.widgetsById);
  };

  const pasteWidgets = () => {
    const widgetIds = clipboardWidgetIdsRef.current.filter((widgetId) => Boolean(project.widgetsById[widgetId]));
    const activeVariant = project.variantsById[activeVariantId];
    if (!activeVariant || widgetIds.length === 0) return;
    const rootIds = makeDuplicateRootIds(widgetIds);
    onVariantAction({
      type: "duplicateVariantWidgets",
      variantId: activeVariant.id,
      widgetIds,
      targetParentId: activeVariant.rootWidgetId,
      rootWidgetIds: rootIds,
      offset: { x: 16, y: 16 },
    });
    onSelectionChange({ kind: "widget", variantId: activeVariant.id, widgetIds: rootIds });
  };

  const deleteWidgets = (widgetIds: string[]) => {
    const deletableIds = widgetIds.filter((widgetId) => project.widgetsById[widgetId]?.type !== "Screen");
    if (deletableIds.length === 0) return;
    onVariantAction({ type: "deleteVariantWidgets", widgetIds: deletableIds });
    onSelectionChange({ kind: "widget", variantId: activeVariantId, widgetIds: [] });
  };

  const duplicateWidgets = (widgetIds: string[]) => {
    const roots = filterTopLevelWidgetIds(widgetIds, project.widgetsById);
    if (roots.length === 0) return;
    const variant = project.variantsById[activeVariantId];
    if (!variant) return;
    const rootIds = makeDuplicateRootIds(roots);
    onVariantAction({
      type: "duplicateVariantWidgets",
      variantId: variant.id,
      widgetIds: roots,
      targetParentId: variant.rootWidgetId,
      rootWidgetIds: rootIds,
      offset: { x: 16, y: 16 },
    });
    onSelectionChange({ kind: "widget", variantId: variant.id, widgetIds: rootIds });
  };

  const duplicateWidgetsForDrag = (variantId: string, widgetIds: string[], world: Point) => {
    const roots = filterTopLevelWidgetIds(widgetIds, project.widgetsById);
    if (roots.length === 0) return false;
    const rootIds = makeDuplicateRootIds(roots);
    onVariantAction({
      type: "duplicateVariantWidgets",
      variantId,
      widgetIds: roots,
      rootWidgetIds: rootIds,
      offset: { x: 16, y: 16 },
    });
    const starts: Record<string, Point> = {};
    roots.forEach((sourceId, index) => {
      const widget = project.widgetsById[sourceId];
      const newId = rootIds[index];
      if (widget && newId) starts[newId] = { x: widget.x + 16, y: widget.y + 16 };
    });
    onSelectVariant(variantId);
    onSelectionChange({ kind: "widget", variantId, widgetIds: rootIds });
    setDrag({ kind: "widget", variantId, startWorld: world, starts });
    return true;
  };

  const panBy = (clientX: number, clientY: number) => {
    const dx = clientX - lastMousePos.current.x;
    const dy = clientY - lastMousePos.current.y;
    setCamera((prev) => ({ ...prev, x: prev.x + dx / prev.zoom, y: prev.y + dy / prev.zoom }));
    lastMousePos.current = { x: clientX, y: clientY };
  };

  const finishMarquee = () => {
    if (!marquee) return;
    const hitSelection = computeStateBoardMarqueeSelection({
      variantIds: variants.map((variant) => variant.id),
      frameById,
      rootTreesByVariant: hitTreesByVariant,
      includeScreenRoots: true,
      marquee,
    });
    const nextSelection = marquee.additive
      ? normalizeStateBoardSelection({
          variantIds: [...selectedVariantIds, ...hitSelection.variantIds],
          widgetIdsByVariant: {
            ...selectedWidgetIdsByVariant,
            ...Object.fromEntries(
              Object.entries(hitSelection.widgetIdsByVariant).map(([variantId, widgetIds]) => [
                variantId,
                [...(selectedWidgetIdsByVariant[variantId] ?? []), ...widgetIds],
              ]),
            ),
          },
        })
      : normalizeStateBoardSelection(hitSelection);
    onSelectionChange(nextSelection);
    const nextFocusVariantId = Object.keys(hitSelection.widgetIdsByVariant)[0] ?? hitSelection.variantIds[0];
    if (nextFocusVariantId) onSelectVariant(nextFocusVariantId);
    setMarquee(null);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isSpacePressed || event.button === 1) {
      if (event.button === 1) setIsMiddlePanning(true);
      else setIsPanning(true);
      lastMousePos.current = { x: event.clientX, y: event.clientY };
      if (containerRef.current) containerRef.current.style.cursor = "grabbing";
      return;
    }
    if (event.button !== 0) return;
    const world = screenToWorld(event.clientX, event.clientY);
    const widgetHit = getStateBoardWidgetHit(
      variants.map((variant) => variant.id),
      hitTreesByVariant,
      selectedWidgetIds,
      world,
    );
    const hit = hitTest(world);
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    if (widgetHit) {
      onSelectVariant(widgetHit.variantId);
      const currentWidgetIds = getSelectedWidgetIdsForVariant(selection, widgetHit.variantId);
      const altDuplicate = event.altKey && !additive;

      if (altDuplicate && currentWidgetIds.includes(widgetHit.widget.id)) {
        const dragIds = filterTopLevelWidgetIds(currentWidgetIds, project.widgetsById);
        if (duplicateWidgetsForDrag(widgetHit.variantId, dragIds.length > 0 ? dragIds : [widgetHit.widget.id], world)) return;
      }

      if (!additive && currentWidgetIds.includes(widgetHit.widget.id)) {
        const dragIds = filterTopLevelWidgetIds(currentWidgetIds, project.widgetsById);
        startWidgetDrag(widgetHit.variantId, dragIds.length > 0 ? dragIds : [widgetHit.widget.id], world);
        return;
      }

      const nextWidgetIds = additive
        ? currentWidgetIds.includes(widgetHit.widget.id)
          ? currentWidgetIds.filter((widgetId) => widgetId !== widgetHit.widget.id)
          : [...currentWidgetIds, widgetHit.widget.id]
        : [widgetHit.widget.id];
      onSelectionChange(
        additive
          ? normalizeStateBoardSelection({
              variantIds: selectedVariantIds,
              widgetIdsByVariant: {
                ...selectedWidgetIdsByVariant,
                [widgetHit.variantId]: nextWidgetIds,
              },
            })
          : { kind: "widget", variantId: widgetHit.variantId, widgetIds: nextWidgetIds },
      );
      if (!additive && nextWidgetIds.length > 0) {
        if (altDuplicate && duplicateWidgetsForDrag(widgetHit.variantId, nextWidgetIds, world)) return;
        startWidgetDrag(widgetHit.variantId, filterTopLevelWidgetIds(nextWidgetIds, project.widgetsById), world);
      }
      return;
    }
    if (!hit) {
      setMarquee({ startWorld: world, currentWorld: world, additive });
      if (!additive) onSelectionChange({ kind: "screen", variantIds: [] });
      return;
    }

    if (hit.kind === "draft") {
      onSelectVariant(hit.variant.id);
      const currentWidgetIds = getSelectedWidgetIdsForVariant(selection, hit.variant.id);
      const nextWidgetIds = additive
        ? currentWidgetIds.includes(hit.widgetId)
          ? currentWidgetIds.filter((id) => id !== hit.widgetId)
          : [...currentWidgetIds, hit.widgetId]
        : [hit.widgetId];
      onSelectionChange(
        additive
          ? normalizeStateBoardSelection({
              variantIds: selectedVariantIds,
              widgetIdsByVariant: { ...selectedWidgetIdsByVariant, [hit.variant.id]: nextWidgetIds },
            })
          : { kind: "widget", variantId: hit.variant.id, widgetIds: nextWidgetIds },
      );
      return;
    }

    const hitVariantId = hit.variantId;
    updateSelection(hitVariantId, additive);
    startDrag([hitVariantId], world);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((isPanning && isSpacePressed) || isMiddlePanning) {
      panBy(event.clientX, event.clientY);
      return;
    }
    const world = screenToWorld(event.clientX, event.clientY);
    if (marquee) {
      setMarquee({ ...marquee, currentWorld: world });
      return;
    }
    if (drag?.kind === "screen") {
      const dx = world.x - drag.startWorld.x;
      const dy = world.y - drag.startWorld.y;
      for (const [variantId, start] of Object.entries(drag.starts)) {
        onVariantAction({
          type: "moveVariantScreen",
          variantId,
          position: { x: Math.round(start.x + dx), y: Math.round(start.y + dy) },
          historyMode: "merge",
        });
      }
      return;
    }
    if (drag?.kind === "widget") {
      const dx = world.x - drag.startWorld.x;
      const dy = world.y - drag.startWorld.y;
      const positions: Record<string, Point> = {};
      for (const [widgetId, start] of Object.entries(drag.starts)) {
        positions[widgetId] = {
          x: Math.round(start.x + dx),
          y: Math.round(start.y + dy),
        };
      }
      onVariantAction({
        type: "setVariantWidgetPositions",
        positions,
        historyMode: "merge",
      });
    }
  };

  const handleMouseUp = () => {
    if (isPanning || isMiddlePanning) {
      setIsPanning(false);
      setIsMiddlePanning(false);
      if (containerRef.current) containerRef.current.style.cursor = isSpacePressed ? "grab" : "default";
    }
    if (marquee) finishMarquee();
    setDrag(null);
    onEndContinuousChange?.();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const widgetType = mapPaletteWidgetToType(event.dataTransfer.getData("widget"));
    if (!widgetType) return;

    const world = screenToWorld(event.clientX, event.clientY);
    const dropTarget = resolveStateBoardWidgetDropTarget({
      project,
      board,
      world,
      fallbackVariantId: activeVariantId,
    });
    if (!dropTarget?.variantId) return;

    const widgetId = getNextWidgetId(project, widgetType);
    onVariantAction({
      type: "insertVariantWidget",
      variantId: dropTarget.variantId,
      parentId: dropTarget.parentId,
      widgetType,
      position: { x: dropTarget.localX, y: dropTarget.localY },
      widgetId,
    });
    onSelectVariant(dropTarget.variantId);
    onSelectionChange({ kind: "widget", variantId: dropTarget.variantId, widgetIds: [widgetId] });
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const world = screenToWorld(event.clientX, event.clientY);
    const widgetHit = getStateBoardWidgetHit(
      variants.map((variant) => variant.id),
      hitTreesByVariant,
      selectedWidgetIds,
      world,
    );
    if (widgetHit) {
      const currentWidgetIds = getSelectedWidgetIdsForVariant(selection, widgetHit.variantId);
      const targetWidgetIds = currentWidgetIds.includes(widgetHit.widget.id) ? currentWidgetIds : [widgetHit.widget.id];
      onSelectVariant(widgetHit.variantId);
      if (!currentWidgetIds.includes(widgetHit.widget.id)) {
        onSelectionChange({ kind: "widget", variantId: widgetHit.variantId, widgetIds: [widgetHit.widget.id] });
      }
      setContextMenuData({
        kind: "widget",
        targetVariantId: widgetHit.variantId,
        targetWidgetIds,
      });
      return;
    }

    const frameHit = hitTest(world);
    if (frameHit) {
      if (frameHit.kind === "draft") {
        onSelectVariant(frameHit.variant.id);
        onSelectionChange({ kind: "widget", variantId: frameHit.variant.id, widgetIds: [frameHit.widgetId] });
        setContextMenuData({
          kind: "screen",
          targetVariantId: frameHit.variant.id,
        });
      } else {
        onSelectVariant(frameHit.variantId);
        onSelectionChange({ kind: "widget", variantId: frameHit.variantId, widgetIds: [project.variantsById[frameHit.variantId]?.rootWidgetId ?? ""].filter(Boolean) });
        setContextMenuData({
          kind: "screen",
          targetVariantId: frameHit.variantId,
        });
      }
      return;
    }

    const dropTarget = resolveStateBoardWidgetDropTarget({
      project,
      board,
      world,
      fallbackVariantId: activeVariantId,
    });
    setContextMenuData(dropTarget ? {
      kind: "canvas",
      targetVariantId: dropTarget.variantId,
      dropParentId: dropTarget.parentId,
      dropLocalX: dropTarget.localX,
      dropLocalY: dropTarget.localY,
    } : null);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={containerRef}
          className="relative h-full w-full overflow-hidden bg-neutral-900"
          tabIndex={0}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={handleDrop}
          onKeyDown={(event) => {
            const isModifier = event.metaKey || event.ctrlKey;
            if ((event.key === "Delete" || event.key === "Backspace") && selectedWidgetIds.length > 0) {
              event.preventDefault();
              deleteWidgets(selectedWidgetIds);
              return;
            }
            if (isModifier && event.key.toLowerCase() === "c") {
              event.preventDefault();
              copyWidgets(selectedWidgetIds);
              return;
            }
            if (isModifier && event.key.toLowerCase() === "v") {
              event.preventDefault();
              pasteWidgets();
              return;
            }
            if (isModifier && event.key.toLowerCase() === "d") {
              event.preventDefault();
              duplicateWidgets(selectedWidgetIds);
              return;
            }
            if (event.code === "Space" && !isSpacePressed) {
              event.preventDefault();
              setIsSpacePressed(true);
              if (containerRef.current) containerRef.current.style.cursor = "grab";
            }
          }}
          onKeyUp={(event) => {
            if (event.code === "Space") {
              event.preventDefault();
              setIsSpacePressed(false);
              setIsPanning(false);
              if (containerRef.current) containerRef.current.style.cursor = "default";
            }
          }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 origin-top-left" style={worldTransform(camera)}>
            {variants.map((variant) => {
              const bounds = sectionBoundsByVariant[variant.id];
              if (!bounds) return null;
              const isActive = selectedVariantIds.includes(variant.id) || Boolean(selectedWidgetIdsByVariant[variant.id]?.length);
              return (
                <div
                  key={`${variant.id}-section-bounds`}
                  className={`pointer-events-none absolute rounded border border-dashed ${
                    isActive ? "border-highlight-400/80 bg-highlight-500/5" : "border-neutral-500/40"
                  }`}
                  style={{ left: bounds.x - 12, top: bounds.y - 12, width: bounds.width + 24, height: bounds.height + 24 }}
                />
              );
            })}
            {variants.map((variant) => {
              const frame = frameById[variant.id];
              if (!frame) return null;
              const isSelected = selectedVariantIds.includes(variant.id)
                || getSelectedWidgetIdsForVariant(selection, variant.id).includes(variant.rootWidgetId);
              return (
                <section
                  key={variant.id}
                  className={`pointer-events-none absolute border ${
                    isSelected ? "border-highlight-500 ring-2 ring-highlight-500/40" : "border-neutral-700"
                  }`}
                  style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height, background: "#ffffff" }}
                >
                  <div className="absolute -top-7 left-0 flex items-center gap-2 text-xs text-neutral-200">
                    <span className="font-semibold">{project.widgetsById[variant.rootWidgetId]?.name ?? variant.name}</span>
                    <span className="inline-flex items-center gap-1 rounded bg-highlight-500/20 px-2 py-0.5 text-[11px] text-highlight-200">
                      <Star size={11} /> canonical
                    </span>
                  </div>
                </section>
              );
            })}
            {draftFrameBounds.map((frame) => {
              const isSelected = getSelectedWidgetIdsForVariant(selection, frame.variant.id).includes(frame.widgetId);
              return (
                <section
                  key={frame.widgetId}
                  className={`pointer-events-none absolute border ${
                    isSelected ? "border-highlight-500 ring-2 ring-highlight-500/40" : "border-neutral-700"
                  }`}
                  style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height, background: "#ffffff" }}
                >
                  <div className="absolute -top-7 left-0 flex items-center gap-2 text-xs text-neutral-200">
                    <span className="font-semibold">{project.widgetsById[frame.widgetId]?.name ?? frame.variant.name}</span>
                    <span className="inline-flex items-center gap-1 rounded bg-warning-500/20 px-2 py-0.5 text-[11px] text-warning-200">
                      draft
                    </span>
                  </div>
                </section>
              );
            })}
            {marquee ? <MarqueeRect marquee={marquee} /> : null}
          </div>
        </div>
      </ContextMenuTrigger>
      <StateBoardContextMenuContent
        data={contextMenuData}
        project={project}
        onAddWidget={(parentId, widgetType, x, y) => {
          const variantId = contextMenuData?.targetVariantId ?? activeVariantId;
          const widgetId = getNextWidgetId(project, widgetType);
          onVariantAction({
            type: "insertVariantWidget",
            variantId,
            parentId,
            widgetType,
            position: { x, y },
            widgetId,
          });
          onSelectVariant(variantId);
          onSelectionChange({ kind: "widget", variantId, widgetIds: [widgetId] });
        }}
        onSetWidgetVisible={(widgetIds, visible) => {
          for (const widgetId of widgetIds) {
            onVariantAction({ type: "setVariantWidgetVisibility", widgetId, visible });
          }
        }}
        onMoveWidget={(widgetId, parentId, index) => {
          onVariantAction({ type: "moveVariantWidget", widgetId, targetParentId: parentId, targetIndex: index });
        }}
        onSetCanonical={(variantId) => {
          onVariantAction({ type: "setCanonicalVariant", boardId: board.id, variantId });
        }}
        onCopyWidgets={copyWidgets}
        onPasteWidgets={pasteWidgets}
        onDuplicateWidgets={duplicateWidgets}
        onDeleteWidgets={deleteWidgets}
      />
    </ContextMenu>
  );
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type WidgetTree = NonNullable<ReturnType<typeof buildWidgetTree>>;

function unionRect(a: Rect | null, b: Rect): Rect {
  if (!a) return b;
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function getWidgetTreeBounds(root: WidgetTree, offsetX: number, offsetY: number): Rect | null {
  const walk = (node: WidgetTree, x: number, y: number): Rect => {
    let bounds: Rect = { x, y, width: node.width, height: node.height };
    for (const child of node.children) {
      bounds = unionRect(bounds, walk(child as WidgetTree, x + child.x, y + child.y));
    }
    return bounds;
  };
  return walk(root, offsetX, offsetY);
}

function worldTransform(camera: Camera): React.CSSProperties {
  return {
    transformOrigin: "0 0",
    transform: `translate(calc(50% + ${camera.x * camera.zoom}px), calc(50% + ${camera.y * camera.zoom}px)) scale(${camera.zoom})`,
  };
}

function MarqueeRect({ marquee }: { marquee: MarqueeState }) {
  const left = Math.min(marquee.startWorld.x, marquee.currentWorld.x);
  const top = Math.min(marquee.startWorld.y, marquee.currentWorld.y);
  const width = Math.abs(marquee.currentWorld.x - marquee.startWorld.x);
  const height = Math.abs(marquee.currentWorld.y - marquee.startWorld.y);
  return (
    <div
      className="absolute border border-highlight-400 bg-highlight-500/10"
      style={{ left, top, width, height }}
    />
  );
}
