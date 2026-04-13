import type { InteractionState, Point, ProjectSnapshot } from "./types";
import { transformProjectWidgets } from "./tree";

export function moveProjectWidgets(project: ProjectSnapshot, widgetIds: string[], dx: number, dy: number): ProjectSnapshot {
  return transformProjectWidgets(project, widgetIds, (widget) => ({
    ...widget,
    x: widget.x + dx,
    y: widget.y + dy,
  }));
}

export function resizeProjectWidget(project: ProjectSnapshot, widgetId: string, dx: number, dy: number): ProjectSnapshot {
  return transformProjectWidgets(project, [widgetId], (widget) => ({
    ...widget,
    width: Math.max(24, widget.width + dx),
    height: Math.max(24, widget.height + dy),
  }));
}

export function applyInteraction(project: ProjectSnapshot, interaction: InteractionState, pointer: Point): ProjectSnapshot {
  const dx = pointer.x - interaction.pointerStart.x;
  const dy = pointer.y - interaction.pointerStart.y;

  if (interaction.kind === "move") {
    return moveProjectWidgets(project, interaction.widgetIds, dx, dy);
  }

  return resizeProjectWidget(project, interaction.widgetIds[0], dx, dy);
}
