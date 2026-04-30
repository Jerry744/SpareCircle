import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const [shrunk, setShrunk] = useState(false);

  return (
    <div
      className={
        "overflow-hidden rounded border border-neutral-500/40 bg-neutral-900/95 shadow-lg ring-1 ring-neutral-500/40" +
        (shrunk ? " w-60" : " h-40 w-60")
      }
    >
      <div className="flex items-center justify-between border-b border-neutral-500/30 px-2 py-1">
        <span className="text-[11px] text-neutral-300">Navigation Map</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShrunk((s) => !s)}
            className="text-neutral-500 hover:text-neutral-300"
            title={shrunk ? "Expand" : "Shrink"}
            aria-label={shrunk ? "Expand" : "Shrink"}
          >
            {shrunk ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <button
            type="button"
            onClick={onGoToMap}
            className="text-[11px] text-neutral-400 hover:text-neutral-200"
          >
            Back
          </button>
        </div>
      </div>
      {!shrunk && (
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
      )}
    </div>
  );
}
