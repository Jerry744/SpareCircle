import { useEffect, useMemo, useState } from "react";
import { EventBindingsPanel } from "./EventBindingsPanel";
import { InspectorPanel } from "./InspectorPanel";
import type { NavigationMap as NavigationMapModel } from "../backend/types/navigationMap";
import type { NavMapSelection } from "../backend/types/navMapSelection";
import type { NavMapAction } from "../backend/reducer/navMapActions";
import type { ScreenGroup } from "../backend/types/screenGroup";
import type { TransitionEventBinding } from "../backend/types/eventBinding";
import { NavMapInspectorHost } from "./navigationMap/inspector/NavMapInspectorHost";
import type { EditorSurfaceMode } from "./TopToolbar";

type RightSidebarTab = "state-inspector" | "inspector" | "events";

interface RightSidebarProps {
  surfaceMode?: EditorSurfaceMode;
  navMapContext?: {
    map: NavigationMapModel;
    selection: NavMapSelection;
    screenGroups: ScreenGroup[];
    transitionEventBindings?: Record<string, TransitionEventBinding>;
    onAction(action: NavMapAction): void;
  };
}

export function RightSidebar({
  surfaceMode = "ui",
  navMapContext,
}: RightSidebarProps = {}) {
  const [activeTab, setActiveTab] = useState<RightSidebarTab>("inspector");
  const isNavMapActive = surfaceMode === "navmap" && Boolean(navMapContext);

  const tabs = useMemo<Array<{ id: RightSidebarTab; label: string }>>(() => {
    if (!isNavMapActive) {
      return [
        { id: "inspector", label: "Inspector" },
        { id: "events", label: "Events" },
      ];
    }
    return [
      { id: "state-inspector", label: "State Inspector" },
      { id: "inspector", label: "Inspector" },
      { id: "events", label: "Events" },
    ];
  }, [isNavMapActive]);

  useEffect(() => {
    if (isNavMapActive) {
      setActiveTab("state-inspector");
      return;
    }
    if (activeTab === "state-inspector") {
      setActiveTab("inspector");
    }
  }, [isNavMapActive]);

  return (
    <div className="h-full bg-neutral-700 border-l border-neutral-900 flex flex-col">
      <div className="h-10 border-b border-neutral-900 px-2 flex items-end gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-semibold rounded-t transition-colors ${
              activeTab === tab.id
                ? "bg-highlight-900 text-white"
                : "text-neutral-300 hover:text-neutral-100 hover:bg-neutral-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === "state-inspector" && navMapContext ? (
          <NavMapInspectorHost
            map={navMapContext.map}
            selection={navMapContext.selection}
            screenGroups={navMapContext.screenGroups}
            transitionEventBindings={navMapContext.transitionEventBindings}
            onAction={navMapContext.onAction}
            confirmDelete={(message) =>
              Promise.resolve(
                typeof window !== "undefined" ? window.confirm(message) : true,
              )
            }
          />
        ) : activeTab === "inspector" ? (
          <InspectorPanel showHeader={false} />
        ) : (
          <EventBindingsPanel showHeader={false} />
        )}
      </div>
    </div>
  );
}
