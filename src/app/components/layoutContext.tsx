import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface LayoutState {
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  bottomPanelCollapsed: boolean;
  widgetsPanelCollapsed: boolean;
}

interface LayoutActions {
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleBottomPanel: () => void;
  toggleWidgetsPanel: () => void;
  setLeftSidebarCollapsed: (collapsed: boolean) => void;
  setRightSidebarCollapsed: (collapsed: boolean) => void;
  setBottomPanelCollapsed: (collapsed: boolean) => void;
  setWidgetsPanelCollapsed: (collapsed: boolean) => void;
}

type LayoutContextValue = LayoutState & LayoutActions;

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);
  const [widgetsPanelCollapsed, setWidgetsPanelCollapsed] = useState(false);

  const toggleLeftSidebar = useCallback(() => setLeftSidebarCollapsed((c) => !c), []);
  const toggleRightSidebar = useCallback(() => setRightSidebarCollapsed((c) => !c), []);
  const toggleBottomPanel = useCallback(() => setBottomPanelCollapsed((c) => !c), []);
  const toggleWidgetsPanel = useCallback(() => setWidgetsPanelCollapsed((c) => !c), []);

  const value: LayoutContextValue = {
    leftSidebarCollapsed,
    rightSidebarCollapsed,
    bottomPanelCollapsed,
    widgetsPanelCollapsed,
    toggleLeftSidebar,
    toggleRightSidebar,
    toggleBottomPanel,
    toggleWidgetsPanel,
    setLeftSidebarCollapsed,
    setRightSidebarCollapsed,
    setBottomPanelCollapsed,
    setWidgetsPanelCollapsed,
  };

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return ctx;
}
