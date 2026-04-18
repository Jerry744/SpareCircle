import { useEffect, useMemo, useState } from "react";
import {
  collectSubtreeIds,
  getActiveScreenFromProject,
  getWidgetById,
  useEditorBackend,
} from "../backend/editorStore";
import { getWidgetStyleTokenId } from "../backend/validation";
import {
  type ColorPropertyKey,
  type DraftMap,
  type ErrorMap,
  FIELD_CONFIG,
  INSPECTOR_PANEL_CLASS,
  type InspectorField,
  WIDGET_FIELD_SCHEMA,
  WIDGET_HAS_CONTENT,
  WIDGET_HAS_INITIAL_STATE,
} from "./inspector/config";
import {
  AssetProperty,
  CheckboxProperty,
  ColorProperty,
  PropertyRow,
  PropertySection,
} from "./inspector/SharedControls";
import { MultiSelectInspector } from "./inspector/MultiSelectInspector";
import { WidgetContentSetup } from "./inspector/WidgetContentSetup";
import { buildDrafts, getWidgetPropertyDraftValue, validateField } from "./inspector/utils";

export function InspectorPanel({ showHeader = true }: { showHeader?: boolean }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    position: true,
    style: true,
    asset: true,
    content: true,
    state: true,
    flags: true,
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
      batchUpdateWidgetProperty,
      applyAlignmentOperation,
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

  const selectedWidgets = useMemo(
    () =>
      selectedWidgetIds
        .map((id) => (activeScreenNodeIds.has(id) ? getWidgetById(project, id) : null))
        .filter((w): w is NonNullable<typeof selectedWidget> => w !== null),
    [selectedWidgetIds, activeScreenNodeIds, project],
  );

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
      <div className={`${INSPECTOR_PANEL_CLASS} flex items-center justify-center`}>
        <div className="px-4 text-center text-sm text-neutral-400">Select a widget to view properties</div>
      </div>
    );
  }

  if (selectedWidgetIds.length > 1) {
    return (
      <MultiSelectInspector
        showHeader={showHeader}
        project={project}
        selectedWidgetIds={selectedWidgetIds}
        selectedWidgets={selectedWidgets}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
        batchUpdateWidgetProperty={batchUpdateWidgetProperty}
        applyAlignmentOperation={applyAlignmentOperation}
      />
    );
  }

  if (!selectedWidget) {
    return (
      <div className={`${INSPECTOR_PANEL_CLASS} flex items-center justify-center`}>
        <div className="px-4 text-center text-sm text-neutral-400">Selected widget not found in current screen</div>
      </div>
    );
  }

  return (
    <div className={`${INSPECTOR_PANEL_CLASS} flex flex-col`}>
      {showHeader ? (
        <div className="h-10 flex items-center border-b border-neutral-900 px-3">
          <span className="text-xs font-semibold text-neutral-300">INSPECTOR</span>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-neutral-900 bg-neutral-800/60 p-3">
          <div className="mb-1 text-xs text-neutral-400">SELECTED WIDGET</div>
          <div className="font-semibold text-neutral-100">{selectedWidget.name}</div>
          <div className="mt-1 text-xs text-neutral-300">{selectedWidget.type}</div>
        </div>

        <PropertySection title="Position & Size" expanded={expandedSections.position} onToggle={() => toggleSection("position")}>
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

        <PropertySection title="Style" expanded={expandedSections.style} onToggle={() => toggleSection("style")}>
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
              onClearOverride={() => clearWidgetProperty(selectedWidget.id, field.key as ColorPropertyKey)}
              onKeyDown={(e) => handleInputKeyDown(e, field)}
            />
          ))}
        </PropertySection>

        {selectedWidget.type === "Image" && (
          <PropertySection title="Asset" expanded={expandedSections.asset} onToggle={() => toggleSection("asset")}>
            <AssetProperty
              selectedAssetId={selectedWidget.assetId ?? null}
              options={assetOptions}
              onChange={(assetId) => assignWidgetAsset(selectedWidget.id, assetId)}
              onDelete={(assetId) => deleteAsset(assetId)}
            />
          </PropertySection>
        )}

        {WIDGET_HAS_CONTENT.has(selectedWidget.type) && (
          <PropertySection title="Content" expanded={expandedSections.content} onToggle={() => toggleSection("content")}>
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

        {WIDGET_HAS_INITIAL_STATE.has(selectedWidget.type) && sectionFields.state.length > 0 && (
          <PropertySection title="Initial State" expanded={expandedSections.state} onToggle={() => toggleSection("state")}>
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
