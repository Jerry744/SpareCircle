import {
  KNOWN_WIDGET_EVENTS,
  type EditorAction,
  type EditorState,
  type EventBinding,
  type WidgetEventBindings,
  type WidgetEventType,
  type WidgetNode,
} from "../types";
import { getWidgetById, transformProjectWidgets } from "../tree";
import { commitProjectChange, isBindingValid } from "./helpers";

export function handleUpsertWidgetEventBinding(state: EditorState, action: EditorAction): EditorState {
  const widgetId = action.widgetId as string;
  const binding = action.binding as EventBinding;
  if (!widgetId || !binding || !KNOWN_WIDGET_EVENTS.includes(binding.event)) return state;

  const targetWidget = getWidgetById(state.project, widgetId);
  if (!targetWidget || !isBindingValid(state.project, binding)) return state;

  const nextBindings: WidgetEventBindings = {
    ...(targetWidget.eventBindings ?? {}),
    [binding.event]: binding,
  };

  const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => ({
    ...widget,
    eventBindings: nextBindings,
  }));
  if (JSON.stringify(nextProject) === JSON.stringify(state.project)) return state;

  return commitProjectChange(state, nextProject, [widgetId]);
}

export function handleRemoveWidgetEventBinding(state: EditorState, action: EditorAction): EditorState {
  const widgetId = action.widgetId as string;
  const event = action.event as WidgetEventType;
  if (!widgetId || !KNOWN_WIDGET_EVENTS.includes(event)) return state;

  const targetWidget = getWidgetById(state.project, widgetId);
  if (!targetWidget?.eventBindings?.[event]) return state;

  const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => {
    const nextBindings: WidgetEventBindings = { ...(widget.eventBindings ?? {}) };
    delete nextBindings[event];
    return {
      ...widget,
      eventBindings: Object.keys(nextBindings).length > 0 ? nextBindings : undefined,
    };
  });

  return commitProjectChange(state, nextProject, [widgetId]);
}
