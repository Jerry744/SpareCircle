// Conditional renderer for Zoom Navigator levels (§6 of
// `dev-plan/interaction-design-framework/03-zoom-navigation.md`). Pure
// routing -- any animation lives in `ZoomTransition`, any state lives in
// `useZoomRouter`.

import type { ReactNode } from "react";
import { useZoomRouter } from "./useZoomRouter";
import { ZoomTransition } from "./ZoomTransition";

export interface ZoomRouterProps {
  /** Render Level 0 (Navigation Map). */
  renderMap(): ReactNode;
  /** Render Level 1 (State Board) given the active target. */
  renderBoard(level: { stateNodeId: string; variantId: string }): ReactNode;
  /**
   * Optional Level 1 mini map overlay rendered on bottom-left of board mode.
   * Returning null keeps previous "board only" behavior.
   */
  renderMapOverlay?(level: { stateNodeId: string; variantId: string }): ReactNode;
  /** Optional fallback rendered when the level cannot be satisfied. */
  fallback?: ReactNode;
}

/**
 * ZoomRouter picks which level's subtree to mount and wraps it in a
 * `<ZoomTransition>` keyed by level identity so the animation wrapper can
 * cue an entrance whenever the user zooms in or out.
 */
export function ZoomRouter(props: ZoomRouterProps): JSX.Element {
  const { renderMap, renderBoard, renderMapOverlay, fallback } = props;
  const { current } = useZoomRouter();

  if (current.level === "map") {
    return (
      <ZoomTransition levelKey="map">
        {renderMap() ?? fallback ?? null}
      </ZoomTransition>
    );
  }

  const { stateNodeId, variantId } = current;
  const key = `board:${stateNodeId}:${variantId}`;
  return (
    <ZoomTransition levelKey={key}>
      <div className="relative h-full w-full">
        {renderBoard({ stateNodeId, variantId }) ?? fallback ?? null}
        {renderMapOverlay ? (
          <div className="pointer-events-auto absolute bottom-3 left-3 z-30">
            {renderMapOverlay({ stateNodeId, variantId })}
          </div>
        ) : null}
      </div>
    </ZoomTransition>
  );
}
