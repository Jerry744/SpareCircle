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
    <div className="h-full bg-[#2c2c2c] border-l border-[#1e1e1e] flex flex-col">
      <div className="h-10 border-b border-[#1e1e1e] px-2 flex items-end gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-semibold rounded-t transition-colors ${
              activeTab === tab.id
                ? "bg-[#3c4a5d] text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#353535]"
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
