import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import type { ComponentType } from "react";
import type {
  EditableWidgetProperty,
  WidgetNode,
} from "../../backend/editorStore";
import type { AlignmentOperation, ProjectSnapshot } from "../../backend/types";
import {
  FIELD_CONFIG,
  INSPECTOR_PANEL_CLASS,
  type InspectorField,
  WIDGET_FIELD_SCHEMA,
} from "./config";
import { BatchColorRow, BatchPropertyRow, PropertySection } from "./SharedControls";
import { getWidgetPropertyDraftValue, validateField } from "./utils";

const ALIGNMENT_ACTIONS: Array<{
  operation: AlignmentOperation;
  label: string;
  title: string;
  kind: "align" | "distribute";
  icon: ComponentType<{ size?: number; className?: string }>;
}> = [
  { operation: "align_left", label: "Left", title: "Align Left", kind: "align", icon: AlignStartVertical },
  { operation: "align_right", label: "Right", title: "Align Right", kind: "align", icon: AlignEndVertical },
  { operation: "align_top", label: "Top", title: "Align Top", kind: "align", icon: AlignStartHorizontal },
  { operation: "align_bottom", label: "Bottom", title: "Align Bottom", kind: "align", icon: AlignEndHorizontal },
  { operation: "align_h_center", label: "H Center", title: "Align Horizontal Center", kind: "align", icon: AlignCenterVertical },
  { operation: "align_v_center", label: "V Center", title: "Align Vertical Center", kind: "align", icon: AlignCenterHorizontal },
  { operation: "distribute_h", label: "Distribute H", title: "Distribute Horizontally", kind: "distribute", icon: AlignHorizontalDistributeCenter },
  { operation: "distribute_v", label: "Distribute V", title: "Distribute Vertically", kind: "distribute", icon: AlignVerticalDistributeCenter },
];

export function MultiSelectInspector({
  showHeader,
  project,
  selectedWidgetIds,
  selectedWidgets,
  expandedSections,
  toggleSection,
  batchUpdateWidgetProperty,
  applyAlignmentOperation,
}: {
  showHeader: boolean;
  project: ProjectSnapshot;
  selectedWidgetIds: string[];
  selectedWidgets: WidgetNode[];
  expandedSections: Record<string, boolean>;
  toggleSection: (section: string) => void;
  batchUpdateWidgetProperty: (
    widgetIds: string[],
    property: EditableWidgetProperty,
    value: string | number | boolean,
  ) => void;
  applyAlignmentOperation: (operation: AlignmentOperation) => void;
}) {
  if (selectedWidgets.length === 0) {
    return (
      <div className={`${INSPECTOR_PANEL_CLASS} flex items-center justify-center`}>
        <div className="px-4 text-center text-sm text-neutral-400">No valid widgets selected</div>
      </div>
    );
  }

  const firstType = selectedWidgets[0].type;
  const sharedKeys = WIDGET_FIELD_SCHEMA[firstType].filter((key) =>
    selectedWidgets.every((w) => WIDGET_FIELD_SCHEMA[w.type].includes(key)),
  );
  const sharedFields = sharedKeys.map((k) => FIELD_CONFIG[k]);

  const aggregated: Partial<Record<EditableWidgetProperty, string | boolean | "Mixed">> = {};
  for (const field of sharedFields) {
    const values = selectedWidgets.map((w) => getWidgetPropertyDraftValue(project, w, field.key));
    aggregated[field.key] = values.every((v) => v === values[0]) ? values[0] : "Mixed";
  }

  const batchCommit = (field: InspectorField, value: string | boolean) => {
    const result = validateField(selectedWidgets[0], field, value);
    if (!result.ok) return;
    batchUpdateWidgetProperty(selectedWidgetIds, field.key, result.normalized);
  };

  const posFields = sharedFields.filter((f) => f.section === "position");
  const styleFields = sharedFields.filter((f) => f.section === "style");
  const flagFields = sharedFields.filter((f) => f.section === "flags");
  const alignDisabled = selectedWidgetIds.length < 2;
  const distributeDisabled = selectedWidgetIds.length < 3;

  return (
    <div className={`${INSPECTOR_PANEL_CLASS} flex flex-col`}>
      {showHeader ? (
        <div className="h-10 flex items-center border-b border-neutral-900 px-3">
          <span className="text-xs font-semibold text-neutral-300">INSPECTOR</span>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-neutral-900 bg-neutral-800/60 p-3">
          <div className="mb-1 text-xs text-neutral-400">MULTI-SELECT</div>
          <div className="font-semibold text-neutral-100">{selectedWidgetIds.length} widgets selected</div>
          <div className="mt-1 text-xs text-neutral-300">Editing shared fields</div>
        </div>

        <PropertySection title="Align & Distribute" expanded={expandedSections.state} onToggle={() => toggleSection("state")}>
          <div className="grid grid-cols-8 gap-1">
            {ALIGNMENT_ACTIONS.map((item) => {
              const disabled = item.kind === "align" ? alignDisabled : distributeDisabled;
              const Icon = item.icon;

              return (
                <button
                  key={item.operation}
                  type="button"
                  title={item.title}
                  aria-label={item.label}
                  disabled={disabled}
                  onClick={() => applyAlignmentOperation(item.operation)}
                  className="inline-flex h-7 w-full items-center justify-center rounded border border-transparent bg-neutral-800 text-neutral-200 transition-colors hover:border-highlight-700 hover:bg-neutral-700 active:border-highlight-500 active:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon size={13} />
                </button>
              );
            })}
          </div>
        </PropertySection>

        {posFields.length > 0 && (
          <PropertySection title="Position & Size" expanded={expandedSections.position} onToggle={() => toggleSection("position")}>
            {posFields.map((field) => (
              <BatchPropertyRow
                key={field.key}
                label={field.label}
                value={aggregated[field.key] as string | boolean}
                unit={field.unit}
                isMixed={aggregated[field.key] === "Mixed"}
                onCommit={(v) => batchCommit(field, v)}
              />
            ))}
          </PropertySection>
        )}

        {styleFields.length > 0 && (
          <PropertySection title="Style" expanded={expandedSections.style} onToggle={() => toggleSection("style")}>
            {styleFields.map((field) => (
              <BatchColorRow
                key={field.key}
                label={field.label}
                value={aggregated[field.key] as string}
                isMixed={aggregated[field.key] === "Mixed"}
                onCommit={(v) => batchCommit(field, v)}
              />
            ))}
          </PropertySection>
        )}

        {flagFields.length > 0 && (
          <PropertySection title="Flags" expanded={expandedSections.flags ?? true} onToggle={() => toggleSection("flags")}>
            {flagFields.map((field) => (
              <div key={field.key} className="flex items-center justify-between">
                <label className="text-xs text-neutral-300">{field.label}</label>
                {aggregated[field.key] === "Mixed" ? (
                  <span className="text-xs italic text-neutral-400">Mixed</span>
                ) : (
                  <input
                    type="checkbox"
                    checked={Boolean(aggregated[field.key])}
                    onChange={(e) => batchCommit(field, e.target.checked)}
                    className="h-4 w-4 rounded border border-neutral-600 bg-neutral-800 accent-highlight-500"
                  />
                )}
              </div>
            ))}
          </PropertySection>
        )}

        {sharedFields.length === 0 && (
          <div className="p-4 text-center text-xs text-neutral-400">No shared editable fields</div>
        )}
      </div>
    </div>
  );
}
