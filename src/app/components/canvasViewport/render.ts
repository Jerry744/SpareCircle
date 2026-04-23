import { DESIGN_TOKENS } from "../../constants/designTokens";
import { resolveWidgetColor } from "../../backend/validation";
import type { ProjectSnapshot, WidgetTreeNode } from "../../backend/editorStore";
import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { Camera, DragState, MarqueeState } from "./types";
import { worldToScreenForCamera } from "./utils";

type RenderProject = Pick<ProjectSnapshot, "styleTokens" | "assets" | "canvasSnap">
  | Pick<ProjectSnapshotV2, "styleTokens" | "assets" | "canvasSnap">;

function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, camera: Camera) {
  const gridSize = 50;
  const scaledGridSize = gridSize * camera.zoom;
  const offsetX = (camera.x * camera.zoom) % scaledGridSize;
  const offsetY = (camera.y * camera.zoom) % scaledGridSize;

  ctx.strokeStyle = DESIGN_TOKENS.neutral[600];
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;

  for (let x = offsetX; x < width; x += scaledGridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = offsetY; y < height; y += scaledGridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

export function renderCanvasBackdrop(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  camera: Camera,
) {
  ctx.fillStyle = DESIGN_TOKENS.neutral[900];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, canvas.width, canvas.height, camera);
}

function drawWidget(
  ctx: CanvasRenderingContext2D,
  params: {
    project: RenderProject;
    selectedWidgetIds: string[];
    imageCache: Map<string, HTMLImageElement>;
    rerender: () => void;
  },
  widget: WidgetTreeNode,
  absX: number,
  absY: number,
  depth: number,
) {
  if (widget.visible === false) {
    return;
  }

  const isSelected = params.selectedWidgetIds.includes(widget.id);
  const radius = widget.radius ?? (widget.type === "Button" ? 10 : widget.type === "Panel" ? 14 : 0);
  const fill = resolveWidgetColor(params.project, widget, "fill");
  const stroke = widget.type === "Label" ? "transparent" : "rgba(255,255,255,0.08)";

  ctx.save();

  if (
    fill !== "transparent" &&
    widget.type !== "Slider" &&
    widget.type !== "Switch" &&
    widget.type !== "Checkbox" &&
    widget.type !== "Radio"
  ) {
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
    ctx.fillStyle = resolveWidgetColor(params.project, widget, "textColor");
    ctx.font = depth > 1 ? "13px sans-serif" : "16px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(widget.text ?? widget.name, absX, absY + widget.height / 2);
  } else if (widget.type === "Image") {
    const asset = widget.assetId ? params.project.assets[widget.assetId] : undefined;
    const cached = widget.assetId ? params.imageCache.get(widget.assetId) : undefined;

    if (asset && widget.assetId && !cached) {
      const image = new Image();
      image.onload = params.rerender;
      image.onerror = params.rerender;
      image.src = asset.dataUrl;
      params.imageCache.set(widget.assetId, image);
    }

    const image = widget.assetId ? params.imageCache.get(widget.assetId) : undefined;
    if (image && image.complete && image.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(absX + 1, absY + 1, Math.max(1, widget.width - 2), Math.max(1, widget.height - 2));
      ctx.clip();
      ctx.drawImage(image, absX, absY, widget.width, widget.height);
      ctx.restore();
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(absX + 6, absY + 6, Math.max(8, widget.width - 12), Math.max(8, widget.height - 12));
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(asset ? "Loading..." : "Image", absX + widget.width / 2, absY + widget.height / 2);
    }
  } else if (widget.type === "Button") {
    ctx.fillStyle = resolveWidgetColor(params.project, widget, "textColor");
    ctx.font = "600 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(widget.text ?? widget.name, absX + widget.width / 2, absY + widget.height / 2);
  } else if (widget.type === "Checkbox" || widget.type === "Radio") {
    const isChecked = widget.checked === true;
    const indicatorSize = Math.min(16, widget.height - 6);
    const indicatorX = absX + 2;
    const indicatorY = absY + (widget.height - indicatorSize) / 2;
    const indicatorColor = resolveWidgetColor(params.project, widget, "fill");
    const textColor = resolveWidgetColor(params.project, widget, "textColor");

    if (widget.type === "Radio") {
      const cx = indicatorX + indicatorSize / 2;
      const cy = indicatorY + indicatorSize / 2;
      const r = indicatorSize / 2;
      ctx.strokeStyle = isChecked ? indicatorColor : "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (isChecked) {
        ctx.fillStyle = indicatorColor;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const r = 3;
      ctx.strokeStyle = isChecked ? indicatorColor : "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, indicatorX, indicatorY, indicatorSize, indicatorSize, r);
      ctx.stroke();
      if (isChecked) {
        ctx.fillStyle = indicatorColor;
        drawRoundedRect(ctx, indicatorX, indicatorY, indicatorSize, indicatorSize, r);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(indicatorX + indicatorSize * 0.2, indicatorY + indicatorSize * 0.5);
        ctx.lineTo(indicatorX + indicatorSize * 0.42, indicatorY + indicatorSize * 0.72);
        ctx.lineTo(indicatorX + indicatorSize * 0.8, indicatorY + indicatorSize * 0.22);
        ctx.stroke();
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";
      }
    }

    ctx.fillStyle = textColor;
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(widget.text ?? "Option", indicatorX + indicatorSize + 7, absY + widget.height / 2);
  } else if (widget.type === "Dropdown") {
    const arrowSize = 8;
    const arrowX = absX + widget.width - arrowSize - 10;
    const arrowY = absY + widget.height / 2;
    const textColor = resolveWidgetColor(params.project, widget, "textColor");
    const firstOption = (widget.text ?? "Option 1").split("\n")[0];

    ctx.fillStyle = textColor;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY - arrowSize / 2);
    ctx.lineTo(arrowX + arrowSize, arrowY - arrowSize / 2);
    ctx.lineTo(arrowX + arrowSize / 2, arrowY + arrowSize / 2);
    ctx.closePath();
    ctx.fill();

    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(firstOption, absX + 10, absY + widget.height / 2);
  } else if (widget.type === "Switch") {
    const isOn = widget.checked === true;
    const trackR = widget.height / 2;
    const knobR = trackR - 3;
    const knobX = isOn ? absX + widget.width - trackR : absX + trackR;
    const knobY = absY + widget.height / 2;
    const trackColor = resolveWidgetColor(params.project, widget, "fill");
    ctx.fillStyle = isOn ? trackColor : hexWithAlpha(trackColor, 0.45);
    drawRoundedRect(ctx, absX, absY, widget.width, widget.height, trackR);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, absX, absY, widget.width, widget.height, trackR);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(knobX, knobY, knobR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (widget.type === "Slider") {
    const pct = Math.max(0, Math.min(100, widget.value ?? 0)) / 100;
    const trackH = Math.max(4, Math.round(widget.height * 0.3));
    const trackY = absY + (widget.height - trackH) / 2;
    const knobR = Math.min(widget.height / 2 - 1, trackH + 4);
    const indicatorW = Math.round(widget.width * pct);
    const trackR = trackH / 2;
    ctx.fillStyle = DESIGN_TOKENS.neutral[600];
    drawRoundedRect(ctx, absX, trackY, widget.width, trackH, trackR);
    ctx.fill();
    if (indicatorW >= trackH) {
      ctx.fillStyle = resolveWidgetColor(params.project, widget, "fill");
      drawRoundedRect(ctx, absX, trackY, indicatorW, trackH, trackR);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(absX + indicatorW, absY + widget.height / 2, knobR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (const child of widget.children) {
    drawWidget(ctx, params, child, absX + child.x, absY + child.y, depth + 1);
  }

  if (isSelected) {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = DESIGN_TOKENS.highlight[500];
    ctx.lineWidth = 2;
    ctx.strokeRect(absX - 1, absY - 1, widget.width + 2, widget.height + 2);
    ctx.setLineDash([]);

    const handleSize = 10;
    ctx.fillStyle = DESIGN_TOKENS.highlight[500];
    ctx.fillRect(absX + widget.width - handleSize / 2, absY + widget.height - handleSize / 2, handleSize, handleSize);
  }

  ctx.restore();
}

export function renderWidgetTree(params: {
  ctx: CanvasRenderingContext2D;
  project: RenderProject;
  rootTree: WidgetTreeNode | null;
  selectedWidgetIds: string[];
  imageCache: Map<string, HTMLImageElement>;
  rerender: () => void;
  offsetX?: number;
  offsetY?: number;
}) {
  if (!params.rootTree) return;
  drawWidget(
    params.ctx,
    {
      project: params.project,
      selectedWidgetIds: params.selectedWidgetIds,
      imageCache: params.imageCache,
      rerender: params.rerender,
    },
    params.rootTree,
    params.offsetX ?? 0,
    params.offsetY ?? 0,
    0,
  );
}

export function renderCanvas(params: {
  canvas: HTMLCanvasElement | null;
  camera: Camera;
  rootTree: WidgetTreeNode | null;
  project: RenderProject;
  selectedWidgetIds: string[];
  marquee: MarqueeState | null;
  dragState: DragState | null;
  snapGuides: { xGuides: number[]; yGuides: number[] } | null;
  imageCache: Map<string, HTMLImageElement>;
  rerender: () => void;
}) {
  const ctx = params.canvas?.getContext("2d");
  if (!params.canvas || !ctx) {
    return;
  }

  renderCanvasBackdrop(ctx, params.canvas, params.camera);

  const screenPosition = worldToScreenForCamera(params.canvas, params.camera, 0, 0);
  ctx.save();
  ctx.translate(screenPosition.x, screenPosition.y);
  ctx.scale(params.camera.zoom, params.camera.zoom);

  renderWidgetTree({
    ctx,
    project: params.project,
    rootTree: params.rootTree,
    selectedWidgetIds: params.selectedWidgetIds,
    imageCache: params.imageCache,
    rerender: params.rerender,
  });

  ctx.restore();

  if (params.dragState && params.snapGuides && params.project.canvasSnap?.magnetSnapEnabled) {
    ctx.save();
    ctx.strokeStyle = `${DESIGN_TOKENS.highlight[500]}59`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    for (const xVal of params.snapGuides.xGuides) {
      const point = worldToScreenForCamera(params.canvas, params.camera, xVal, 0);
      ctx.beginPath();
      ctx.moveTo(point.x, 0);
      ctx.lineTo(point.x, params.canvas.height);
      ctx.stroke();
    }
    for (const yVal of params.snapGuides.yGuides) {
      const point = worldToScreenForCamera(params.canvas, params.camera, 0, yVal);
      ctx.beginPath();
      ctx.moveTo(0, point.y);
      ctx.lineTo(params.canvas.width, point.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (params.marquee) {
    const start = worldToScreenForCamera(
      params.canvas,
      params.camera,
      params.marquee.startWorld.x,
      params.marquee.startWorld.y,
    );
    const end = worldToScreenForCamera(
      params.canvas,
      params.camera,
      params.marquee.currentWorld.x,
      params.marquee.currentWorld.y,
    );
    const rx = Math.min(start.x, end.x);
    const ry = Math.min(start.y, end.y);
    const rw = Math.abs(end.x - start.x);
    const rh = Math.abs(end.y - start.y);
    ctx.strokeStyle = DESIGN_TOKENS.highlight[500];
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle = `${DESIGN_TOKENS.highlight[500]}14`;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }

  const origin = worldToScreenForCamera(params.canvas, params.camera, 0, 0);
  ctx.strokeStyle = DESIGN_TOKENS.status.error[500];
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(origin.x - 10, origin.y);
  ctx.lineTo(origin.x + 10, origin.y);
  ctx.moveTo(origin.x, origin.y - 10);
  ctx.lineTo(origin.x, origin.y + 10);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
