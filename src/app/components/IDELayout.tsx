import { useEffect, useState } from "react";
import { TopToolbar } from "./TopToolbar";
import { ScreensPanel } from "./ScreensPanel";
import { HierarchyPanel } from "./HierarchyPanel";
import { WidgetsPanel } from "./WidgetsPanel";
import { RightSidebar } from "./RightSidebar";
import { CanvasViewport } from "./CanvasViewport";
import { BottomPanel } from "./BottomPanel";
import { EditorBackendProvider } from "../backend/editorStore";

export function IDELayout() {
  const [activeBottomTab, setActiveBottomTab] = useState<string>("assets");
  const [widgetsPanelCollapsed, setWidgetsPanelCollapsed] = useState(false);

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
      <div className="sc-editor-shell h-screen w-screen flex flex-col bg-[#1e1e1e] text-gray-200">
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

          {/* Widgets Library - collapsible */}
          <div
            className="h-full border-r border-[#1e1e1e] transition-all duration-200 overflow-hidden"
            style={{ width: widgetsPanelCollapsed ? 36 : 220, minWidth: widgetsPanelCollapsed ? 36 : 220, maxWidth: widgetsPanelCollapsed ? 36 : 220 }}
          >
            <WidgetsPanel collapsed={widgetsPanelCollapsed} onToggleCollapse={() => setWidgetsPanelCollapsed(c => !c)} />
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
            <RightSidebar />
          </div>
        </div>
      </div>
    </EditorBackendProvider>
  );
}