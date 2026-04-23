import { useMemo, useState } from "react";
import { createEmptyProjectV2 } from "../../backend/validation";
import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { NavMapAction } from "../../backend/reducer/navMapActions";
import {
  EMPTY_NAV_MAP_SELECTION,
  type NavMapSelection,
} from "../../backend/types/navMapSelection";
import { navigationMapReducer } from "../../backend/reducer/navigationMapReducer";
import { NavigationMap } from "./NavigationMap";

function createDemoProject(): ProjectSnapshotV2 {
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

/**
 * Temporary Phase-2 demo entry for NavigationMap.
 * This keeps v1 editor flow untouched while allowing live preview.
 */
export function NavigationMapDemo() {
  const [project, setProject] = useState<ProjectSnapshotV2>(() => createDemoProject());
  const [selection, setSelection] = useState<NavMapSelection>(EMPTY_NAV_MAP_SELECTION);
  const transitionEventBindings = useMemo(() => project.transitionEventBindings, [project]);

  const handleAction = (action: NavMapAction) => {
    setProject((prev) => navigationMapReducer(prev, action));
  };

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-2 top-2 z-20 rounded bg-neutral-950/80 px-2 py-1 text-xs text-neutral-300">
        NavMap Demo Mode
      </div>
      <NavigationMap
        map={project.navigationMap}
        selection={selection}
        screenGroups={project.screenGroups}
        transitionEventBindings={transitionEventBindings}
        onSelectionChange={setSelection}
        onAction={handleAction}
        onRequestZoomInto={(stateNodeId) => {
          console.info("Zoom requested for state node:", stateNodeId);
        }}
      />
    </div>
  );
}
