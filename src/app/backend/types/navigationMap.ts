// Navigation Map domain types.
// Corresponds to `dev-plan/interaction-design-framework/01-data-model.md` §3.1.

export interface NavMapPoint {
  x: number;
  y: number;
}

export interface NavMapViewport {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_NAV_MAP_VIEWPORT: NavMapViewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

// A StateNode is the top-level unit of the Navigation Map. It is always
// 1:1 with a StateBoard (see `boardId`). `isNavigationState === false`
// means the node represents a Local UI State that should not clutter the
// top-level map (PRD §6.14).
export interface StateNode {
  id: string;
  name: string;
  description?: string;
  color?: string;
  position: NavMapPoint;
  boardId: string;
  screenGroupId?: string;
  isNavigationState: boolean;
}

// A Transition is a directed edge between two StateNodes. The optional
// `eventBindingId` points to the `TransitionEventBinding` that materializes
// this logical edge into a concrete trigger (PRD §6.9).
export interface Transition {
  id: string;
  fromStateNodeId: string;
  toStateNodeId: string;
  label?: string;
  eventBindingId?: string;
  waypoints?: NavMapPoint[];
}

export interface NavigationMap {
  stateNodes: Record<string, StateNode>;
  // Insertion order, used for deterministic list rendering and BFS fallbacks.
  stateNodeOrder: string[];
  transitions: Record<string, Transition>;
  transitionOrder: string[];
  initialStateNodeId: string;
  viewport: NavMapViewport;
}

export const DEFAULT_STATE_NODE_COLOR = "#3b82f6";
