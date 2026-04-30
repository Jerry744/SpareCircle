// Pure Canvas 2D renderer for the Navigation Map (02-navigation-map §4.6).
// No React, no mutable module state. World→screen convention mirrors
// `components/canvasViewport/utils.ts`:
//   screen = (world + camera) * zoom + canvasCenter

import type {
  NavigationMap,
  NavMapPoint,
  StateNode,
  Transition,
} from "../../../backend/types/navigationMap";
import {
  NAV_MAP_PORT_RADIUS,
  getNodePortPosition,
  getNodeRect,
} from "../../../backend/navigation/hitTest";
import { routeEdgePath } from "../../../backend/navigation/autoConnect";
import {
  isNodeSelected,
  isTransitionSelected,
  type NavMapSelection,
} from "../../../backend/types/navMapSelection";
import {
  NAV_MAP_DARK_THEME,
  type MarqueeRect,
  type NavMapCamera,
  type NavMapRenderParams,
  type NavMapRenderTheme,
} from "./types";

const GRID_MINOR = 32;
const GRID_MAJOR = 128;
const NODE_CORNER_RADIUS = 8;
const ARROW_SIZE = 10;

/**
 * Renders the entire Navigation Map. Safe to call every frame: resets the
 * backing store, clears to `theme.background`, and redraws from scratch.
 */
export function renderNavMap(
  ctx: CanvasRenderingContext2D,
  params: NavMapRenderParams,
): void {
  const theme = params.theme ?? NAV_MAP_DARK_THEME;
  const dpr = params.devicePixelRatio ?? 1;
  const { canvasWidthCss: wCss, canvasHeightCss: hCss, camera, map, selection } = params;
  const canvas = ctx.canvas;
  const targetW = Math.max(1, Math.floor(wCss * dpr));
  const targetH = Math.max(1, Math.floor(hCss * dpr));
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(wCss / 2, hCss / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(camera.x, camera.y);
  drawGrid(ctx, camera, theme, wCss, hCss);

  for (const id of map.transitionOrder) {
    const t = map.transitions[id];
    if (!t) continue;
    const from = map.stateNodes[t.fromStateNodeId];
    const to = map.stateNodes[t.toStateNodeId];
    if (from && to) drawTransition(ctx, t, from, to, isTransitionSelected(selection, id), theme);
  }
  for (const id of map.stateNodeOrder) {
    const node = map.stateNodes[id];
    if (!node) continue;
    drawStateNode(ctx, node, {
      selected: isNodeSelected(selection, id),
      isInitial: map.initialStateNodeId === id,
      groupColor: params.screenGroupColorByStateNodeId?.[id],
      theme,
    });
  }

  if (params.drag.kind === "marquee") drawMarquee(ctx, params.drag.rect, theme, camera);
  else if (params.drag.kind === "connect") {
    const from = map.stateNodes[params.drag.fromNodeId];
    if (from) drawGhost(ctx, from, params.drag.cursorWorld, params.drag.snapTarget, map, theme, camera);
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: NavMapCamera,
  theme: NavMapRenderTheme,
  wCss: number,
  hCss: number,
): void {
  const z = camera.zoom > 0 ? camera.zoom : 1;
  const left = -camera.x - wCss / (2 * z);
  const right = -camera.x + wCss / (2 * z);
  const top = -camera.y - hCss / (2 * z);
  const bottom = -camera.y + hCss / (2 * z);
  ctx.lineWidth = 1 / z;
  for (const tier of [
    { step: GRID_MINOR, color: theme.gridMinor },
    { step: GRID_MAJOR, color: theme.gridMajor },
  ]) {
    ctx.strokeStyle = tier.color;
    ctx.beginPath();
    for (let x = Math.floor(left / tier.step) * tier.step; x <= right; x += tier.step) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / tier.step) * tier.step; y <= bottom; y += tier.step) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
  }
}

function drawTransition(
  ctx: CanvasRenderingContext2D,
  transition: Transition,
  from: StateNode,
  to: StateNode,
  selected: boolean,
  theme: NavMapRenderTheme,
): void {
  const pts = routeEdgePath(from, to, transition.waypoints);
  if (pts.length < 2) return;
  const color = selected ? theme.edgeSelected : theme.edge;
  ctx.strokeStyle = color;
  ctx.lineWidth = selected ? 2 : 1.5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  drawArrowhead(ctx, pts[pts.length - 2], pts[pts.length - 1], color);
  if (transition.label) drawEdgeLabel(ctx, pts, transition.label, theme);
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  from: NavMapPoint,
  to: NavMapPoint,
  color: string,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = to.x - ux * ARROW_SIZE;
  const by = to.y - uy * ARROW_SIZE;
  const half = ARROW_SIZE * 0.45;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(bx - uy * half, by + ux * half);
  ctx.lineTo(bx + uy * half, by - ux * half);
  ctx.closePath();
  ctx.fill();
}

function drawEdgeLabel(
  ctx: CanvasRenderingContext2D,
  pts: NavMapPoint[],
  label: string,
  theme: NavMapRenderTheme,
): void {
  const mid = Math.max(1, Math.floor(pts.length / 2));
  const cx = (pts[mid - 1].x + pts[mid].x) / 2;
  const cy = (pts[mid - 1].y + pts[mid].y) / 2;
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(label).width + 12;
  ctx.fillStyle = theme.background;
  ctx.fillRect(cx - w / 2, cy - 10, w, 20);
  ctx.fillStyle = theme.nodeTitle;
  ctx.fillText(label, cx, cy);
}

interface StateNodeDrawOpts {
  selected: boolean;
  isInitial: boolean;
  groupColor: string | undefined;
  theme: NavMapRenderTheme;
}

function drawStateNode(
  ctx: CanvasRenderingContext2D,
  node: StateNode,
  opts: StateNodeDrawOpts,
): void {
  const r = getNodeRect(node);
  const { theme, selected, isInitial, groupColor } = opts;
  traceRoundedRect(ctx, r.x, r.y, r.width, r.height, NODE_CORNER_RADIUS);
  ctx.fillStyle = selected ? theme.nodeSelectedFill : theme.nodeFill;
  ctx.fill();
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeStyle = selected ? theme.nodeSelectedStroke : theme.nodeStroke;
  ctx.stroke();
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = theme.nodeTitle;
  ctx.fillText(node.name, r.x + r.width / 2, r.y + r.height / 2);
  if (isInitial) {
    ctx.fillStyle = theme.initialBadge;
    ctx.beginPath();
    ctx.arc(r.x + 10, r.y + 10, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (node.screenGroupId) {
    ctx.fillStyle = theme.nodeGroupBadge;
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("Group", r.x + r.width - 8, r.y + 6);
  }
  ctx.fillStyle = node.color ?? groupColor ?? theme.port;
  for (const port of ["in", "out"] as const) {
    const p = getNodePortPosition(node, port);
    ctx.beginPath();
    ctx.arc(p.x, p.y, NAV_MAP_PORT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const rr = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawMarquee(
  ctx: CanvasRenderingContext2D,
  rect: MarqueeRect,
  theme: NavMapRenderTheme,
  camera: NavMapCamera,
): void {
  const x = Math.min(rect.startWorld.x, rect.currentWorld.x);
  const y = Math.min(rect.startWorld.y, rect.currentWorld.y);
  const w = Math.abs(rect.currentWorld.x - rect.startWorld.x);
  const h = Math.abs(rect.currentWorld.y - rect.startWorld.y);
  ctx.fillStyle = theme.marqueeFill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = theme.marqueeStroke;
  ctx.lineWidth = 1 / camera.zoom;
  ctx.setLineDash([4 / camera.zoom, 3 / camera.zoom]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  fromNode: StateNode,
  cursorWorld: NavMapPoint,
  snapTarget: { nodeId: string; port: "in" | "out" } | null,
  map: NavigationMap,
  theme: NavMapRenderTheme,
  camera: NavMapCamera,
): void {
  const start = getNodePortPosition(fromNode, "out");
  let end = cursorWorld;
  if (snapTarget) {
    const target = map.stateNodes[snapTarget.nodeId];
    if (target) end = getNodePortPosition(target, snapTarget.port);
  }
  ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
  ctx.strokeStyle = theme.ghostEdge;
  ctx.lineWidth = 1.5 / camera.zoom;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (snapTarget) {
    ctx.lineWidth = 2 / camera.zoom;
    ctx.beginPath();
    ctx.arc(end.x, end.y, NAV_MAP_PORT_RADIUS + 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
