import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { WidgetNode } from "../../backend/editorStore";
import {
  type DraftMap,
  type ErrorMap,
  FIELD_CONFIG,
  INSPECTOR_INPUT_CLASS,
  type InspectorField,
} from "./config";
import { CheckboxProperty, TextProperty } from "./SharedControls";

export function WidgetContentSetup({
  widget,
  drafts,
  errors,
  onSetDraft,
  onCommitField,
  onInputKeyDown,
  onSetOptions,
  onSetSelectedOption,
}: {
  widget: WidgetNode;
  drafts: DraftMap;
  errors: ErrorMap;
  onSetDraft: (field: InspectorField, value: string | boolean) => void;
  onCommitField: (field: InspectorField, value?: string | boolean) => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, field: InspectorField) => void;
  onSetOptions: (opts: string[]) => void;
  onSetSelectedOption: (idx: number) => void;
}) {
  switch (widget.type) {
    case "Label":
      return (
        <TextProperty
          label="Text"
          value={String(drafts.text ?? "")}
          error={errors.text}
          onChange={(v) => onSetDraft(FIELD_CONFIG.text, v)}
          onBlur={(e) => onCommitField(FIELD_CONFIG.text, e.currentTarget.value)}
          onKeyDown={(e) => onInputKeyDown(e, FIELD_CONFIG.text)}
        />
      );

    case "Button":
      return (
        <div className="space-y-1">
          <div className="mb-2 text-xs text-neutral-400">
            Initial active state
          </div>
          <CheckboxProperty
            label="Active"
            checked={Boolean(drafts.checked)}
            error={errors.checked}
            onCheckedChange={(v) => onCommitField(FIELD_CONFIG.checked, v)}
          />
        </div>
      );

    case "Checkbox":
      return (
        <div className="space-y-3">
          <TextProperty
            label="Label"
            value={String(drafts.text ?? "")}
            error={errors.text}
            onChange={(v) => onSetDraft(FIELD_CONFIG.text, v)}
            onBlur={(e) => onCommitField(FIELD_CONFIG.text, e.currentTarget.value)}
            onKeyDown={(e) => onInputKeyDown(e, FIELD_CONFIG.text)}
          />
          <CheckboxProperty
            label="Initially Checked"
            checked={Boolean(drafts.checked)}
            error={errors.checked}
            onCheckedChange={(v) => onCommitField(FIELD_CONFIG.checked, v)}
          />
        </div>
      );

    case "Radio": {
      const effectiveOptions = widget.options ?? (widget.text ? [widget.text] : ["Option 1"]);
      const selectedIndex = widget.selectedOptionIndex ?? 0;
      return (
        <WidgetOptionsProperty
          widgetId={widget.id}
          widgetType="Radio"
          options={effectiveOptions}
          selectedOptionIndex={selectedIndex}
          onOptionsChange={onSetOptions}
          onSelectedOptionChange={onSetSelectedOption}
        />
      );
    }

    case "Dropdown": {
      const effectiveOptions =
        widget.options ??
        (widget.text ? widget.text.split("\n") : ["Option 1", "Option 2", "Option 3"]);
      const selectedIndex = widget.selectedOptionIndex ?? 0;
      return (
        <WidgetOptionsProperty
          widgetId={widget.id}
          widgetType="Dropdown"
          options={effectiveOptions}
          selectedOptionIndex={selectedIndex}
          onOptionsChange={onSetOptions}
          onSelectedOptionChange={onSetSelectedOption}
        />
      );
    }

    default:
      return null;
  }
}

function WidgetOptionsProperty({
  widgetId,
  widgetType,
  options,
  selectedOptionIndex,
  onOptionsChange,
  onSelectedOptionChange,
}: {
  widgetId: string;
  widgetType: "Radio" | "Dropdown";
  options: string[];
  selectedOptionIndex: number;
  onOptionsChange: (opts: string[]) => void;
  onSelectedOptionChange: (idx: number) => void;
}) {
  const [localOptions, setLocalOptions] = useState<string[]>(options);

  useEffect(() => {
    setLocalOptions(options);
  }, [widgetId, options]);

  const commitOptions = (opts: string[]) => {
    onOptionsChange(opts);
  };

  const addOption = () => {
    const next = [...localOptions, `Option ${localOptions.length + 1}`];
    setLocalOptions(next);
    onOptionsChange(next);
  };

  const removeOption = (index: number) => {
    const next = localOptions.filter((_, i) => i !== index);
    setLocalOptions(next);
    onOptionsChange(next);
    if (selectedOptionIndex >= next.length) {
      onSelectedOptionChange(Math.max(0, next.length - 1));
    }
  };

  const updateLocal = (index: number, value: string) => {
    const next = [...localOptions];
    next[index] = value;
    setLocalOptions(next);
  };

  const safeSelected = Math.min(selectedOptionIndex, Math.max(0, localOptions.length - 1));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-300">Options</span>
        <button
          type="button"
          onClick={addOption}
          className="text-xs text-highlight-500 transition-colors hover:text-blue-300"
        >
          + Add
        </button>
      </div>

      {localOptions.length === 0 && (
        <div className="py-1 text-xs text-neutral-400">No options. Click + Add.</div>
      )}

      {localOptions.map((option, index) => (
        <div key={index} className="flex items-center gap-1">
          {widgetType === "Radio" && (
            <input
              type="radio"
              name={`radio-init-${widgetId}`}
              checked={safeSelected === index}
              onChange={() => onSelectedOptionChange(index)}
              className="flex-shrink-0 accent-highlight-500"
              title="Set as initial selection"
            />
          )}
          <input
            type="text"
            value={option}
            onChange={(e) => updateLocal(index, e.target.value)}
            onBlur={() => commitOptions(localOptions)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitOptions(localOptions);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className={`min-w-0 flex-1 rounded px-2 py-1 text-xs ${INSPECTOR_INPUT_CLASS}`}
          />
          <button
            type="button"
            onClick={() => removeOption(index)}
            className="flex-shrink-0 p-1 text-neutral-400 transition-colors hover:text-error-400"
            title="Remove option"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      {widgetType === "Dropdown" && localOptions.length > 0 && (
        <div className="space-y-1 border-t border-neutral-600 pt-1">
          <span className="text-xs text-neutral-300">Initial Selection</span>
          <select
            value={safeSelected}
            onChange={(e) => onSelectedOptionChange(Number(e.target.value))}
            className={`w-full rounded px-2 py-1 text-xs ${INSPECTOR_INPUT_CLASS}`}
          >
            {localOptions.map((opt, i) => (
              <option key={i} value={i}>
                {opt.trim() || `Option ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {widgetType === "Radio" && localOptions.length > 0 && (
        <div className="pt-1 text-[11px] text-neutral-400">
          点击单选框选择初始选中项 (Click radio to set initial selection)
        </div>
      )}
    </div>
  );
}
