import { useEffect } from "react";
import { TopToolbar } from "./TopToolbar";
import { ScreensPanel } from "./ScreensPanel";
import { HierarchyPanel } from "./HierarchyPanel";
import { WidgetsPanel } from "./WidgetsPanel";
import { RightSidebar } from "./RightSidebar";
import { CanvasViewport } from "./CanvasViewport";
import { BottomPanel } from "./BottomPanel";
import { EditorBackendProvider } from "../backend/editorStore";
import { LayoutProvider, useLayout } from "./layoutContext";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, PanelBottomClose, PanelBottomOpen, ChevronRight } from "lucide-react";

function IDELayoutInner() {
  const layout = useLayout();

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && Math.abs(event.deltaX) > 0) {
        event.preventDefault();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div className="sc-editor-shell h-screen w-screen flex flex-col bg-neutral-900 text-neutral-100">
      <TopToolbar />

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
          <ScreensPanel />
          <div className="h-px bg-neutral-900" />
          <HierarchyPanel />
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
            <CanvasViewport />
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
            <BottomPanel />
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
          <RightSidebar />
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
        <IDELayoutInner />
      </LayoutProvider>
    </EditorBackendProvider>
  );
}
