// NavigationMap — stateful container that wires the pure canvas layer to
// React. See `dev-plan/interaction-design-framework/02-navigation-map.md` §5.
//
// This container is intentionally driven by props so Phase 6 can plug in
// the v2 reducer without reshaping the component tree. The live editor
// store is NOT accessed here.

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  NavigationMap as NavigationMapModel,
  NavMapPoint,
} from "../../backend/types/navigationMap";
import { DEFAULT_NAV_MAP_VIEWPORT } from "../../backend/types/navigationMap";
import type { NavMapSelection } from "../../backend/types/navMapSelection";
import { makeNavMapSelection } from "../../backend/types/navMapSelection";
import type { NavMapAction } from "../../backend/reducer/navMapActions";
import type { ScreenGroup } from "../../backend/types/screenGroup";
import type { TransitionEventBinding } from "../../backend/types/eventBinding";
import {
  createNavMapHandlers,
  type InteractionDeps,
} from "./canvas/interactions";
import type {
  DragKind,
  NavMapCamera,
  NavMapRenderTheme,
} from "./canvas/types";
import { NavMapCanvas } from "./canvas/NavMapCanvas";
import { NavMapToolbar } from "./toolbar/NavMapToolbar";
import { NavMapInspectorHost } from "./inspector/NavMapInspectorHost";
import { NavMapContextMenu } from "./contextMenu/NavMapContextMenu";

export interface NavigationMapProps {
  map: NavigationMapModel;
  selection: NavMapSelection;
  screenGroups?: Record<string, ScreenGroup>;
  transitionEventBindings?: Record<string, TransitionEventBinding>;
  onSelectionChange(selection: NavMapSelection): void;
  onAction(action: NavMapAction): void;
  onRequestZoomInto?(stateNodeId: string): void;
  onCameraChange?(camera: NavMapCamera): void;
  initialCamera?: NavMapCamera;
  theme?: NavMapRenderTheme;
  className?: string;
  hideInspector?: boolean;
}

const ZOOM_STEP = 1.2;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

/**
 * NavigationMap — top-level state-machine view. Exposes a pure props-based
 * API so the Phase 6 adapter can bridge it to the v2 reducer.
 */
export function NavigationMap({
  map,
  selection,
  screenGroups,
  transitionEventBindings,
  onSelectionChange,
  onAction,
  onRequestZoomInto,
  onCameraChange,
  initialCamera,
  theme,
  className,
  hideInspector = false,
}: NavigationMapProps) {
  const [camera, setCameraState] = useState<NavMapCamera>(
    () => initialCamera ?? map.viewport ?? DEFAULT_NAV_MAP_VIEWPORT,
  );
  const [drag, setDragState] = useState<DragKind>({ kind: "idle" });
  const canvasRegionRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef(map);
  mapRef.current = map;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const setCamera = useCallback(
    (next: NavMapCamera) => {
      setCameraState(next);
      onCameraChange?.(next);
    },
    [onCameraChange],
  );

  const screenToWorld = useCallback(
    (screenX: number, screenY: number): NavMapPoint => {
      const region = canvasRegionRef.current;
      if (!region) return { x: 0, y: 0 };
      const rect = region.getBoundingClientRect();
      const cam = cameraRef.current;
      const zoom = cam.zoom || 1;
      const localX = screenX - rect.left - rect.width / 2;
      const localY = screenY - rect.top - rect.height / 2;
      return { x: localX / zoom - cam.x, y: localY / zoom - cam.y };
    },
    [],
  );

  const confirmDelete = useCallback(
    (message: string): Promise<boolean> =>
      Promise.resolve(
        typeof window !== "undefined" ? window.confirm(message) : true,
      ),
    [],
  );

  const handlers = useMemo(() => {
    const deps: InteractionDeps = {
      getMap: () => mapRef.current,
      getCamera: () => cameraRef.current,
      getSelection: () => selectionRef.current,
      setCamera,
      setSelection: (next) => onSelectionChange(next),
      setDrag: setDragState,
      getDrag: () => dragRef.current,
      screenToWorld,
      dispatch: (action) => onAction(action),
      requestZoomInto: onRequestZoomInto,
      confirmDelete,
    };
    return createNavMapHandlers(deps);
  }, [
    setCamera,
    onSelectionChange,
    screenToWorld,
    onAction,
    onRequestZoomInto,
    confirmDelete,
  ]);

  const groupColorByNodeId = useMemo(() => {
    if (!screenGroups) return undefined;
    const out: Record<string, string | undefined> = {};
    for (const nodeId of map.stateNodeOrder) {
      const node = map.stateNodes[nodeId];
      if (!node?.screenGroupId) continue;
      const group = screenGroups[node.screenGroupId];
      if (group) out[nodeId] = group.color;
    }
    return out;
  }, [map, screenGroups]);

  const groupList = useMemo(
    () => (screenGroups ? Object.values(screenGroups) : []),
    [screenGroups],
  );

  const zoomAtCenter = (factor: number) => {
    const next = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (next === camera.zoom) return;
    setCamera({ ...camera, zoom: next });
  };

  const handleContextDelete = useCallback(() => {
    for (const id of selectionRef.current.transitionIds) {
      onAction({ type: "deleteTransition", transitionId: id });
    }
    const nodeIds = selectionRef.current.nodeIds;
    if (nodeIds.length === 0) return;
    void confirmDelete(`Delete ${nodeIds.length} state node(s)?`).then(
      (ok) => {
        if (ok) onAction({ type: "deleteStateNodes", stateNodeIds: nodeIds });
      },
    );
  }, [onAction, confirmDelete]);

  const handleAddToGroup = useCallback(
    (nodeId: string) => {
      const first = groupList[0];
      if (!first) return;
      onAction({
        type: "assignStateNodeGroup",
        stateNodeId: nodeId,
        screenGroupId: first.id,
      });
      onSelectionChange(makeNavMapSelection([nodeId], []));
    },
    [groupList, onAction, onSelectionChange],
  );

  const selectionSize =
    selection.nodeIds.length + selection.transitionIds.length;

  return (
    <div
      className={
        "flex h-full w-full relative bg-neutral-900 text-neutral-100" +
        (className ? ` ${className}` : "")
      }
    >
      <div className="flex-1 relative">
        <NavMapToolbar
          camera={camera}
          selectionSize={selectionSize}
          onZoomIn={() => zoomAtCenter(ZOOM_STEP)}
          onZoomOut={() => zoomAtCenter(1 / ZOOM_STEP)}
          onResetCamera={() => setCamera({ ...DEFAULT_NAV_MAP_VIEWPORT })}
          onAutoTidy={() => onAction({ type: "autoTidyNavMap" })}
          onCreateStateNode={() =>
            onAction({ type: "createStateNode", position: { x: 0, y: 0 } })
          }
        />
        <NavMapContextMenu
          selection={selection}
          onEnterBoard={onRequestZoomInto}
          onMarkInitial={(id) =>
            onAction({ type: "setInitialState", stateNodeId: id })
          }
          onAddToGroup={handleAddToGroup}
          onDelete={handleContextDelete}
        >
          <div ref={canvasRegionRef} className="absolute inset-0">
            <NavMapCanvas
              map={map}
              camera={camera}
              drag={drag}
              selection={selection}
              screenGroupColorByStateNodeId={groupColorByNodeId}
              theme={theme}
              handlers={handlers}
            />
          </div>
        </NavMapContextMenu>
      </div>
      {hideInspector ? null : (
        <aside className="w-80 border-l border-neutral-900 bg-neutral-800 overflow-auto">
          <NavMapInspectorHost
            map={map}
            selection={selection}
            screenGroups={groupList}
            transitionEventBindings={transitionEventBindings}
            onAction={onAction}
            onRequestZoomInto={onRequestZoomInto}
            confirmDelete={confirmDelete}
          />
        </aside>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
