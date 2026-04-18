import { useState } from "react";
import { EventBindingsPanel } from "./EventBindingsPanel";
import { InspectorPanel } from "./InspectorPanel";

type RightSidebarTab = "inspector" | "events";

const TABS: Array<{ id: RightSidebarTab; label: string }> = [
  { id: "inspector", label: "Inspector" },
  { id: "events", label: "Events" },
];

export function RightSidebar() {
  const [activeTab, setActiveTab] = useState<RightSidebarTab>("inspector");

  return (
    <div className="h-full bg-neutral-700 border-l border-neutral-900 flex flex-col">
      <div className="h-10 border-b border-neutral-900 px-2 flex items-end gap-1">
        {TABS.map((tab) => (
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
        {activeTab === "inspector" ? <InspectorPanel showHeader={false} /> : <EventBindingsPanel showHeader={false} />}
      </div>
    </div>
  );
}
