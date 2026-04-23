// Pure state-management for Zoom Navigator runtime history stack.
// See `dev-plan/interaction-design-framework/03-zoom-navigation.md` §4.
// The stack is held in React context only and never persisted, so these
// helpers must stay immutable and free of React / DOM dependencies.

import type { NavigationZoomLevel } from "../../backend/types/zoomLevel";
import type { NavMapViewport } from "../../backend/types/navigationMap";
import type { NavMapSelection } from "../../backend/types/navMapSelection";

export interface BoardCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface ZoomContext {
  level: NavigationZoomLevel;
  navCamera?: NavMapViewport;
  boardCamera?: BoardCamera;
  selectedWidgetIds?: string[];
  navSelection?: NavMapSelection;
}

// Append `ctx` to the stack, returning a new array. Input is never mutated.
export function pushContext(
  stack: ZoomContext[],
  ctx: ZoomContext,
): ZoomContext[] {
  return [...stack, ctx];
}

// Pop the top-of-stack entry. Empty input yields `{ ctx: null, next: [] }`.
export function popContext(
  stack: ZoomContext[],
): { ctx: ZoomContext | null; next: ZoomContext[] } {
  if (stack.length === 0) {
    return { ctx: null, next: [] };
  }
  const ctx = stack[stack.length - 1] ?? null;
  const next = stack.slice(0, -1);
  return { ctx, next };
}

// Peek the current top-of-stack entry without mutating it.
export function peekContext(stack: ZoomContext[]): ZoomContext | null {
  if (stack.length === 0) return null;
  return stack[stack.length - 1] ?? null;
}

// Apply `updater` to the top entry; empty stacks pass through unchanged.
export function replaceTopContext(
  stack: ZoomContext[],
  updater: (top: ZoomContext) => ZoomContext,
): ZoomContext[] {
  if (stack.length === 0) return [];
  const top = stack[stack.length - 1];
  if (top === undefined) return stack.slice();
  const next = stack.slice(0, -1);
  next.push(updater(top));
  return next;
}

// Discriminant guard for the Level 0 (Navigation Map) zoom level.
export function isMapLevel(
  level: NavigationZoomLevel,
): level is { level: "map" } {
  return level.level === "map";
}

// Discriminant guard for the Level 1 (State Board) zoom level.
export function isBoardLevel(
  level: NavigationZoomLevel,
): level is { level: "board"; stateNodeId: string; variantId: string } {
  return level.level === "board";
}

// Shared empty stack sentinel; frozen so callers cannot mutate the default.
export const EMPTY_ZOOM_STACK: readonly ZoomContext[] = Object.freeze(
  [] as ZoomContext[],
);
