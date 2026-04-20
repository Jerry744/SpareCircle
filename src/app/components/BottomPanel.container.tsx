import { useState } from "react";
import { AssetsPanel } from "./bottomPanel/AssetsPanel";
import { ComponentsPanel } from "./bottomPanel/ComponentsPanel";
import { BOTTOM_PANEL_TABS } from "./bottomPanel/config";
import { EventsPanel } from "./bottomPanel/EventsPanel";
import { ExportPanel } from "./bottomPanel/ExportPanel";
import { SettingsPanel } from "./bottomPanel/SettingsPanel";
import { ThemesPanel } from "./bottomPanel/ThemesPanel";

function BottomPanelContent({ activeTab }: { activeTab: string }) {
  if (activeTab === "assets") {
    return <AssetsPanel />;
  }
  if (activeTab === "components") {
    return <ComponentsPanel />;
  }
  if (activeTab === "themes") {
    return <ThemesPanel />;
  }
  if (activeTab === "events") {
    return <EventsPanel />;
  }
  if (activeTab === "export") {
    return <ExportPanel />;
  }
  if (activeTab === "settings") {
    return <SettingsPanel />;
  }
  return null;
}

export function BottomPanel() {
  const [activeTab, setActiveTab] = useState<string>("assets");

  return (
    <div className="h-full bg-neutral-700 flex flex-col">
      <div className="flex items-center gap-1 px-2 pt-1 border-b border-neutral-900">
        {BOTTOM_PANEL_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 flex items-center gap-2 text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-highlight-500 text-neutral-100"
                : "border-transparent text-neutral-300 hover:text-neutral-100"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <BottomPanelContent activeTab={activeTab} />
      </div>
    </div>
  );
}
