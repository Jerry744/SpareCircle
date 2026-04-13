import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import {
  buildWidgetTree,
  canContainChildren,
  flattenWidgetTree,
  getActiveScreenFromProject,
  mapPaletteWidgetToType,
  useEditorBackend,
  type Point,
  type WidgetTreeNode,
} from "../backend/editorStore";
import { resolveWidgetColor } from "../backend/validation";

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface SafariGestureEvent extends Event {
  scale: number;
  clientX: number;
  clientY: number;
}

type HitResult = {
  widget: WidgetTreeNode;
  absX: number;
  absY: number;
  mode: "body" | "resize";
};

export function CanvasViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const zoomAnchorWorld = useRef<{ x: number; y: number } | null>(null);
  const zoomTimeoutRef = useRef<number | null>(null);
  const lastGestureScaleRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    kind: "move" | "resize";
    pointerStart: Point;
    widgetIds: string[];
    handle?: "se";
  } | null>(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const {
    state: {
      project,
      selectedWidgetIds,
    },
    actions: {
      addWidget,
      selectWidget,
      clearSelection,
      beginInteraction,
      updateInteraction,
      commitInteraction,
      cancelInteraction,
    },
  } = useEditorBackend();

  const activeScreen = getActiveScreenFromProject(project);
  const rootTree = buildWidgetTree(project, activeScreen.rootNodeId);

  // 屏幕坐标转世界坐标
  const screenToWorldRef = (screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const cam = cameraRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (screenX - rect.left - canvas.width / 2) / cam.zoom - cam.x;
    const y = (screenY - rect.top - canvas.height / 2) / cam.zoom - cam.y;
    return { x, y };
  };

  // 屏幕坐标转世界坐标（用于渲染，使用state）
  const screenToWorld = (screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const x = (screenX - rect.left - canvas.width / 2) / camera.zoom - camera.x;
    const y = (screenY - rect.top - canvas.height / 2) / camera.zoom - camera.y;
    return { x, y };
  };

  // 世界坐标转屏幕坐标
  const worldToScreen = (worldX: number, worldY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const x = (worldX + camera.x) * camera.zoom + canvas.width / 2;
    const y = (worldY + camera.y) * camera.zoom + canvas.height / 2;
    return { x, y };
  };

  // 绘制网格
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 50;
    const scaledGridSize = gridSize * camera.zoom;
    
    // 计算网格偏移
    const offsetX = ((camera.x * camera.zoom) % scaledGridSize);
    const offsetY = ((camera.y * camera.zoom) % scaledGridSize);

    ctx.strokeStyle = "#3e3e42";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    // 绘制垂直线
    for (let x = offsetX; x < width; x += scaledGridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // 绘制水平线
    for (let y = offsetY; y < height; y += scaledGridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    const safeRadius = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
    ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
    ctx.arcTo(x, y + height, x, y, safeRadius);
    ctx.arcTo(x, y, x + width, y, safeRadius);
    ctx.closePath();
  };

  const drawWidget = (ctx: CanvasRenderingContext2D, widget: WidgetTreeNode, absX: number, absY: number, depth: number) => {
    if (widget.visible === false) {
      return;
    }

    const isSelected = selectedWidgetIds.includes(widget.id);
    const radius = widget.radius ?? (widget.type === "Button" ? 10 : widget.type === "Panel" ? 14 : 0);
    const fill = resolveWidgetColor(project, widget, "fill");
    const stroke = widget.type === "Label" ? "transparent" : "rgba(255,255,255,0.08)";

    ctx.save();

    if (fill !== "transparent") {
      ctx.fillStyle = fill;
      if (radius > 0) {
        drawRoundedRect(ctx, absX, absY, widget.width, widget.height, radius);
        ctx.fill();
      } else {
        ctx.fillRect(absX, absY, widget.width, widget.height);
      }
    }

    if (widget.type !== "Screen") {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = widget.type === "Button" ? 1.5 : 1;
      if (radius > 0) {
        drawRoundedRect(ctx, absX, absY, widget.width, widget.height, radius);
        ctx.stroke();
      } else if (widget.type !== "Label") {
        ctx.strokeRect(absX, absY, widget.width, widget.height);
      }
    }

    if (widget.type === "Label") {
      ctx.fillStyle = resolveWidgetColor(project, widget, "textColor");
      ctx.font = depth > 1 ? "13px sans-serif" : "16px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(widget.text ?? widget.name, absX, absY + widget.height / 2);
    } else if (widget.type === "Image") {
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(absX + 6, absY + 6, Math.max(8, widget.width - 12), Math.max(8, widget.height - 12));
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Image", absX + widget.width / 2, absY + widget.height / 2);
    } else if (widget.type === "Button") {
      ctx.fillStyle = resolveWidgetColor(project, widget, "textColor");
      ctx.font = "600 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(widget.text ?? widget.name, absX + widget.width / 2, absY + widget.height / 2);
    }

    for (const child of widget.children) {
      drawWidget(ctx, child, absX + child.x, absY + child.y, depth + 1);
    }

    if (isSelected) {
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "#5b9dd9";
      ctx.lineWidth = 2;
      ctx.strokeRect(absX - 1, absY - 1, widget.width + 2, widget.height + 2);
      ctx.setLineDash([]);

      const handleSize = 10;
      ctx.fillStyle = "#5b9dd9";
      ctx.fillRect(absX + widget.width - handleSize / 2, absY + widget.height - handleSize / 2, handleSize, handleSize);
    }

    ctx.restore();
  };

  const getHitTarget = (point: Point): HitResult | null => {
    if (!rootTree) {
      return null;
    }

    const allWidgets = flattenWidgetTree(rootTree);

    for (let index = allWidgets.length - 1; index >= 0; index -= 1) {
      const item = allWidgets[index];
      if (item.widget.type === "Screen") {
        continue;
      }

      const widget = item.widget;
      const withinBody = point.x >= item.absX && point.x <= item.absX + widget.width && point.y >= item.absY && point.y <= item.absY + widget.height;
      if (!withinBody) {
        continue;
      }

      const inResizeHandle = selectedWidgetIds.includes(widget.id)
        && point.x >= item.absX + widget.width - 12
        && point.y >= item.absY + widget.height - 12;

      return {
        widget,
        absX: item.absX,
        absY: item.absY,
        mode: inResizeHandle ? "resize" : "body",
      };
    }

    return null;
  };

  const getDropContainer = (point: Point): { widget: WidgetTreeNode; absX: number; absY: number } | null => {
    if (!rootTree) {
      return null;
    }

    const allWidgets = flattenWidgetTree(rootTree);

    for (let index = allWidgets.length - 1; index >= 0; index -= 1) {
      const item = allWidgets[index];
      const withinBody = point.x >= item.absX
        && point.x <= item.absX + item.widget.width
        && point.y >= item.absY
        && point.y <= item.absY + item.widget.height;

      if (!withinBody) {
        continue;
      }

      if (canContainChildren(item.widget.type)) {
        return item;
      }
    }

    return {
      widget: rootTree,
      absX: 0,
      absY: 0,
    };
  };

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const paletteWidgetId = event.dataTransfer.getData("widget");
    const widgetType = mapPaletteWidgetToType(paletteWidgetId);
    if (!widgetType) {
      return;
    }

    const world = screenToWorldRef(event.clientX, event.clientY);
    const parentInfo = getDropContainer(world);
    if (!parentInfo) {
      return;
    }
    const localX = Math.round(world.x - parentInfo.absX);
    const localY = Math.round(world.y - parentInfo.absY);

    addWidget(parentInfo.widget.id, widgetType, localX, localY);
  };

  // 渲染画布
  const render = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // 清空画布
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制网格
    drawGrid(ctx, canvas.width, canvas.height);

    const screenPosition = worldToScreen(0, 0);
    ctx.save();
    ctx.translate(screenPosition.x, screenPosition.y);
    ctx.scale(camera.zoom, camera.zoom);

    if (rootTree) {
      drawWidget(ctx, rootTree, 0, 0, 0);
    }

    ctx.restore();

    // 绘制坐标轴（调试用）
    const origin = worldToScreen(0, 0);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(origin.x - 10, origin.y);
    ctx.lineTo(origin.x + 10, origin.y);
    ctx.moveTo(origin.x, origin.y - 10);
    ctx.lineTo(origin.x, origin.y + 10);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  // 处理canvas尺寸变化
  useEffect(() => {
    const updateSize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      render();
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // 每次camera变化时重新渲染
  useEffect(() => {
    render();
  }, [camera, project, selectedWidgetIds]);

  // Block browser pinch and map Safari gesture pinch to canvas zoom.
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
      // Prevent browser-level pinch zoom / page overview.
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
        const newX = (anchor.x + prev.x) * prev.zoom / newZoom - anchor.x;
        const newY = (anchor.y + prev.y) * prev.zoom / newZoom - anchor.y;

        return { x: newX, y: newY, zoom: newZoom };
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
  }, []);

  // 键盘事件 - 空格键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
        if (containerRef.current) {
          containerRef.current.style.cursor = "grab";
        }
      } else if (e.code === "Escape") {
        if (dragStateRef.current) {
          cancelInteraction();
          dragStateRef.current = null;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
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
  }, [isSpacePressed, cancelInteraction]);

  // 鼠标事件
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSpacePressed) {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (containerRef.current) {
        containerRef.current.style.cursor = "grabbing";
      }
      return;
    } else if (e.button === 1) {
      setIsMiddlePanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (containerRef.current) {
        containerRef.current.style.cursor = "grabbing";
      }
      return;
    }

    if (e.button !== 0) {
      return;
    }

    const world = screenToWorldRef(e.clientX, e.clientY);
    const target = getHitTarget(world);

    if (!target) {
      clearSelection();
      return;
    }

    const additive = e.metaKey || e.ctrlKey || e.shiftKey;
    const nextSelection = additive
      ? (selectedWidgetIds.includes(target.widget.id)
          ? selectedWidgetIds.filter((widgetId) => widgetId !== target.widget.id)
          : [...selectedWidgetIds, target.widget.id])
      : [target.widget.id];

    selectWidget(target.widget.id, additive);

    if (nextSelection.length === 0) {
      clearSelection();
      return;
    }

    if (target.mode === "resize") {
      dragStateRef.current = {
        kind: "resize",
        pointerStart: world,
        widgetIds: nextSelection.slice(0, 1),
        handle: "se",
      };
      beginInteraction("resize", nextSelection.slice(0, 1), world, "se");
      return;
    }

    dragStateRef.current = {
      kind: "move",
      pointerStart: world,
      widgetIds: nextSelection,
    };
    beginInteraction("move", nextSelection, world);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && isSpacePressed) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      
      setCamera(prev => ({
        ...prev,
        x: prev.x + dx / prev.zoom,
        y: prev.y + dy / prev.zoom,
      }));

      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    } else if (isMiddlePanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      
      setCamera(prev => ({
        ...prev,
        x: prev.x + dx / prev.zoom,
        y: prev.y + dy / prev.zoom,
      }));

      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (dragStateRef.current) {
      const world = screenToWorldRef(e.clientX, e.clientY);
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

    if (dragStateRef.current) {
      commitInteraction();
      dragStateRef.current = null;
    }
  };

  // 触控板/鼠标滚轮交互：双指移动平移，pinch 缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isPinchZoom = e.ctrlKey;
    if (!isPinchZoom) {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
      zoomAnchorWorld.current = null;

      // Precision touchpad 两指滑动 => 画布平移（Windows/macOS）。
      setCamera((prev) => ({
        ...prev,
        x: prev.x - e.deltaX / prev.zoom,
        y: prev.y - e.deltaY / prev.zoom,
      }));
      return;
    }

    // 第一次滚轮事件时锁定锚点（世界坐标），后续连续滚轮复用该锚点
    if (!zoomAnchorWorld.current) {
      zoomAnchorWorld.current = screenToWorldRef(e.clientX, e.clientY);
    }

    // 清除之前的超时，重新计时
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }
    // 滚轮停止 150ms 后释放锚点
    zoomTimeoutRef.current = window.setTimeout(() => {
      zoomAnchorWorld.current = null;
    }, 150);

    const anchor = zoomAnchorWorld.current;

    // 计算新的缩放级别
    const zoomSpeed = 0.001;
    const delta = -e.deltaY * zoomSpeed;

    setCamera(prev => {
      const newZoom = Math.max(0.1, Math.min(5, prev.zoom * (1 + delta)));
      // 保持锚点在屏幕上不动：anchor_world + cam = 常量 / zoom
      // 推导: newCamX = anchor.x + (prev.x + anchor.x) 不对
      // 正确推导: screenPos = (world + cam) * zoom + offset
      // 要保持 screenPos 不变: (anchor + newCam) * newZoom = (anchor + prevCam) * prevZoom
      // => newCam = (anchor + prevCam) * prevZoom / newZoom - anchor
      const newX = (anchor.x + prev.x) * prev.zoom / newZoom - anchor.x;
      const newY = (anchor.y + prev.y) * prev.zoom / newZoom - anchor.y;

      return { x: newX, y: newY, zoom: newZoom };
    });
  };

  const handleZoomIn = () => {
    setCamera(prev => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.2) }));
  };

  const handleZoomOut = () => {
    setCamera(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.2) }));
  };

  const handleResetView = () => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  };

  return (
    <div className="h-full bg-[#1e1e1e] flex flex-col">
      {/* Canvas Toolbar */}
      <div className="h-10 bg-[#2c2c2c] border-b border-[#1e1e1e] flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Canvas</span>
          <div className="h-4 w-px bg-[#3c3c3c]" />
          <span className="text-xs text-gray-400">{activeScreen.meta.width} × {activeScreen.meta.height}</span>
          <div className="h-4 w-px bg-[#3c3c3c]" />
          <span className="text-xs text-gray-500">
            Pan: Two-Finger Drag / Space / Middle Drag | Zoom: Pinch
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-gray-400"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-gray-400 w-14 text-center">
            {Math.round(camera.zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-gray-400"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={handleResetView}
            className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-gray-400"
          >
            <Maximize size={14} />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
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
            const world = screenToWorldRef(event.clientX, event.clientY);
            const target = getHitTarget(world);

            if (target) {
              selectWidget(target.widget.id, false);
            }
          }}
        />
      </div>
    </div>
  );
}