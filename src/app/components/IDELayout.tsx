import React, { useEffect, useMemo, useState } from "react";
import { TopToolbar, type EditorSurfaceMode } from "./TopToolbar";
import { ScreensPanel } from "./ScreensPanel";
import { HierarchyPanel } from "./HierarchyPanel";
import { WidgetsPanel } from "./WidgetsPanel";
import { RightSidebar } from "./RightSidebar";
import { BottomPanel } from "./BottomPanel";
import { EditorBackendProvider } from "../backend/editorStore";
import { LayoutProvider, useLayout } from "./layoutContext";
import { NavigationMap } from "./navigationMap/NavigationMap";
import { NavMapMiniOverlay } from "./navigationMap/NavMapMiniOverlay";
import { createEmptyProjectV2 } from "../backend/validation";
import type { ProjectSnapshotV2 } from "../backend/types/projectV2";
import type { NavMapAction } from "../backend/reducer/navMapActions";
import type { VariantAction } from "../backend/reducer/variantActions";
import {
  EMPTY_NAV_MAP_SELECTION,
  type NavMapSelection,
} from "../backend/types/navMapSelection";
import { navigationMapReducer } from "../backend/reducer/navigationMapReducer";
import { variantReducer } from "../backend/reducer/variantReducer";
import { ChevronRight } from "lucide-react";
import { ZoomRouter } from "./zoomNavigator/ZoomRouter";
import { ZoomRouterProvider, useZoomRouter } from "./zoomNavigator/useZoomRouter";
import { StateBoardShell, type StateBoardSelection } from "./stateBoard/StateBoardShell";
import { parseProjectSnapshotV2 } from "../backend/validation";

const STATE_PROJECT_STORAGE_KEY = "sparecircle:stateProject:v2";

function createInitialNavMapProject(): ProjectSnapshotV2 {
  let project = createEmptyProjectV2({
    projectName: "Phase2-NavMap-Demo",
    stateNodeId: "state-node-home",
    variantId: "variant-home-root",
    rootWidgetId: "home-root",
  });
  project = navigationMapReducer(project, {
    type: "renameStateNode",
    stateNodeId: "state-node-home",
    name: "Home",
  });
  project = navigationMapReducer(project, {
    type: "createStateNode",
    stateNodeId: "state-node-settings",
    boardId: "board-settings",
    variantId: "variant-settings-root",
    rootWidgetId: "settings-root",
    name: "Settings",
    position: { x: 260, y: 40 },
  });
  project = navigationMapReducer(project, {
    type: "createStateNode",
    stateNodeId: "state-node-diagnostics",
    boardId: "board-diagnostics",
    variantId: "variant-diagnostics-root",
    rootWidgetId: "diagnostics-root",
    name: "Diagnostics",
    position: { x: 120, y: 200 },
  });
  project = navigationMapReducer(project, {
    type: "createTransition",
    transitionId: "transition-home-settings",
    fromStateNodeId: "state-node-home",
    toStateNodeId: "state-node-settings",
    label: "open_settings",
  });
  project = navigationMapReducer(project, {
    type: "createTransition",
    transitionId: "transition-settings-home",
    fromStateNodeId: "state-node-settings",
    toStateNodeId: "state-node-home",
    label: "back",
  });
  return project;
}

function loadInitialNavMapProject(): ProjectSnapshotV2 {
  if (typeof window === "undefined") return createInitialNavMapProject();
  const saved = window.localStorage.getItem(STATE_PROJECT_STORAGE_KEY);
  if (!saved) return createInitialNavMapProject();
  try {
    const parsed = parseProjectSnapshotV2(JSON.parse(saved));
    return parsed.ok ? parsed.value : createInitialNavMapProject();
  } catch {
    return createInitialNavMapProject();
  }
}

function IDELayoutInner() {
  const layout = useLayout();
  const [navMapProject, setNavMapProject] = useState<ProjectSnapshotV2>(() =>
    loadInitialNavMapProject(),
  );
  const [navMapSelection, setNavMapSelection] = useState<NavMapSelection>(
    EMPTY_NAV_MAP_SELECTION,
  );
  const [stateBoardSelection, setStateBoardSelection] = useState<StateBoardSelection | null>(null);
  const { current, zoomInto, goToMap, replaceVariant, rememberNavViewport, rememberNavSelection } =
    useZoomRouter();
  const surfaceMode: EditorSurfaceMode =
    current.level === "map" ? "navmap" : "ui";
  const currentBoard =
    current.level === "board"
      ? getBoardForState(navMapProject, current.stateNodeId)
      : undefined;
  const resolvedStateBoardSelection =
    current.level === "board"
      ? stateBoardSelection ?? { kind: "screen", variantIds: [current.variantId] }
      : null;

  const handleNavMapAction = (action: NavMapAction) => {
    setNavMapProject((prev) => navigationMapReducer(prev, action));
  };
  const handleVariantAction = (action: VariantAction) => {
    setNavMapProject((prev) => variantReducer(prev, action));
  };
  const handleNavMapSelectionChange = (selection: NavMapSelection) => {
    setNavMapSelection(selection);
    rememberNavSelection(selection);
  };
  const handleSurfaceModeChange = (mode: EditorSurfaceMode) => {
    if (mode === "navmap") {
      goToMap();
      return;
    }
    if (current.level === "board") return;
    const targetNodeId =
      navMapSelection.nodeIds[0] ?? navMapProject.navigationMap.initialStateNodeId;
    const fallbackVariantId = targetNodeId
      ? getCanonicalVariantId(navMapProject, targetNodeId)
      : undefined;
    if (targetNodeId && fallbackVariantId) {
      zoomInto(targetNodeId, { variantId: fallbackVariantId });
    }
  };
  const handleOpenStateVariant = (stateNodeId: string, variantId: string) => {
    setStateBoardSelection({ kind: "screen", variantIds: [variantId] });
    zoomInto(stateNodeId, { variantId });
  };

  const navMapContext = useMemo(
    () => ({
      map: navMapProject.navigationMap,
      selection: navMapSelection,
      screenGroups: Object.values(navMapProject.screenGroups),
      transitionEventBindings: navMapProject.transitionEventBindings,
      onAction: handleNavMapAction,
    }),
    [navMapProject, navMapSelection],
  );

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && Math.abs(event.deltaX) > 0) {
        event.preventDefault();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STATE_PROJECT_STORAGE_KEY, JSON.stringify(navMapProject));
  }, [navMapProject]);

  useEffect(() => {
    if (current.level !== "board" || !currentBoard) return;
    setStateBoardSelection((prev) => {
      if (!prev) {
        return { kind: "screen", variantIds: [current.variantId] };
      }
      if (prev.kind === "screen") {
        const variantIds = prev.variantIds.filter((variantId) => currentBoard.variantIds.includes(variantId));
        return variantIds.length === prev.variantIds.length ? prev : { kind: "screen", variantIds };
      }
      if (!currentBoard.variantIds.includes(prev.variantId)) {
        return { kind: "screen", variantIds: [current.variantId] };
      }
      const widgetIds = prev.widgetIds.filter((widgetId) => Boolean(navMapProject.widgetsById[widgetId]));
      if (widgetIds.length === 0) {
        return { kind: "screen", variantIds: [prev.variantId] };
      }
      return widgetIds.length === prev.widgetIds.length ? prev : { kind: "widget", variantId: prev.variantId, widgetIds };
    });
  }, [current.level, current.variantId, currentBoard, navMapProject.widgetsById]);

  return (
    <div className="sc-editor-shell h-screen w-screen flex flex-col bg-neutral-900 text-neutral-100">
      <TopToolbar
        surfaceMode={surfaceMode}
        onSurfaceModeChange={handleSurfaceModeChange}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <div
          className="h-full flex flex-col bg-neutral-700 border-r border-neutral-900 transition-[width,min-width,max-width] duration-200 ease-in-out overflow-hidden relative"
          style={{
            width: layout.leftSidebarCollapsed ? 0 : 260,
            minWidth: layout.leftSidebarCollapsed ? 0 : 260,
            maxWidth: layout.leftSidebarCollapsed ? 0 : 260,
          }}
        >
          <ScreensPanel
            stateProject={navMapProject}
            activeStateNodeId={current.level === "board" ? current.stateNodeId : undefined}
            activeVariantId={current.level === "board" ? current.variantId : undefined}
            onOpenStateVariant={handleOpenStateVariant}
            onVariantAction={handleVariantAction}
          />
          <div className="h-px bg-neutral-900" />
          <HierarchyPanel
            stateHierarchyContext={
              current.level === "board" && currentBoard
                ? {
                    project: navMapProject,
                    board: currentBoard,
                    activeVariantId: current.variantId,
                    selection: resolvedStateBoardSelection ?? { kind: "screen", variantIds: [current.variantId] },
                    onSelectVariant: replaceVariant,
                    onSelectionChange: setStateBoardSelection,
                    onVariantAction: handleVariantAction,
                  }
                : undefined
            }
          />
        </div>

        {/* Left sidebar collapsed edge trigger */}
        {layout.leftSidebarCollapsed && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 z-20 cursor-pointer hover:bg-highlight-500/30 transition-colors group"
            onClick={() => layout.setLeftSidebarCollapsed(false)}
          >
            <div className="absolute top-1/2 -translate-y-1/2 left-0 w-5 h-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight size={12} className="text-highlight-400" />
            </div>
          </div>
        )}

        {/* Widgets Library - collapsible */}
        <div
          className="h-full border-r border-neutral-900 transition-[width,min-width,max-width] duration-200 ease-in-out overflow-hidden"
          style={{
            width: layout.widgetsPanelCollapsed ? 36 : 220,
            minWidth: layout.widgetsPanelCollapsed ? 36 : 220,
            maxWidth: layout.widgetsPanelCollapsed ? 36 : 220,
          }}
        >
          <WidgetsPanel collapsed={layout.widgetsPanelCollapsed} onToggleCollapse={layout.toggleWidgetsPanel} />
        </div>

        {/* Center Canvas + Bottom Panel */}
        <div className="flex-1 min-w-0 h-full flex flex-col relative">
          <div className="flex-1 overflow-hidden">
            <ZoomRouter
              renderMap={() => (
                <NavigationMap
                  map={navMapProject.navigationMap}
                  selection={navMapSelection}
                  screenGroups={navMapProject.screenGroups}
                  transitionEventBindings={navMapProject.transitionEventBindings}
                  onSelectionChange={handleNavMapSelectionChange}
                  onAction={handleNavMapAction}
                  onRequestZoomInto={(stateNodeId) => {
                    const variantId = getCanonicalVariantId(navMapProject, stateNodeId);
                    if (!variantId) return;
                    zoomInto(stateNodeId, { variantId });
                  }}
                  onCameraChange={rememberNavViewport}
                  hideInspector
                />
              )}
              renderBoard={({ stateNodeId, variantId }) => (
                <StateBoardShell
                  project={navMapProject}
                  projectName={navMapProject.projectName}
                  stateNodeId={stateNodeId}
                  variantId={variantId}
                  selection={resolvedStateBoardSelection ?? { kind: "screen", variantIds: [variantId] }}
                  onGoToMap={goToMap}
                  onSelectionChange={setStateBoardSelection}
                  onReplaceVariant={replaceVariant}
                  onVariantAction={handleVariantAction}
                />
              )}
              renderMapOverlay={() => (
                <NavMapMiniOverlay
                  project={navMapProject}
                  selection={navMapSelection}
                  onSelectionChange={handleNavMapSelectionChange}
                  onAction={handleNavMapAction}
                  onGoToMap={goToMap}
                />
              )}
            />
          </div>

          {/* Bottom panel collapsed edge trigger */}
          {layout.bottomPanelCollapsed && (
            <div
              className="absolute bottom-0 left-0 right-0 h-1 z-20 cursor-pointer hover:bg-highlight-500/30 transition-colors group"
              onClick={() => layout.setBottomPanelCollapsed(false)}
            >
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 h-5 w-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={12} className="text-highlight-400 rotate-[-90deg]" />
              </div>
            </div>
          )}

          <div
            className="border-t border-neutral-900 transition-[height,max-height] duration-200 ease-in-out overflow-hidden"
            style={{
              height: layout.bottomPanelCollapsed ? 0 : 224,
              maxHeight: layout.bottomPanelCollapsed ? 0 : 224,
            }}
          >
            <BottomPanel
              stateBoardSettings={
                currentBoard
                  ? {
                      board: currentBoard,
                      onResolutionChange: (width, height) =>
                        handleVariantAction({ type: "setBoardResolution", boardId: currentBoard.id, width, height }),
                    }
                  : undefined
              }
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <div
          className="h-full border-l border-neutral-900 transition-[width,min-width,max-width] duration-200 ease-in-out overflow-hidden relative"
          style={{
            width: layout.rightSidebarCollapsed ? 0 : 320,
            minWidth: layout.rightSidebarCollapsed ? 0 : 320,
            maxWidth: layout.rightSidebarCollapsed ? 0 : 320,
          }}
        >
          <RightSidebar
            surfaceMode={surfaceMode}
            navMapContext={navMapContext}
            stateBoardContext={
              current.level === "board" && currentBoard
                ? {
                    project: navMapProject,
                    board: currentBoard,
                    selectedVariantId: current.variantId,
                    selection: resolvedStateBoardSelection ?? { kind: "screen", variantIds: [current.variantId] },
                    onVariantAction: handleVariantAction,
                  }
                : undefined
            }
          />
        </div>

        {/* Right sidebar collapsed edge trigger */}
        {layout.rightSidebarCollapsed && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 z-20 cursor-pointer hover:bg-highlight-500/30 transition-colors group"
            onClick={() => layout.setRightSidebarCollapsed(false)}
          >
            <div className="absolute top-1/2 -translate-y-1/2 right-0 w-5 h-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight size={12} className="text-highlight-400 rotate-180" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function IDELayout() {
  return (
    <EditorBackendProvider>
      <LayoutProvider>
        <ZoomRouterProvider>
          <IDELayoutInner />
        </ZoomRouterProvider>
      </LayoutProvider>
    </EditorBackendProvider>
  );
}

function getCanonicalVariantId(
  project: ProjectSnapshotV2,
  stateNodeId: string,
): string | undefined {
  const boardId = project.navigationMap.stateNodes[stateNodeId]?.boardId;
  if (!boardId) return undefined;
  return project.stateBoardsById[boardId]?.canonicalVariantId;
}

function getBoardForState(
  project: ProjectSnapshotV2,
  stateNodeId: string,
) {
  const boardId = project.navigationMap.stateNodes[stateNodeId]?.boardId;
  return boardId ? project.stateBoardsById[boardId] : undefined;
}
