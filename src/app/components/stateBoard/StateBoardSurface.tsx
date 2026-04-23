import { useCallback, useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";
import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { StateBoard } from "../../backend/types/stateBoard";
import type { Variant } from "../../backend/types/variant";
import type { VariantAction } from "../../backend/reducer/variantActions";
import { mapPaletteWidgetToType, type Point } from "../../backend/editorStore";
import { getNextWidgetId } from "../../backend/widgets";
import type { Camera, MarqueeState } from "../canvasViewport/types";
import { screenToWorldForCamera } from "../canvasViewport/utils";
import { useCanvasGestures } from "../canvasViewport/useCanvasGestures";
import { useCanvasResize } from "../canvasViewport/useCanvasResize";
import type { StateBoardSelection } from "./StateBoardShell";
import { resolveStateBoardWidgetDropTarget } from "./stateBoardDrop";

interface StateBoardSurfaceProps {
  project: ProjectSnapshotV2;
  board: StateBoard;
  activeVariantId: string;
  selection: StateBoardSelection;
  onSelectionChange(selection: StateBoardSelection): void;
  onSelectVariant(variantId: string): void;
  onVariantAction(action: VariantAction): void;
}

interface DragState {
  startWorld: Point;
  starts: Record<string, Point>;
}

export function StateBoardSurface({
  project,
  board,
  activeVariantId,
  selection,
  onSelectionChange,
  onSelectVariant,
  onVariantAction,
}: StateBoardSurfaceProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
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

  useCanvasResize(canvasRef, containerRef, () => undefined);
  useCanvasGestures(containerRef, canvasRef, setCamera, screenToWorld);
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

  const selectedVariantIds = selection.kind === "screen" ? selection.variantIds : [selection.variantId];

  const hitTest = (world: Point): string | null => {
    for (let index = variants.length - 1; index >= 0; index -= 1) {
      const frame = frameById[variants[index].id];
      if (!frame) continue;
      if (world.x >= frame.x && world.x <= frame.x + frame.width && world.y >= frame.y && world.y <= frame.y + frame.height) {
        return frame.variant.id;
      }
    }
    return null;
  };

  const updateSelection = (variantId: string, additive: boolean) => {
    onSelectVariant(variantId);
    const nextVariantIds = additive
      ? selectedVariantIds.includes(variantId)
        ? selectedVariantIds.filter((id) => id !== variantId)
        : [...selectedVariantIds, variantId]
      : [variantId];
    onSelectionChange({ kind: "screen", variantIds: nextVariantIds });
  };

  const startDrag = (variantIds: string[], world: Point) => {
    const starts: Record<string, Point> = {};
    for (const id of variantIds) {
      const frame = frameById[id];
      if (frame) starts[id] = { x: frame.x, y: frame.y };
    }
    setDrag({ startWorld: world, starts });
  };

  const panBy = (clientX: number, clientY: number) => {
    const dx = clientX - lastMousePos.current.x;
    const dy = clientY - lastMousePos.current.y;
    setCamera((prev) => ({ ...prev, x: prev.x + dx / prev.zoom, y: prev.y + dy / prev.zoom }));
    lastMousePos.current = { x: clientX, y: clientY };
  };

  const finishMarquee = () => {
    if (!marquee) return;
    const nextIds = collectFrameHits(frameById, marquee);
    onSelectionChange({ kind: "screen", variantIds: nextIds });
    if (nextIds[0]) onSelectVariant(nextIds[0]);
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
    const hit = hitTest(world);
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    if (!hit) {
      setMarquee({ startWorld: world, currentWorld: world, additive });
      if (!additive) onSelectionChange({ kind: "screen", variantIds: [] });
      return;
    }
    const dragIds = selectedVariantIds.includes(hit) && !additive ? selectedVariantIds : [hit];
    updateSelection(hit, additive);
    startDrag(dragIds, world);
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
    if (drag) {
      const dx = world.x - drag.startWorld.x;
      const dy = world.y - drag.startWorld.y;
      for (const [variantId, start] of Object.entries(drag.starts)) {
        onVariantAction({
          type: "moveVariantScreen",
          variantId,
          position: { x: Math.round(start.x + dx), y: Math.round(start.y + dy) },
        });
      }
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
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const widgetType = mapPaletteWidgetToType(event.dataTransfer.getData("widget"));
    if (!widgetType) return;

    const world = screenToWorld(event.clientX, event.clientY);
    const dropTarget = resolveStateBoardWidgetDropTarget({ project, board, world });
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

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-neutral-900"
      tabIndex={0}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDragOver={(event) => {
        if (mapPaletteWidgetToType(event.dataTransfer.getData("widget"))) {
          event.preventDefault();
        }
      }}
      onDrop={handleDrop}
      onKeyDown={(event) => {
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
        <div className="absolute -left-[5000px] -top-[5000px] h-[10000px] w-[10000px] bg-[linear-gradient(var(--color-neutral-800)_1px,transparent_1px),linear-gradient(90deg,var(--color-neutral-800)_1px,transparent_1px)] bg-[size:48px_48px]" />
        {variants.map((variant) => {
          const frame = frameById[variant.id];
          if (!frame) return null;
          const isCanonical = board.canonicalVariantId === variant.id;
          const isSelected = selectedVariantIds.includes(variant.id) || activeVariantId === variant.id;
          return (
            <section
              key={variant.id}
              className={`absolute rounded border bg-neutral-950 shadow-xl ${
                isSelected ? "border-highlight-500 ring-2 ring-highlight-500/40" : "border-neutral-700"
              }`}
              style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
            >
              <div className="absolute -top-7 left-0 flex items-center gap-2 text-xs text-neutral-200">
                <span className="font-semibold">{variant.name}</span>
                {isCanonical ? (
                  <span className="inline-flex items-center gap-1 rounded bg-highlight-500/20 px-2 py-0.5 text-[11px] text-highlight-200">
                    <Star size={11} /> Canonical
                  </span>
                ) : null}
              </div>
              <div className="pointer-events-none flex h-full items-center justify-center text-xs text-neutral-500">
                {frame.width} × {frame.height}
              </div>
            </section>
          );
        })}
        {marquee ? <MarqueeRect marquee={marquee} /> : null}
      </div>
    </div>
  );
}

function worldTransform(camera: Camera): React.CSSProperties {
  return {
    transformOrigin: "0 0",
    transform: `translate(calc(50% + ${camera.x * camera.zoom}px), calc(50% + ${camera.y * camera.zoom}px)) scale(${camera.zoom})`,
  };
}

function collectFrameHits(
  frames: Record<string, { x: number; y: number; width: number; height: number }>,
  marquee: MarqueeState,
): string[] {
  const minX = Math.min(marquee.startWorld.x, marquee.currentWorld.x);
  const maxX = Math.max(marquee.startWorld.x, marquee.currentWorld.x);
  const minY = Math.min(marquee.startWorld.y, marquee.currentWorld.y);
  const maxY = Math.max(marquee.startWorld.y, marquee.currentWorld.y);
  return Object.entries(frames)
    .filter(([, frame]) => frame.x < maxX && frame.x + frame.width > minX && frame.y < maxY && frame.y + frame.height > minY)
    .map(([id]) => id);
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
