// Pointer/keyboard/wheel dispatcher for the Navigation Map canvas
// (02-navigation-map §4.7). Translates raw DOM events into `NavMapAction`s
// and drag/selection/camera updates via the injected `InteractionDeps`.
// No React, no direct DOM reads outside what handlers receive.

import type { NavMapAction } from "../../../backend/reducer/navMapActions";
import type {
  NavigationMap,
  NavMapPoint,
} from "../../../backend/types/navigationMap";
import {
  makeNavMapSelection,
  type NavMapSelection,
} from "../../../backend/types/navMapSelection";
import { hitTestNavMap } from "../../../backend/navigation/hitTest";
import { snapToNearestNode } from "../../../backend/navigation/autoConnect";
import type { DragKind, NavMapCamera } from "./types";
import {
  applyNodeSelection,
  capturePositions,
  clamp,
  pickInMarquee,
  toggleTransition,
} from "./interactionHelpers";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const WHEEL_ZOOM_FACTOR = 0.0015;

/** Host hooks the interaction layer depends on. */
export interface InteractionDeps {
  getMap(): NavigationMap;
  getCamera(): NavMapCamera;
  getSelection(): NavMapSelection;
  setCamera(camera: NavMapCamera): void;
  setSelection(selection: NavMapSelection): void;
  setDrag(drag: DragKind): void;
  getDrag(): DragKind;
  screenToWorld(screenX: number, screenY: number): NavMapPoint;
  dispatch(action: NavMapAction): void;
  requestZoomInto?(stateNodeId: string): void;
  confirmDelete?(message: string): Promise<boolean>;
}

/** Handler bundle returned by `createNavMapHandlers`. */
export interface NavMapInteractionHandlers {
  onPointerDown(event: PointerEvent): void;
  onPointerMove(event: PointerEvent): void;
  onPointerUp(event: PointerEvent): void;
  onDoubleClick(event: MouseEvent): void;
  onKeyDown(event: KeyboardEvent): void;
  onWheel(event: WheelEvent): void;
}

/**
 * Creates the handler bundle. A closure-local flag tracks whether Space is
 * held; a window `keyup` listener clears it so `space + left` panning
 * works even when focus leaves the canvas mid-gesture.
 */
export function createNavMapHandlers(
  deps: InteractionDeps,
): NavMapInteractionHandlers {
  const pressed = { space: false };
  if (typeof window !== "undefined") {
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") pressed.space = false;
    });
  }
  const confirm = deps.confirmDelete ?? (() => Promise.resolve(true));

  function onPointerDown(event: PointerEvent): void {
    const camera = deps.getCamera();
    const world = deps.screenToWorld(event.clientX, event.clientY);
    if (event.button === 1 || (event.button === 0 && pressed.space)) {
      deps.setDrag({
        kind: "pan",
        pointerStartScreen: { x: event.clientX, y: event.clientY },
        cameraStart: { ...camera },
      });
      return;
    }
    if (event.button !== 0) return;

    const map = deps.getMap();
    const hit = hitTestNavMap(map, world, camera.zoom);
    if (hit.kind === "edge_handle" && hit.handle === "port_out" && hit.nodeId) {
      deps.setDrag({
        kind: "connect",
        fromNodeId: hit.nodeId,
        cursorWorld: world,
        snapTarget: null,
      });
      return;
    }
    if (hit.kind === "node" && hit.nodeId) {
      const next = applyNodeSelection(deps.getSelection(), hit.nodeId, event.shiftKey);
      deps.setSelection(next);
      deps.setDrag({
        kind: "move_nodes",
        pointerStartWorld: world,
        startPositions: capturePositions(map, next.nodeIds),
      });
      return;
    }
    if (hit.kind === "edge" && hit.transitionId) {
      deps.setSelection(
        event.shiftKey
          ? toggleTransition(deps.getSelection(), hit.transitionId)
          : makeNavMapSelection([], [hit.transitionId]),
      );
      return;
    }
    deps.setDrag({
      kind: "marquee",
      rect: { startWorld: world, currentWorld: world, additive: event.shiftKey },
    });
  }

  function onPointerMove(event: PointerEvent): void {
    const drag = deps.getDrag();
    if (drag.kind === "idle") return;
    if (drag.kind === "pan") {
      const zoom = drag.cameraStart.zoom || 1;
      deps.setCamera({
        ...drag.cameraStart,
        x: drag.cameraStart.x + (event.clientX - drag.pointerStartScreen.x) / zoom,
        y: drag.cameraStart.y + (event.clientY - drag.pointerStartScreen.y) / zoom,
      });
      return;
    }
    const world = deps.screenToWorld(event.clientX, event.clientY);
    if (drag.kind === "move_nodes") {
      const dx = world.x - drag.pointerStartWorld.x;
      const dy = world.y - drag.pointerStartWorld.y;
      const updates = Object.entries(drag.startPositions).map(([id, p]) => ({
        stateNodeId: id,
        position: { x: p.x + dx, y: p.y + dy },
      }));
      if (updates.length > 0) deps.dispatch({ type: "batchMoveStateNodes", updates });
      return;
    }
    if (drag.kind === "marquee") {
      deps.setDrag({ kind: "marquee", rect: { ...drag.rect, currentWorld: world } });
      return;
    }
    if (drag.kind === "connect") {
      const snap = snapToNearestNode(deps.getMap(), world, drag.fromNodeId);
      deps.setDrag({
        kind: "connect",
        fromNodeId: drag.fromNodeId,
        cursorWorld: world,
        snapTarget: snap ? { nodeId: snap.nodeId, port: snap.port } : null,
      });
    }
  }

  function onPointerUp(_event: PointerEvent): void {
    const drag = deps.getDrag();
    if (drag.kind === "idle") return;
    if (drag.kind === "marquee") {
      const picked = pickInMarquee(deps.getMap(), drag.rect.startWorld, drag.rect.currentWorld);
      const base = drag.rect.additive
        ? deps.getSelection()
        : makeNavMapSelection([], []);
      deps.setSelection(
        makeNavMapSelection(
          [...base.nodeIds, ...picked.nodeIds],
          [...base.transitionIds, ...picked.transitionIds],
        ),
      );
    } else if (drag.kind === "connect") {
      commitConnect(deps, drag.fromNodeId, drag.cursorWorld, drag.snapTarget);
    }
    deps.setDrag({ kind: "idle" });
  }

  function onDoubleClick(event: MouseEvent): void {
    const world = deps.screenToWorld(event.clientX, event.clientY);
    const hit = hitTestNavMap(deps.getMap(), world, deps.getCamera().zoom);
    if (hit.kind === "node" && hit.nodeId) {
      deps.requestZoomInto?.(hit.nodeId);
    } else if (hit.kind === "empty") {
      deps.dispatch({ type: "createStateNode", position: world });
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code === "Space") {
      pressed.space = true;
      return;
    }
    if (event.key === "Escape") {
      deps.setSelection(makeNavMapSelection([], []));
      return;
    }
    const selection = deps.getSelection();
    const first = selection.nodeIds[0];
    if (event.key === "Enter" || ((event.ctrlKey || event.metaKey) && event.key === "Enter")) {
      if (first) deps.requestZoomInto?.(first);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      void runDelete(deps, selection, confirm);
    }
  }

  function onWheel(event: WheelEvent): void {
    const camera = deps.getCamera();
    if (event.ctrlKey || event.metaKey) {
      const nextZoom = clamp(
        camera.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_FACTOR),
        MIN_ZOOM,
        MAX_ZOOM,
      );
      if (nextZoom === camera.zoom) return;
      const pointer = deps.screenToWorld(event.clientX, event.clientY);
      const ratio = camera.zoom / nextZoom;
      deps.setCamera({
        x: (pointer.x + camera.x) * ratio - pointer.x,
        y: (pointer.y + camera.y) * ratio - pointer.y,
        zoom: nextZoom,
      });
      return;
    }
    const zoom = camera.zoom || 1;
    deps.setCamera({
      ...camera,
      x: camera.x - event.deltaX / zoom,
      y: camera.y - event.deltaY / zoom,
    });
  }

  return { onPointerDown, onPointerMove, onPointerUp, onDoubleClick, onKeyDown, onWheel };
}

function commitConnect(
  deps: InteractionDeps,
  fromNodeId: string,
  cursorWorld: NavMapPoint,
  snapTarget: { nodeId: string; port: "in" | "out" } | null,
): void {
  if (snapTarget && snapTarget.port === "in" && snapTarget.nodeId !== fromNodeId) {
    deps.dispatch({
      type: "createTransition",
      fromStateNodeId: fromNodeId,
      toStateNodeId: snapTarget.nodeId,
    });
    return;
  }
  if (!snapTarget) {
    const placeholderId = `navmap-pending-${Date.now().toString(36)}`;
    deps.dispatch({
      type: "createStateNode",
      position: cursorWorld,
      stateNodeId: placeholderId,
    });
    deps.dispatch({
      type: "createTransition",
      fromStateNodeId: fromNodeId,
      toStateNodeId: placeholderId,
    });
  }
}

async function runDelete(
  deps: InteractionDeps,
  selection: NavMapSelection,
  confirm: (message: string) => Promise<boolean>,
): Promise<void> {
  for (const id of selection.transitionIds) {
    deps.dispatch({ type: "deleteTransition", transitionId: id });
  }
  if (selection.nodeIds.length > 0) {
    const ok = await confirm(`Delete ${selection.nodeIds.length} state node(s)?`);
    if (ok) deps.dispatch({ type: "deleteStateNodes", stateNodeIds: selection.nodeIds });
  }
}
