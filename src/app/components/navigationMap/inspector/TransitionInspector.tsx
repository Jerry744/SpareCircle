// TransitionInspector — side panel shown when exactly one Transition is
// selected on the Navigation Map.
// See `dev-plan/interaction-design-framework/02-navigation-map.md` §6.

import { useEffect, useState } from "react";
import { ArrowLeftRight, ExternalLink, Trash2 } from "lucide-react";
import type { Transition } from "../../../backend/types/navigationMap";
import type { TransitionEventBinding } from "../../../backend/types/eventBinding";

export interface TransitionInspectorProps {
  transition: Transition;
  fromNodeName: string;
  toNodeName: string;
  binding?: TransitionEventBinding;
  onLabelChange(label: string | undefined): void;
  onReverse(): void;
  onDelete(): void;
  onOpenBindingForm?(): void;
}

const ROW_LABEL = "block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 mb-1";
const INPUT_CLASS =
  "w-full rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-400";
const BUTTON_CLASS =
  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-neutral-200 bg-neutral-900 border border-neutral-700 hover:bg-neutral-700 focus:outline-none focus:ring-1 focus:ring-blue-400";

function describeBinding(binding: TransitionEventBinding | undefined): string {
  if (!binding) return "No binding";
  const t = binding.trigger;
  if (t.kind === "widget_event") {
    return `Widget event · ${t.eventType} on ${t.widgetId}`;
  }
  return `System event · ${t.eventType}`;
}

/**
 * TransitionInspector — renders the transition inspector panel. Label edits
 * commit on blur/Enter; reverse/delete/open-binding are pure intents.
 */
export function TransitionInspector({
  transition,
  fromNodeName,
  toNodeName,
  binding,
  onLabelChange,
  onReverse,
  onDelete,
  onOpenBindingForm,
}: TransitionInspectorProps) {
  const [label, setLabel] = useState(transition.label ?? "");

  useEffect(() => {
    setLabel(transition.label ?? "");
  }, [transition.id, transition.label]);

  const commitLabel = () => {
    const trimmed = label.trim();
    const next = trimmed.length > 0 ? trimmed : undefined;
    if (next !== transition.label) onLabelChange(next);
    else setLabel(transition.label ?? "");
  };

  return (
    <div className="flex flex-col gap-4 p-4 text-neutral-100">
      <header>
        <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400">
          Transition
        </p>
        <p className="mt-1 text-sm text-neutral-100">
          <span className="font-medium">{fromNodeName}</span>
          <span className="mx-2 text-neutral-500">→</span>
          <span className="font-medium">{toNodeName}</span>
        </p>
      </header>

      <div>
        <label className={ROW_LABEL} htmlFor="transition-label">
          Label
        </label>
        <input
          id="transition-label"
          className={INPUT_CLASS}
          value={label}
          placeholder="Optional"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setLabel(transition.label ?? "");
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
      </div>

      <div>
        <span className={ROW_LABEL}>Event binding</span>
        <div className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-neutral-300">
          <p>{describeBinding(binding)}</p>
          {binding?.guard ? (
            <p className="mt-1 text-neutral-400">
              <span className="text-neutral-500">Guard:</span> {binding.guard}
            </p>
          ) : null}
        </div>
        {onOpenBindingForm ? (
          <button
            type="button"
            className={`${BUTTON_CLASS} mt-2`}
            onClick={onOpenBindingForm}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open binding form
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON_CLASS} onClick={onReverse}>
          <ArrowLeftRight className="h-3.5 w-3.5" /> Reverse
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-300 bg-red-950/50 border border-red-900 hover:bg-red-900/60 focus:outline-none focus:ring-1 focus:ring-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
