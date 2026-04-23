import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { NavMapSelection } from "../../backend/types/navMapSelection";
import type { NavMapAction } from "../../backend/reducer/navMapActions";
import { NavigationMap } from "./NavigationMap";

interface NavMapMiniOverlayProps {
  project: ProjectSnapshotV2;
  selection: NavMapSelection;
  onSelectionChange(selection: NavMapSelection): void;
  onAction(action: NavMapAction): void;
  onGoToMap(): void;
}

export function NavMapMiniOverlay({
  project,
  selection,
  onSelectionChange,
  onAction,
  onGoToMap,
}: NavMapMiniOverlayProps): JSX.Element {
  return (
    <div className="h-40 w-60 overflow-hidden rounded border border-highlight-500/50 bg-neutral-900/95 shadow-lg ring-1 ring-neutral-500/40">
      <div className="flex items-center justify-between border-b border-highlight-500/40 px-2 py-1">
        <span className="text-[11px] text-neutral-300">Navigation Map</span>
        <button
          type="button"
          onClick={onGoToMap}
          className="text-[11px] text-highlight-300 hover:text-highlight-200"
        >
          Back
        </button>
      </div>
      <div className="h-[calc(100%-29px)]">
        <NavigationMap
          map={project.navigationMap}
          selection={selection}
          screenGroups={project.screenGroups}
          transitionEventBindings={project.transitionEventBindings}
          onSelectionChange={onSelectionChange}
          onAction={onAction}
          hideInspector
        />
      </div>
    </div>
  );
}
