import { useEffect, useState } from "react";
import { TopToolbar } from "./TopToolbar";
import { ScreensPanel } from "./ScreensPanel";
import { HierarchyPanel } from "./HierarchyPanel";
import { WidgetsPanel } from "./WidgetsPanel";
import { InspectorPanel } from "./InspectorPanel";
import { CanvasViewport } from "./CanvasViewport";
import { BottomPanel } from "./BottomPanel";
import { EditorBackendProvider } from "../backend/editorStore";

export function IDELayout() {
  const [activeBottomTab, setActiveBottomTab] = useState<string>("assets");

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      // Prevent browser-level two-finger horizontal swipe navigation.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && Math.abs(event.deltaX) > 0) {
        event.preventDefault();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <EditorBackendProvider>
      <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-gray-200">
        {/* Top Toolbar */}
        <TopToolbar />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - fixed width */}
          <div className="w-[260px] min-w-[260px] max-w-[260px] h-full flex flex-col bg-[#2c2c2c] border-r border-[#1e1e1e]">
            <ScreensPanel />
            <div className="h-px bg-[#1e1e1e]" />
            <HierarchyPanel />
          </div>

          {/* Widgets Library - fixed width */}
          <div className="w-[220px] min-w-[220px] max-w-[220px] h-full border-r border-[#1e1e1e]">
            <WidgetsPanel />
          </div>

          {/* Center Canvas - flexible */}
          <div className="flex-1 min-w-0 h-full flex flex-col">
            <div className="flex-1 overflow-hidden">
              <CanvasViewport />
            </div>
            <div className="h-px bg-[#1e1e1e]" />
            <BottomPanel
              activeTab={activeBottomTab}
              onTabChange={setActiveBottomTab}
            />
          </div>

          {/* Right Sidebar - fixed width */}
          <div className="w-[320px] min-w-[320px] max-w-[320px] h-full border-l border-[#1e1e1e]">
            <InspectorPanel />
          </div>
        </div>
      </div>
    </EditorBackendProvider>
  );
}