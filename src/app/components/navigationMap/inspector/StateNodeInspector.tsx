// StateNodeInspector — side panel shown when exactly one StateNode is
// selected on the Navigation Map.
// See `dev-plan/interaction-design-framework/02-navigation-map.md` §6.

import { useEffect, useState } from "react";
import { CornerDownRight, Flag, Trash2 } from "lucide-react";
import type { StateNode } from "../../../backend/types/navigationMap";
import type { ScreenGroup } from "../../../backend/types/screenGroup";

export interface StateNodeInspectorProps {
  node: StateNode;
  isInitial: boolean;
  screenGroups: ScreenGroup[];
  onRename(name: string): void;
  onColorChange(color: string | undefined): void;
  onScreenGroupChange(groupId: string | null): void;
  onSetInitial(): void;
  onToggleNavigationState(next: boolean): void;
  onZoomInto?(): void;
  onDelete?(): void;
}

const PRESET_COLORS: Array<{ value: string; label: string }> = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#a855f7", label: "Purple" },
  { value: "#14b8a6", label: "Teal" },
];

const ROW_LABEL = "block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 mb-1";
const INPUT_CLASS =
  "w-full rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-400";
const BUTTON_CLASS =
  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-neutral-200 bg-neutral-900 border border-neutral-700 hover:bg-neutral-700 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40";

/**
 * StateNodeInspector — renders the single-node inspector panel. Controlled
 * at the string level through `onRename` so edits debounce at the caller.
 */
export function StateNodeInspector({
  node,
  isInitial,
  screenGroups,
  onRename,
  onColorChange,
  onScreenGroupChange,
  onSetInitial,
  onToggleNavigationState,
  onZoomInto,
  onDelete,
}: StateNodeInspectorProps) {
  const [name, setName] = useState(node.name);

  useEffect(() => {
    setName(node.name);
  }, [node.id, node.name]);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== node.name) onRename(trimmed);
    else setName(node.name);
  };

  const selectedColor = node.color;

  return (
    <div className="flex flex-col gap-4 p-4 text-neutral-100">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400">
            State Node
          </p>
          <h3 className="text-sm font-semibold text-neutral-100">{node.name}</h3>
        </div>
        {isInitial ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-600/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-400">
            <Flag className="h-3 w-3" /> Initial
          </span>
        ) : null}
      </header>

      <div>
        <label className={ROW_LABEL} htmlFor="state-node-name">
          Name
        </label>
        <input
          id="state-node-name"
          className={INPUT_CLASS}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setName(node.name);
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
      </div>

      <div>
        <span className={ROW_LABEL}>Color</span>
        <div className="flex flex-wrap items-center gap-1">
          {PRESET_COLORS.map((preset) => {
            const active = selectedColor === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={active}
                onClick={() => onColorChange(preset.value)}
                className={
                  "h-6 w-6 rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-400 " +
                  (active ? "border-blue-400" : "border-neutral-700")
                }
                style={{ backgroundColor: preset.value }}
              />
            );
          })}
          <button
            type="button"
            onClick={() => onColorChange(undefined)}
            className={
              "h-6 w-6 rounded-md border text-[10px] text-neutral-300 focus:outline-none focus:ring-1 focus:ring-blue-400 " +
              (selectedColor === undefined ? "border-blue-400" : "border-neutral-700")
            }
            title="Use default"
          >
            —
          </button>
        </div>
      </div>

      <div>
        <label className={ROW_LABEL} htmlFor="state-node-group">
          Screen group
        </label>
        <select
          id="state-node-group"
          className={INPUT_CLASS}
          value={node.screenGroupId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            onScreenGroupChange(val === "" ? null : val);
          }}
        >
          <option value="">Unassigned</option>
          {screenGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between rounded-md bg-neutral-900 px-3 py-2 border border-neutral-700">
        <div>
          <p className="text-sm text-neutral-100">Navigation state</p>
          <p className="text-[11px] text-neutral-400">
            Hide local-only UI states from the top map.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={node.isNavigationState}
            onChange={(e) => onToggleNavigationState(e.target.checked)}
          />
          <span className="relative h-5 w-9 rounded-full bg-neutral-700 peer-checked:bg-blue-500 transition-colors">
            <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-neutral-100 transition-transform peer-checked:translate-x-4" />
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BUTTON_CLASS}
          onClick={onSetInitial}
          disabled={isInitial}
        >
          <Flag className="h-3.5 w-3.5" /> Mark initial
        </button>
        {onZoomInto ? (
          <button type="button" className={BUTTON_CLASS} onClick={onZoomInto}>
            <CornerDownRight className="h-3.5 w-3.5" /> Open board
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-300 bg-red-950/50 border border-red-900 hover:bg-red-900/60 focus:outline-none focus:ring-1 focus:ring-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
