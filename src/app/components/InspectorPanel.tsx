import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  findWidgetById,
  getActiveScreenFromProject,
  useEditorBackend,
  type EditableWidgetProperty,
  type EditableWidgetPropertyValue,
  type WidgetNode,
} from "../backend/editorStore";

type InspectorFieldType = "number" | "text" | "color" | "boolean";

interface InspectorField {
  key: EditableWidgetProperty;
  label: string;
  type: InspectorFieldType;
  section: "position" | "style" | "text" | "flags";
  unit?: string;
  min?: number;
  max?: number;
  required?: boolean;
}

type DraftMap = Partial<Record<EditableWidgetProperty, string | boolean>>;
type ErrorMap = Partial<Record<EditableWidgetProperty, string>>;

const FIELD_CONFIG: Record<EditableWidgetProperty, InspectorField> = {
  x: { key: "x", label: "X", type: "number", section: "position", unit: "px", min: -4096, max: 4096 },
  y: { key: "y", label: "Y", type: "number", section: "position", unit: "px", min: -4096, max: 4096 },
  width: { key: "width", label: "Width", type: "number", section: "position", unit: "px", min: 24, max: 4096 },
  height: { key: "height", label: "Height", type: "number", section: "position", unit: "px", min: 24, max: 4096 },
  text: { key: "text", label: "Text", type: "text", section: "text" },
  fill: { key: "fill", label: "Background", type: "color", section: "style" },
  textColor: { key: "textColor", label: "Text Color", type: "color", section: "style" },
  visible: { key: "visible", label: "Visible", type: "boolean", section: "flags" },
};

const WIDGET_FIELD_SCHEMA: Record<WidgetNode["type"], EditableWidgetProperty[]> = {
  Screen: ["width", "height", "fill", "visible"],
  Container: ["x", "y", "width", "height", "fill", "visible"],
  Panel: ["x", "y", "width", "height", "fill", "visible"],
  Label: ["x", "y", "width", "height", "text", "textColor", "visible"],
  Button: ["x", "y", "width", "height", "text", "fill", "textColor", "visible"],
  Slider: ["x", "y", "width", "height", "fill", "visible"],
  Switch: ["x", "y", "width", "height", "fill", "visible"],
  Image: ["x", "y", "width", "height", "fill", "visible"],
};

function getDefaultFill(widgetType: WidgetNode["type"]): string {
  if (widgetType === "Screen") {
    return "#1f2937";
  }
  if (widgetType === "Container") {
    return "#252525";
  }
  if (widgetType === "Panel") {
    return "#111827";
  }
  if (widgetType === "Button") {
    return "#3b82f6";
  }
  if (widgetType === "Image") {
    return "#374151";
  }
  return "#1e1e1e";
}

function getDefaultTextColor(widgetType: WidgetNode["type"]): string {
  if (widgetType === "Label") {
    return "#f3f4f6";
  }
  if (widgetType === "Button") {
    return "#ffffff";
  }
  return "#ffffff";
}

function getWidgetPropertyDraftValue(widget: WidgetNode, key: EditableWidgetProperty): string | boolean {
  switch (key) {
    case "x":
      return String(widget.x);
    case "y":
      return String(widget.y);
    case "width":
      return String(widget.width);
    case "height":
      return String(widget.height);
    case "text":
      return widget.text ?? "";
    case "fill":
      return widget.fill ?? getDefaultFill(widget.type);
    case "textColor":
      return widget.textColor ?? getDefaultTextColor(widget.type);
    case "visible":
      return widget.visible ?? true;
    default:
      return "";
  }
}

function buildDrafts(widget: WidgetNode, fields: InspectorField[]): DraftMap {
  return fields.reduce<DraftMap>((acc, field) => {
    acc[field.key] = getWidgetPropertyDraftValue(widget, field.key);
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

export function InspectorPanel() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    position: true,
    style: true,
    text: true,
    flags: true,
  });
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [errors, setErrors] = useState<ErrorMap>({});

  const {
    state: {
      project,
      selectedWidgetIds,
    },
    actions: { updateWidgetProperty },
  } = useEditorBackend();

  const activeScreen = getActiveScreenFromProject(project);
  const selectedWidget = selectedWidgetIds.length === 1 && selectedWidgetIds[0]
    ? findWidgetById(activeScreen.rootWidget, selectedWidgetIds[0])
    : null;

  const activeFields = useMemo(() => {
    if (!selectedWidget) {
      return [] as InspectorField[];
    }

    return WIDGET_FIELD_SCHEMA[selectedWidget.type].map((fieldKey) => FIELD_CONFIG[fieldKey]);
  }, [selectedWidget]);

  const sectionFields = useMemo(
    () => ({
      position: activeFields.filter((field) => field.section === "position"),
      style: activeFields.filter((field) => field.section === "style"),
      text: activeFields.filter((field) => field.section === "text"),
      flags: activeFields.filter((field) => field.section === "flags"),
    }),
    [activeFields],
  );

  useEffect(() => {
    if (!selectedWidget) {
      setDrafts({});
      setErrors({});
      return;
    }

    setDrafts(buildDrafts(selectedWidget, activeFields));
    setErrors({});
  }, [selectedWidget, activeFields]);

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
    if (!selectedWidget) {
      return;
    }

    setDrafts((prev) => ({
      ...prev,
      [field.key]: getWidgetPropertyDraftValue(selectedWidget, field.key),
    }));
    setErrors((prev) => ({ ...prev, [field.key]: undefined }));
  };

  const commitField = (field: InspectorField) => {
    if (!selectedWidget) {
      return;
    }

    const draftValue = drafts[field.key];
    if (draftValue === undefined) {
      return;
    }

    const result = validateField(selectedWidget, field, draftValue);
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [field.key]: result.error }));
      return;
    }

    setDrafts((prev) => ({ ...prev, [field.key]: result.display }));
    setErrors((prev) => ({ ...prev, [field.key]: undefined }));

    const currentValue = getWidgetPropertyDraftValue(selectedWidget, field.key);
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
        <div className="text-sm text-gray-500 text-center px-4">
          Select a widget to view properties
        </div>
      </div>
    );
  }

  if (selectedWidgetIds.length > 1) {
    return (
      <div className="h-full bg-[#2c2c2c] border-l border-[#1e1e1e] flex items-center justify-center">
        <div className="text-sm text-gray-400 text-center px-4 space-y-2">
          <div>{selectedWidgetIds.length} widgets selected</div>
          <div className="text-xs text-gray-500">Inspector editing for multi-select will be added later.</div>
          <div className="text-xs text-gray-500">Select a single widget to edit properties.</div>
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

  const selectionLabel = selectedWidget.name;

  return (
    <div className="h-full bg-[#2c2c2c] border-l border-[#1e1e1e] flex flex-col">
      <div className="h-10 flex items-center px-3 border-b border-[#1e1e1e]">
        <span className="text-xs font-semibold text-gray-400">INSPECTOR</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {/* Widget Info */}
        <div className="p-3 border-b border-[#1e1e1e]">
          <div className="text-xs text-gray-500 mb-1">SELECTED WIDGET</div>
          <div className="font-semibold text-gray-100">{selectionLabel}</div>
          <div className="text-xs text-gray-400 mt-1">{selectedWidget.type}</div>
        </div>

        {/* Position & Size Section */}
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
              onChange={(nextValue) => setDraft(field, nextValue)}
              onBlur={() => commitField(field)}
              onKeyDown={(event) => handleInputKeyDown(event, field)}
            />
          ))}
        </PropertySection>

        {/* Style Section */}
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
              error={errors[field.key]}
              onChange={(nextValue) => setDraft(field, nextValue)}
              onBlur={() => commitField(field)}
              onKeyDown={(event) => handleInputKeyDown(event, field)}
            />
          ))}
        </PropertySection>

        {/* Text Section */}
        <PropertySection
          title="Text"
          expanded={expandedSections.text}
          onToggle={() => toggleSection("text")}
        >
          {sectionFields.text.length === 0 ? (
            <div className="text-xs text-gray-500">No text properties for this widget.</div>
          ) : (
            sectionFields.text.map((field) => (
              <TextProperty
                key={field.key}
                label={field.label}
                value={String(drafts[field.key] ?? "")}
                error={errors[field.key]}
                onChange={(nextValue) => setDraft(field, nextValue)}
                onBlur={() => commitField(field)}
                onKeyDown={(event) => handleInputKeyDown(event, field)}
              />
            ))
          )}
        </PropertySection>

        {/* Flags Section */}
        <PropertySection
          title="Flags & States"
          expanded={expandedSections.flags}
          onToggle={() => toggleSection("flags")}
        >
          {sectionFields.flags.map((field) => (
            <CheckboxProperty
              key={field.key}
              label={field.label}
              checked={Boolean(drafts[field.key])}
              error={errors[field.key]}
              onCheckedChange={(checked) => {
                setDraft(field, checked);
                commitField(field);
              }}
            />
          ))}
        </PropertySection>
      </div>
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
  onBlur: () => void;
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
            onChange={(event) => onChange(event.target.value)}
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
  error,
  onChange,
  onBlur,
  onKeyDown,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            className="w-8 h-6 bg-[#252525] border border-[#3c3c3c] rounded cursor-pointer"
          />
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            className="w-24 px-2 py-1 bg-[#252525] border border-[#3c3c3c] rounded text-xs focus:border-[#5b9dd9] outline-none text-gray-200"
          />
        </div>
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
  onBlur: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="w-4 h-4 bg-[#252525] border border-[#3c3c3c] rounded cursor-pointer accent-[#5b9dd9]"
        />
        <label className="text-xs text-gray-300">{label}</label>
      </div>
      {error ? <div className="text-[11px] text-rose-400">{error}</div> : null}
    </div>
  );
}