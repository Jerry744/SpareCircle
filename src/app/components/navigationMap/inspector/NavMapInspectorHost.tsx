// NavMapInspectorHost — decides which inspector to render for the current
// Navigation Map selection and adapts UI events into `NavMapAction`s.
// See `dev-plan/interaction-design-framework/02-navigation-map.md` §6.

import { useMemo } from "react";
import type {
  NavigationMap as NavigationMapModel,
} from "../../../backend/types/navigationMap";
import type { NavMapSelection } from "../../../backend/types/navMapSelection";
import type { NavMapAction } from "../../../backend/reducer/navMapActions";
import type { ScreenGroup } from "../../../backend/types/screenGroup";
import type { TransitionEventBinding } from "../../../backend/types/eventBinding";
import { StateNodeInspector } from "./StateNodeInspector";
import { TransitionInspector } from "./TransitionInspector";

export interface NavMapInspectorHostProps {
  map: NavigationMapModel;
  selection: NavMapSelection;
  screenGroups: ScreenGroup[];
  transitionEventBindings?: Record<string, TransitionEventBinding>;
  onAction(action: NavMapAction): void;
  onRequestZoomInto?(stateNodeId: string): void;
  confirmDelete(message: string): Promise<boolean>;
}

/**
 * NavMapInspectorHost — stateless router between the selection model and
 * the concrete inspector components. Kept as a separate file so the
 * NavigationMap container stays under its line budget.
 */
export function NavMapInspectorHost({
  map,
  selection,
  screenGroups,
  transitionEventBindings,
  onAction,
  onRequestZoomInto,
  confirmDelete,
}: NavMapInspectorHostProps) {
  const content = useMemo(() => {
    if (selection.kind === "node" && selection.nodeIds.length === 1) {
      const node = map.stateNodes[selection.nodeIds[0]];
      if (!node) return placeholder("Selected node is no longer present.");
      return (
        <StateNodeInspector
          node={node}
          isInitial={map.initialStateNodeId === node.id}
          screenGroups={screenGroups}
          onRename={(name) =>
            onAction({ type: "renameStateNode", stateNodeId: node.id, name })
          }
          onColorChange={(color) =>
            onAction({
              type: "setStateNodeAppearance",
              stateNodeId: node.id,
              color: color ?? null,
            })
          }
          onScreenGroupChange={(groupId) =>
            onAction({
              type: "assignStateNodeGroup",
              stateNodeId: node.id,
              screenGroupId: groupId,
            })
          }
          onSetInitial={() =>
            onAction({ type: "setInitialState", stateNodeId: node.id })
          }
          onToggleNavigationState={(next) =>
            onAction({
              type: "toggleNavigationState",
              stateNodeId: node.id,
              isNavigationState: next,
            })
          }
          onZoomInto={
            onRequestZoomInto ? () => onRequestZoomInto(node.id) : undefined
          }
          onDelete={() => {
            void confirmDelete(`Delete "${node.name}"?`).then((ok) => {
              if (ok)
                onAction({ type: "deleteStateNodes", stateNodeIds: [node.id] });
            });
          }}
        />
      );
    }
    if (
      selection.kind === "transition" &&
      selection.transitionIds.length === 1
    ) {
      const transition = map.transitions[selection.transitionIds[0]];
      if (!transition) return placeholder("Selected transition is no longer present.");
      const from = map.stateNodes[transition.fromStateNodeId];
      const to = map.stateNodes[transition.toStateNodeId];
      const binding = transition.eventBindingId
        ? transitionEventBindings?.[transition.eventBindingId]
        : undefined;
      return (
        <TransitionInspector
          transition={transition}
          fromNodeName={from?.name ?? "unknown"}
          toNodeName={to?.name ?? "unknown"}
          binding={binding}
          onLabelChange={(label) =>
            onAction({
              type: "updateTransitionLabel",
              transitionId: transition.id,
              label,
            })
          }
          onReverse={() =>
            onAction({
              type: "reverseTransition",
              transitionId: transition.id,
            })
          }
          onDelete={() =>
            onAction({
              type: "deleteTransition",
              transitionId: transition.id,
            })
          }
        />
      );
    }
    if (selection.kind === "none") return placeholder("Nothing selected.");
    return placeholder(
      `${selection.nodeIds.length + selection.transitionIds.length} items selected.`,
    );
  }, [
    selection,
    map,
    screenGroups,
    onAction,
    onRequestZoomInto,
    confirmDelete,
    transitionEventBindings,
  ]);

  return content;
}

function placeholder(message: string) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-neutral-400">
      {message}
    </div>
  );
}
