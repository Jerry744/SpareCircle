import { useEffect, useMemo, useState } from "react";
import {
  collectSubtreeIds,
  getActiveScreenFromProject,
  getWidgetById,
  useEditorBackend,
  type WidgetEventBindings,
  type WidgetActionType,
  type WidgetEventType,
} from "../backend/editorStore";

const EVENT_OPTIONS: Array<{ value: WidgetEventType; label: string }> = [
  { value: "clicked", label: "clicked" },
  { value: "pressed", label: "pressed" },
  { value: "value_changed", label: "value_changed" },
];

type EventBindingDraft = {
  actionType: "none" | WidgetActionType;
  targetScreenId: string;
  targetWidgetId: string;
  error?: string;
};

type EventDraftMap = Record<WidgetEventType, EventBindingDraft>;

function createEmptyDraft(): EventBindingDraft {
  return {
    actionType: "none",
    targetScreenId: "",
    targetWidgetId: "",
  };
}

function buildDraftMap(bindings: WidgetEventBindings | undefined): EventDraftMap {
  const clicked = bindings?.clicked;
  const pressed = bindings?.pressed;
  const valueChanged = bindings?.value_changed;

  return {
    clicked: clicked
      ? {
          actionType: clicked.action.type,
          targetScreenId: clicked.action.type === "switch_screen" ? clicked.action.targetScreenId : "",
          targetWidgetId: clicked.action.type === "toggle_visibility" ? clicked.action.targetWidgetId : "",
        }
      : createEmptyDraft(),
    pressed: pressed
      ? {
          actionType: pressed.action.type,
          targetScreenId: pressed.action.type === "switch_screen" ? pressed.action.targetScreenId : "",
          targetWidgetId: pressed.action.type === "toggle_visibility" ? pressed.action.targetWidgetId : "",
        }
      : createEmptyDraft(),
    value_changed: valueChanged
      ? {
          actionType: valueChanged.action.type,
          targetScreenId: valueChanged.action.type === "switch_screen" ? valueChanged.action.targetScreenId : "",
          targetWidgetId: valueChanged.action.type === "toggle_visibility" ? valueChanged.action.targetWidgetId : "",
        }
      : createEmptyDraft(),
  };
}

export function EventBindingsPanel({ showHeader = true }: { showHeader?: boolean }) {
  const [drafts, setDrafts] = useState<EventDraftMap>({
    clicked: createEmptyDraft(),
    pressed: createEmptyDraft(),
    value_changed: createEmptyDraft(),
  });

  const {
    state: {
      project,
      selectedWidgetIds,
    },
    actions: { upsertWidgetEventBinding, removeWidgetEventBinding, batchUpsertWidgetEventBinding, batchRemoveWidgetEventBinding },
  } = useEditorBackend();

  const activeScreen = getActiveScreenFromProject(project);
  const activeScreenNodeIds = useMemo(() => collectSubtreeIds(project, activeScreen.rootNodeId), [project, activeScreen.rootNodeId]);
  const selectedWidget = selectedWidgetIds.length === 1 && selectedWidgetIds[0] && activeScreenNodeIds.has(selectedWidgetIds[0])
    ? getWidgetById(project, selectedWidgetIds[0])
    : null;

  const screenOptions = project.screens;
  const widgetOptions = useMemo(
    () => Object.values(project.widgetsById).filter((widget) => activeScreenNodeIds.has(widget.id) && widget.id !== activeScreen.rootNodeId),
    [project.widgetsById, activeScreenNodeIds, activeScreen.rootNodeId],
  );

  useEffect(() => {
    setDrafts(buildDraftMap(selectedWidget?.eventBindings));
  }, [selectedWidget]);

  const setDraft = (event: WidgetEventType, updater: (prev: EventBindingDraft) => EventBindingDraft) => {
    setDrafts((prev) => ({
      ...prev,
      [event]: updater(prev[event]),
    }));
  };

  const applyDraft = (event: WidgetEventType) => {
    if (!selectedWidget) {
      return;
    }

    const draft = drafts[event];
    if (draft.actionType === "none") {
      removeWidgetEventBinding(selectedWidget.id, event);
      setDraft(event, (prev) => ({ ...prev, error: undefined }));
      return;
    }

    if (draft.actionType === "switch_screen") {
      if (!screenOptions.some((screen) => screen.id === draft.targetScreenId)) {
        setDraft(event, (prev) => ({ ...prev, error: "请选择有效的目标 Screen" }));
        return;
      }

      upsertWidgetEventBinding(selectedWidget.id, {
        event,
        action: {
          type: "switch_screen",
          targetScreenId: draft.targetScreenId,
        },
      });
      setDraft(event, (prev) => ({ ...prev, error: undefined }));
      return;
    }

    const targetWidget = project.widgetsById[draft.targetWidgetId];
    if (!targetWidget) {
      setDraft(event, (prev) => ({ ...prev, error: "请选择有效的目标 Widget" }));
      return;
    }

    upsertWidgetEventBinding(selectedWidget.id, {
      event,
      action: {
        type: "toggle_visibility",
        targetWidgetId: draft.targetWidgetId,
      },
    });
    setDraft(event, (prev) => ({ ...prev, error: undefined }));
  };

  if (selectedWidgetIds.length === 0) {
    return (
      <div className="h-full bg-[#2c2c2c] border-l border-[#1e1e1e] flex items-center justify-center">
        <div className="text-sm text-gray-500 text-center px-4">
          Select a widget to configure events
        </div>
      </div>
    );
  }

  if (selectedWidgetIds.length > 1) {
    const validIds = selectedWidgetIds.filter((id) => activeScreenNodeIds.has(id) && Boolean(project.widgetsById[id]));

    const applyBatch = (event: WidgetEventType) => {
      const draft = drafts[event];
      if (draft.actionType === "none") {
        batchRemoveWidgetEventBinding(validIds, event);
        setDraft(event, (prev) => ({ ...prev, error: undefined }));
        return;
      }
      if (draft.actionType === "switch_screen") {
        if (!screenOptions.some((s) => s.id === draft.targetScreenId)) {
          setDraft(event, (prev) => ({ ...prev, error: "请选择有效的目标 Screen" }));
          return;
        }
        batchUpsertWidgetEventBinding(validIds, { event, action: { type: "switch_screen", targetScreenId: draft.targetScreenId } });
        setDraft(event, (prev) => ({ ...prev, error: undefined }));
        return;
      }
      if (!project.widgetsById[draft.targetWidgetId]) {
        setDraft(event, (prev) => ({ ...prev, error: "请选择有效的目标 Widget" }));
        return;
      }
      batchUpsertWidgetEventBinding(validIds, { event, action: { type: "toggle_visibility", targetWidgetId: draft.targetWidgetId } });
      setDraft(event, (prev) => ({ ...prev, error: undefined }));
    };

    return (
      <div className="h-full bg-[#2c2c2c] border-l border-[#1e1e1e] flex flex-col">
        {showHeader ? (
          <div className="h-10 flex items-center px-3 border-b border-[#1e1e1e]">
            <span className="text-xs font-semibold text-gray-400">EVENTS</span>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-[#1e1e1e]">
            <div className="text-xs text-gray-500 mb-1">MULTI-SELECT</div>
            <div className="font-semibold text-gray-100">{selectedWidgetIds.length} widgets selected</div>
            <div className="text-xs text-gray-400 mt-1">Batch event binding</div>
          </div>
          <div className="p-3 space-y-4">
            {EVENT_OPTIONS.map((eventOption) => {
              const draft = drafts[eventOption.value];
              return (
                <div key={eventOption.value} className="rounded border border-[#3a3a3a] bg-[#252525] p-3 space-y-2">
                  <div className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{eventOption.label}</div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-500">Action</label>
                    <select
                      className="w-full rounded border border-[#3f3f3f] bg-[#1f1f1f] px-2 py-1.5 text-xs text-gray-200"
                      value={draft.actionType}
                      onChange={(e) => {
                        const nextType = e.currentTarget.value as EventBindingDraft["actionType"];
                        setDraft(eventOption.value, (prev) => ({ ...prev, actionType: nextType, error: undefined }));
                      }}
                    >
                      <option value="none">None</option>
                      <option value="switch_screen">Switch Screen</option>
                      <option value="toggle_visibility">Toggle Visibility</option>
                    </select>
                  </div>
                  {draft.actionType === "switch_screen" && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-500">Target Screen</label>
                      <select
                        className="w-full rounded border border-[#3f3f3f] bg-[#1f1f1f] px-2 py-1.5 text-xs text-gray-200"
                        value={draft.targetScreenId}
                        onChange={(e) => setDraft(eventOption.value, (prev) => ({ ...prev, targetScreenId: e.currentTarget.value, error: undefined }))}
                      >
                        <option value="">Select screen</option>
                        {screenOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  {draft.actionType === "toggle_visibility" && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-500">Target Widget</label>
                      <select
                        className="w-full rounded border border-[#3f3f3f] bg-[#1f1f1f] px-2 py-1.5 text-xs text-gray-200"
                        value={draft.targetWidgetId}
                        onChange={(e) => setDraft(eventOption.value, (prev) => ({ ...prev, targetWidgetId: e.currentTarget.value, error: undefined }))}
                      >
                        <option value="">Select widget</option>
                        {widgetOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  )}
                  {draft.error && <div className="text-[11px] text-rose-400">{draft.error}</div>}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      className="rounded bg-[#5b9dd9] px-2.5 py-1 text-xs text-white hover:bg-[#6ba8dd]"
                      onClick={() => applyBatch(eventOption.value)}
                    >
                      Apply All
                    </button>
                    <button
                      className="rounded border border-[#4a4a4a] px-2.5 py-1 text-xs text-gray-300 hover:bg-[#333333]"
                      onClick={() => {
                        batchRemoveWidgetEventBinding(validIds, eventOption.value);
                        setDraft(eventOption.value, () => createEmptyDraft());
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!selectedWidget) {
    return (
      <div className="h-full bg-[#2c2c2c] border-l border-[#1e1e1e] flex items-center justify-center">
        <div className="text-sm text-gray-500 text-center px-4">
          Selected widget was not found in current screen
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#2c2c2c] border-l border-[#1e1e1e] flex flex-col">
      {showHeader ? (
        <div className="h-10 flex items-center px-3 border-b border-[#1e1e1e]">
          <span className="text-xs font-semibold text-gray-400">EVENTS</span>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        <div className="p-3 border-b border-[#1e1e1e]">
          <div className="text-xs text-gray-500 mb-1">SELECTED WIDGET</div>
          <div className="font-semibold text-gray-100">{selectedWidget.name}</div>
          <div className="text-xs text-gray-400 mt-1">{selectedWidget.type}</div>
        </div>

        <div className="p-3 space-y-4">
          {EVENT_OPTIONS.map((eventOption) => {
            const draft = drafts[eventOption.value];

            return (
              <div key={eventOption.value} className="rounded border border-[#3a3a3a] bg-[#252525] p-3 space-y-2">
                <div className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{eventOption.label}</div>

                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500">Action</label>
                  <select
                    className="w-full rounded border border-[#3f3f3f] bg-[#1f1f1f] px-2 py-1.5 text-xs text-gray-200"
                    value={draft.actionType}
                    onChange={(event) => {
                      const nextType = event.currentTarget.value as EventBindingDraft["actionType"];
                      setDraft(eventOption.value, (prev) => ({
                        ...prev,
                        actionType: nextType,
                        error: undefined,
                      }));
                    }}
                  >
                    <option value="none">None</option>
                    <option value="switch_screen">Switch Screen</option>
                    <option value="toggle_visibility">Toggle Visibility</option>
                  </select>
                </div>

                {draft.actionType === "switch_screen" ? (
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-500">Target Screen</label>
                    <select
                      className="w-full rounded border border-[#3f3f3f] bg-[#1f1f1f] px-2 py-1.5 text-xs text-gray-200"
                      value={draft.targetScreenId}
                      onChange={(event) => {
                        const targetScreenId = event.currentTarget.value;
                        setDraft(eventOption.value, (prev) => ({
                          ...prev,
                          targetScreenId,
                          error: undefined,
                        }));
                      }}
                    >
                      <option value="">Select screen</option>
                      {screenOptions.map((screen) => (
                        <option key={screen.id} value={screen.id}>{screen.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {draft.actionType === "toggle_visibility" ? (
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-500">Target Widget</label>
                    <select
                      className="w-full rounded border border-[#3f3f3f] bg-[#1f1f1f] px-2 py-1.5 text-xs text-gray-200"
                      value={draft.targetWidgetId}
                      onChange={(event) => {
                        const targetWidgetId = event.currentTarget.value;
                        setDraft(eventOption.value, (prev) => ({
                          ...prev,
                          targetWidgetId,
                          error: undefined,
                        }));
                      }}
                    >
                      <option value="">Select widget</option>
                      {widgetOptions.map((widget) => (
                        <option key={widget.id} value={widget.id}>{widget.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {draft.error ? (
                  <div className="text-[11px] text-rose-400">{draft.error}</div>
                ) : null}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    className="rounded bg-[#5b9dd9] px-2.5 py-1 text-xs text-white hover:bg-[#6ba8dd]"
                    onClick={() => applyDraft(eventOption.value)}
                  >
                    Apply
                  </button>
                  <button
                    className="rounded border border-[#4a4a4a] px-2.5 py-1 text-xs text-gray-300 hover:bg-[#333333]"
                    onClick={() => {
                      removeWidgetEventBinding(selectedWidget.id, eventOption.value);
                      setDraft(eventOption.value, () => createEmptyDraft());
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
