import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  collectSubtreeIds,
  getActiveScreenFromProject,
  getWidgetById,
  useEditorBackend,
  type EditableWidgetProperty,
  type EditableWidgetPropertyValue,
  type WidgetNode,
} from "../backend/editorStore";
import type { ProjectSnapshot } from "../backend/types";
import {
  getWidgetStyleTokenId,
  resolveWidgetColor,
} from "../backend/validation";

type InspectorFieldType = "number" | "text" | "color" | "boolean";

interface InspectorField {
  key: EditableWidgetProperty;
  label: string;
  type: InspectorFieldType;
  section: "position" | "style" | "text" | "flags" | "state";
  unit?: string;
  min?: number;
  max?: number;
  required?: boolean;
}

type DraftMap = Partial<Record<EditableWidgetProperty, string | boolean>>;
type ErrorMap = Partial<Record<EditableWidgetProperty, string>>;

type ColorPropertyKey = Extract<EditableWidgetProperty, "fill" | "textColor">;

const FIELD_CONFIG: Record<EditableWidgetProperty, InspectorField> = {
  x: { key: "x", label: "X", type: "number", section: "position", unit: "px", min: -4096, max: 4096 },
  y: { key: "y", label: "Y", type: "number", section: "position", unit: "px", min: -4096, max: 4096 },
  width: { key: "width", label: "Width", type: "number", section: "position", unit: "px", min: 24, max: 4096 },
  height: { key: "height", label: "Height", type: "number", section: "position", unit: "px", min: 24, max: 4096 },
  text: { key: "text", label: "Text", type: "text", section: "text" },
  fill: { key: "fill", label: "Background", type: "color", section: "style" },
  textColor: { key: "textColor", label: "Text Color", type: "color", section: "style" },
  visible: { key: "visible", label: "Visible", type: "boolean", section: "flags" },
  value: { key: "value", label: "Value", type: "number", section: "state", unit: "%", min: 0, max: 100 },
  checked: { key: "checked", label: "Checked", type: "boolean", section: "state" },
};

// Position + style fields only; content/state/flags handled per-widget below
const WIDGET_FIELD_SCHEMA: Record<WidgetNode["type"], EditableWidgetProperty[]> = {
  Screen:    ["width", "height", "fill"],
  Container: ["x", "y", "width", "height", "fill"],
  Panel:     ["x", "y", "width", "height", "fill"],
  Label:     ["x", "y", "width", "height", "text", "textColor"],
  Button:    ["x", "y", "width", "height", "fill", "textColor", "checked"],
  Slider:    ["x", "y", "width", "height", "fill", "value"],
  Switch:    ["x", "y", "width", "height", "fill", "checked"],
  Checkbox:  ["x", "y", "width", "height", "text", "fill", "textColor", "checked"],
  Radio:     ["x", "y", "width", "height", "fill", "textColor"],
  Dropdown:  ["x", "y", "width", "height", "fill", "textColor"],
  Image:     ["x", "y", "width", "height", "fill"],
};

// Widgets that show a "Content" setup section
const WIDGET_HAS_CONTENT = new Set<WidgetNode["type"]>(["Label", "Button", "Checkbox", "Radio", "Dropdown"]);
// Widgets that show a generic "Initial State" section
const WIDGET_HAS_INITIAL_STATE = new Set<WidgetNode["type"]>(["Slider", "Switch"]);

function getWidgetPropertyDraftValue(project: ProjectSnapshot, widget: WidgetNode, key: EditableWidgetProperty): string | boolean {
  switch (key) {
    case "x":        return String(widget.x);
    case "y":        return String(widget.y);
    case "width":    return String(widget.width);
    case "height":   return String(widget.height);
    case "text":     return widget.text ?? "";
    case "fill":     return resolveWidgetColor(project, widget, "fill");
    case "textColor": return resolveWidgetColor(project, widget, "textColor");
    case "visible":  return widget.visible ?? true;
    case "value":    return String(widget.value ?? 0);
    case "checked":  return widget.checked ?? false;
    default:         return "";
  }
}

function buildDrafts(project: ProjectSnapshot, widget: WidgetNode, fields: InspectorField[]): DraftMap {
  return fields.reduce<DraftMap>((acc, field) => {
    acc[field.key] = getWidgetPropertyDraftValue(project, widget, field.key);
    return acc;
  }, {});
}

function validateField(
  widget: WidgetNode,
  field: InspectorField,
  draft: string | boolean,
):
  | { ok: true; normalized: EditableWidgetPropertyValue; display: string | boolean }
  | { ok: false; error: string } {
  if (field.type === "boolean") {
    if (typeof draft !== "boolean") {
      return { ok: false, error: `${field.label} must be true or false` };
    }
    return { ok: true, normalized: draft, display: draft };
  }

  if (field.type === "number") {
    if (typeof draft !== "string" || !draft.trim()) {
      return { ok: false, error: `${field.label} is required` };
    }
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      return { ok: false, error: `${field.label} must be a valid number` };
    }
    const rounded = Math.round(parsed);
    if (field.min !== undefined && rounded < field.min) {
      return { ok: false, error: `${field.label} must be >= ${field.min}` };
    }
    if (field.max !== undefined && rounded > field.max) {
      return { ok: false, error: `${field.label} must be <= ${field.max}` };
    }
    return { ok: true, normalized: rounded, display: String(rounded) };
  }

  if (field.type === "color") {
    if (typeof draft !== "string") {
      return { ok: false, error: `${field.label} must be a string` };
    }
    const normalizedColor = draft.trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizedColor)) {
      return { ok: false, error: `${field.label} must be a hex color like #1f2937` };
    }
    return { ok: true, normalized: normalizedColor, display: normalizedColor };
  }

  if (typeof draft !== "string") {
    return { ok: false, error: `${field.label} must be text` };
  }

  const requiredText = field.key === "text" && (widget.type === "Label" || widget.type === "Button");
  if (requiredText && !draft.trim()) {
    return { ok: false, error: `${field.label} cannot be empty` };
  }

  return { ok: true, normalized: draft, display: draft };
}

export function InspectorPanel({ showHeader = true }: { showHeader?: boolean }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    position: true,
    style: true,
    asset: true,
    content: true,
    state: true,
  });
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [errors, setErrors] = useState<ErrorMap>({});

  const {
    state: { project, selectedWidgetIds },
    actions: {
      updateWidgetProperty,
      assignWidgetStyleToken,
      clearWidgetProperty,
      assignWidgetAsset,
      deleteAsset,
      setWidgetOptions,
      setWidgetSelectedOption,
    },
  } = useEditorBackend();

  const activeScreen = getActiveScreenFromProject(project);
  const activeScreenNodeIds = useMemo(
    () => collectSubtreeIds(project, activeScreen.rootNodeId),
    [project, activeScreen.rootNodeId],
  );
  const selectedWidget =
    selectedWidgetIds.length === 1 &&
    selectedWidgetIds[0] &&
    activeScreenNodeIds.has(selectedWidgetIds[0])
      ? getWidgetById(project, selectedWidgetIds[0])
      : null;

  const activeFields = useMemo(() => {
    if (!selectedWidget) return [] as InspectorField[];
    return WIDGET_FIELD_SCHEMA[selectedWidget.type].map((k) => FIELD_CONFIG[k]);
  }, [selectedWidget]);

  const sectionFields = useMemo(
    () => ({
      position: activeFields.filter((f) => f.section === "position"),
      style: activeFields.filter((f) => f.section === "style"),
      state: activeFields.filter((f) => f.section === "state"),
    }),
    [activeFields],
  );

  const assetOptions = useMemo(
    () => Object.values(project.assets).sort((a, b) => a.name.localeCompare(b.name)),
    [project.assets],
  );

  useEffect(() => {
    if (!selectedWidget) {
      setDrafts({});
      setErrors({});
      return;
    }
    setDrafts(buildDrafts(project, selectedWidget, activeFields));
    setErrors({});
  }, [project, selectedWidget, activeFields]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const setDraft = (field: InspectorField, value: string | boolean) => {
    setDrafts((prev) => ({ ...prev, [field.key]: value }));
    if (errors[field.key]) {
      setErrors((prev) => ({ ...prev, [field.key]: undefined }));
    }
  };

  const resetField = (field: InspectorField) => {
    if (!selectedWidget) return;
    if (field.key === "fill" || field.key === "textColor") {
      clearWidgetProperty(selectedWidget.id, field.key);
      setErrors((prev) => ({ ...prev, [field.key]: undefined }));
      return;
    }
    setDrafts((prev) => ({
      ...prev,
      [field.key]: getWidgetPropertyDraftValue(project, selectedWidget, field.key),
    }));
    setErrors((prev) => ({ ...prev, [field.key]: undefined }));
  };

  const commitField = (field: InspectorField, draftOverride?: string | boolean) => {
    if (!selectedWidget) return;
    const draftValue = draftOverride ?? drafts[field.key];
    if (draftValue === undefined) return;
    const result = validateField(selectedWidget, field, draftValue);
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [field.key]: result.error }));
      return;
    }
    setDrafts((prev) => ({ ...prev, [field.key]: result.display }));
    setErrors((prev) => ({ ...prev, [field.key]: undefined }));
    const currentValue = getWidgetPropertyDraftValue(project, selectedWidget, field.key);
    if (currentValue !== result.display) {
      updateWidgetProperty(selectedWidget.id, field.key, result.normalized);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, field: InspectorField) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitField(field);
      event.currentTarget.blur();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      resetField(field);
      event.currentTarget.blur();
    }
  };

  if (selectedWidgetIds.length === 0) {
    return (
      <div className="h-full bg-[#2c2c2c] border-l border-[#1e1e1e] flex items-center justify-center">
        <div className="text-sm text-gray-500 text-center px-4">Select a widget to view properties</div>
      </div>
    );
  }

  if (selectedWidgetIds.length > 1) {
    return (
      <div className="h-full bg-[#2c2c2c] border-l border-[#1e1e1e] flex items-center justify-center">
        <div className="text-sm text-gray-400 text-center px-4 space-y-2">
          <div>{selectedWidgetIds.length} widgets selected</div>
          <div className="text-xs text-gray-500">Select a single widget to edit properties.</div>
        </div>
      </div>
    );
  }

  if (!selectedWidget) {
    return (
      <div className="h-full bg-[#2c2c2c] border-l border-[#1e1e1e] flex items-center justify-center">
        <div className="text-sm text-gray-500 text-center px-4">Selected widget not found in current screen</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#2c2c2c] border-l border-[#1e1e1e] flex flex-col">
      {showHeader ? (
        <div className="h-10 flex items-center px-3 border-b border-[#1e1e1e]">
          <span className="text-xs font-semibold text-gray-400">INSPECTOR</span>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto">
        {/* Widget Info */}
        <div className="p-3 border-b border-[#1e1e1e]">
          <div className="text-xs text-gray-500 mb-1">SELECTED WIDGET</div>
          <div className="font-semibold text-gray-100">{selectedWidget.name}</div>
          <div className="text-xs text-gray-400 mt-1">{selectedWidget.type}</div>
        </div>

        {/* Position & Size */}
        <PropertySection
          title="Position & Size"
          expanded={expandedSections.position}
          onToggle={() => toggleSection("position")}
        >
          {sectionFields.position.map((field) => (
            <PropertyRow
              key={field.key}
              label={field.label}
              value={String(drafts[field.key] ?? "")}
              unit={field.unit}
              error={errors[field.key]}
              onChange={(v) => setDraft(field, v)}
              onBlur={(e) => commitField(field, e.currentTarget.value)}
              onKeyDown={(e) => handleInputKeyDown(e, field)}
            />
          ))}
        </PropertySection>

        {/* Style */}
        <PropertySection
          title="Style"
          expanded={expandedSections.style}
          onToggle={() => toggleSection("style")}
        >
          {sectionFields.style.map((field) => (
            <ColorProperty
              key={field.key}
              label={field.label}
              value={String(drafts[field.key] ?? "")}
              tokenId={getWidgetStyleTokenId(selectedWidget, field.key as ColorPropertyKey) ?? null}
              tokenOptions={project.styleTokens}
              error={errors[field.key]}
              onChange={(v) => setDraft(field, v)}
              onBlur={(e) => commitField(field, e.currentTarget.value)}
              onTokenChange={(tokenId) =>
                assignWidgetStyleToken(selectedWidget.id, field.key as ColorPropertyKey, tokenId)
              }
              onClearOverride={() =>
                clearWidgetProperty(selectedWidget.id, field.key as ColorPropertyKey)
              }
              onKeyDown={(e) => handleInputKeyDown(e, field)}
            />
          ))}
        </PropertySection>

        {/* Asset (Image only) */}
        {selectedWidget.type === "Image" && (
          <PropertySection
            title="Asset"
            expanded={expandedSections.asset}
            onToggle={() => toggleSection("asset")}
          >
            <AssetProperty
              selectedAssetId={selectedWidget.assetId ?? null}
              options={assetOptions}
              onChange={(assetId) => assignWidgetAsset(selectedWidget.id, assetId)}
              onDelete={(assetId) => deleteAsset(assetId)}
            />
          </PropertySection>
        )}

        {/* Content (widget-specific setup) */}
        {WIDGET_HAS_CONTENT.has(selectedWidget.type) && (
          <PropertySection
            title="Content"
            expanded={expandedSections.content}
            onToggle={() => toggleSection("content")}
          >
            <WidgetContentSetup
              widget={selectedWidget}
              drafts={drafts}
              errors={errors}
              onSetDraft={setDraft}
              onCommitField={commitField}
              onInputKeyDown={handleInputKeyDown}
              onSetOptions={(opts) => setWidgetOptions(selectedWidget.id, opts)}
              onSetSelectedOption={(idx) => setWidgetSelectedOption(selectedWidget.id, idx)}
            />
          </PropertySection>
        )}

        {/* Initial State (Slider: value, Switch: checked) */}
        {WIDGET_HAS_INITIAL_STATE.has(selectedWidget.type) && sectionFields.state.length > 0 && (
          <PropertySection
            title="Initial State"
            expanded={expandedSections.state}
            onToggle={() => toggleSection("state")}
          >
            {sectionFields.state.map((field) =>
              field.type === "boolean" ? (
                <CheckboxProperty
                  key={field.key}
                  label={field.label}
                  checked={Boolean(drafts[field.key])}
                  error={errors[field.key]}
                  onCheckedChange={(v) => commitField(field, v)}
                />
              ) : (
                <PropertyRow
                  key={field.key}
                  label={field.label}
                  value={String(drafts[field.key] ?? "")}
                  unit={field.unit}
                  error={errors[field.key]}
                  onChange={(v) => setDraft(field, v)}
                  onBlur={(e) => commitField(field, e.currentTarget.value)}
                  onKeyDown={(e) => handleInputKeyDown(e, field)}
                />
              ),
            )}
          </PropertySection>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget-specific content section
// ---------------------------------------------------------------------------

function WidgetContentSetup({
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
          <div className="text-xs text-gray-500 mb-2">
            设置按钮初始激活状态 (Initial active state)
          </div>
          <CheckboxProperty
            label="Initially Active (Checked)"
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

// ---------------------------------------------------------------------------
// WidgetOptionsProperty — options table for Radio / Dropdown
// ---------------------------------------------------------------------------

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId]);

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
        <span className="text-xs text-gray-400">Options</span>
        <button
          type="button"
          onClick={addOption}
          className="text-xs text-[#5b9dd9] hover:text-blue-300 transition-colors"
        >
          + Add
        </button>
      </div>

      {localOptions.length === 0 && (
        <div className="text-xs text-gray-500 py-1">No options. Click + Add.</div>
      )}

      {localOptions.map((option, index) => (
        <div key={index} className="flex items-center gap-1">
          {widgetType === "Radio" && (
            <input
              type="radio"
              name={`radio-init-${widgetId}`}
              checked={safeSelected === index}
              onChange={() => onSelectedOptionChange(index)}
              className="accent-[#5b9dd9] flex-shrink-0"
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
            className="flex-1 px-2 py-1 bg-[#252525] border border-[#3c3c3c] rounded text-xs focus:border-[#5b9dd9] outline-none text-gray-200 min-w-0"
          />
          <button
            type="button"
            onClick={() => removeOption(index)}
            className="p-1 text-gray-500 hover:text-rose-400 flex-shrink-0 transition-colors"
            title="Remove option"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      {widgetType === "Dropdown" && localOptions.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-[#3c3c3c]">
          <span className="text-xs text-gray-400">Initial Selection</span>
          <select
            value={safeSelected}
            onChange={(e) => onSelectedOptionChange(Number(e.target.value))}
            className="w-full px-2 py-1 bg-[#252525] border border-[#3c3c3c] rounded text-xs text-gray-200 outline-none focus:border-[#5b9dd9]"
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
        <div className="text-[11px] text-gray-500 pt-1">
          点击单选框选择初始选中项 (Click radio to set initial selection)
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function AssetProperty({
  selectedAssetId,
  options,
  onChange,
  onDelete,
}: {
  selectedAssetId: string | null;
  options: ProjectSnapshot["assets"][string][];
  onChange: (assetId: string | null) => void;
  onDelete: (assetId: string) => void;
}) {
  const selectedAsset = selectedAssetId
    ? (options.find((item) => item.id === selectedAssetId) ?? null)
    : null;

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400">Source</div>
      <div className="flex items-center gap-2">
        <Select
          value={selectedAssetId ?? "__none__"}
          onValueChange={(v) => onChange(v === "__none__" ? null : v)}
        >
          <SelectTrigger className="h-8 w-full bg-[#252525] border-[#3c3c3c] text-[11px] text-gray-300">
            <SelectValue placeholder="No asset selected">
              {selectedAsset ? selectedAsset.name : "No asset selected"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No asset selected</SelectItem>
            {options.map((asset) => (
              <SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={!selectedAsset}
          onClick={() => { if (selectedAsset) onDelete(selectedAsset.id); }}
          title="Delete selected asset from project"
        >
          <Trash2 size={12} />
        </Button>
      </div>
      {selectedAsset ? <div className="text-[11px] text-gray-500">{selectedAsset.mimeType}</div> : null}
      {options.length === 0 ? (
        <div className="text-[11px] text-gray-500">Import images from toolbar first.</div>
      ) : null}
    </div>
  );
}

function PropertySection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[#1e1e1e]">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#3c3c3c] transition-colors text-gray-300"
      >
        <span className="text-sm font-semibold">{title}</span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {expanded && <div className="px-3 py-2 space-y-2">{children}</div>}
    </div>
  );
}

function PropertyRow({
  label,
  value,
  unit,
  error,
  onChange,
  onBlur,
  onKeyDown,
}: {
  label: string;
  value: string;
  unit?: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            className="w-20 px-2 py-1 bg-[#252525] border border-[#3c3c3c] rounded text-xs focus:border-[#5b9dd9] outline-none text-gray-200"
          />
          {unit && <span className="text-xs text-gray-500">{unit}</span>}
        </div>
      </div>
      {error ? <div className="text-[11px] text-rose-400">{error}</div> : null}
    </div>
  );
}

function ColorProperty({
  label,
  value,
  tokenId,
  tokenOptions,
  error,
  onChange,
  onBlur,
  onTokenChange,
  onClearOverride,
  onKeyDown,
}: {
  label: string;
  value: string;
  tokenId: string | null;
  tokenOptions: ProjectSnapshot["styleTokens"];
  error?: string;
  onChange: (value: string) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onTokenChange: (tokenId: string | null) => void;
  onClearOverride: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const resolvedToken = tokenId
    ? (tokenOptions.find((t) => t.id === tokenId) ?? null)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className="w-8 h-6 bg-[#252525] border border-[#3c3c3c] rounded cursor-pointer"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            className="w-24 px-2 py-1 bg-[#252525] border border-[#3c3c3c] rounded text-xs focus:border-[#5b9dd9] outline-none text-gray-200"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={tokenId ?? "__none__"}
          onValueChange={(v) => onTokenChange(v === "__none__" ? null : v)}
        >
          <SelectTrigger className="h-8 w-full bg-[#252525] border-[#3c3c3c] text-[11px] text-gray-300">
            <SelectValue placeholder="Use local value">
              {resolvedToken ? (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: resolvedToken.value }}
                  />
                  <span>{resolvedToken.name}</span>
                </span>
              ) : (
                <span>Use local value</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Use local value</SelectItem>
            {tokenOptions.map((token) => (
              <SelectItem key={token.id} value={token.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full border border-white/20"
                    style={{ backgroundColor: token.value }}
                  />
                  <span>{token.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 text-[11px]"
          onClick={onClearOverride}
        >
          Reset
        </Button>
      </div>
      {error ? <div className="text-[11px] text-rose-400">{error}</div> : null}
    </div>
  );
}

function TextProperty({
  label,
  value,
  error,
  onChange,
  onBlur,
  onKeyDown,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="w-full px-2 py-1 bg-[#252525] border border-[#3c3c3c] rounded text-xs focus:border-[#5b9dd9] outline-none text-gray-200"
      />
      {error ? <div className="text-[11px] text-rose-400">{error}</div> : null}
    </div>
  );
}

function CheckboxProperty({
  label,
  checked,
  error,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  error?: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const inputId = `inspector-boolean-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="w-4 h-4 bg-[#252525] border border-[#3c3c3c] rounded cursor-pointer accent-[#5b9dd9]"
        />
        <label htmlFor={inputId} className="text-xs text-gray-300 cursor-pointer">
          {label}
        </label>
      </div>
      {error ? <div className="text-[11px] text-rose-400">{error}</div> : null}
    </div>
  );
}
