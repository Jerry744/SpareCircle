import { useMemo, useState } from "react";
import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { StateBoard } from "../../backend/types/stateBoard";
import { buildWidgetTree, flattenWidgetTree } from "../../backend/editorStore";

interface VariantCompareOverlayProps {
  project: ProjectSnapshotV2;
  board: StateBoard;
  initialLeftVariantId: string;
  initialRightVariantId: string;
  onClose(): void;
}

export function VariantCompareOverlay({
  project,
  board,
  initialLeftVariantId,
  initialRightVariantId,
  onClose,
}: VariantCompareOverlayProps): JSX.Element {
  const variants = board.variantIds.map((id) => project.variantsById[id]).filter(Boolean);
  const [leftId, setLeftId] = useState(initialLeftVariantId);
  const [rightId, setRightId] = useState(initialRightVariantId);
  const left = project.variantsById[leftId] ?? variants[0];
  const right = project.variantsById[rightId] ?? variants[0];

  const leftWidgets = useMemo(() => widgetSummary(project, left?.rootWidgetId), [project, left]);
  const rightWidgets = useMemo(() => widgetSummary(project, right?.rootWidgetId), [project, right]);

  return (
    <div className="absolute inset-0 z-40 bg-neutral-950/90 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-100">Variant Compare</div>
        <button type="button" onClick={onClose} className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:text-neutral-100">
          Close
        </button>
      </div>
      <div className="grid h-[calc(100%-44px)] grid-cols-2 gap-4">
        <CompareColumn label="Left" variants={variants} selectedId={left?.id ?? ""} onSelect={setLeftId} summary={leftWidgets} />
        <CompareColumn label="Right" variants={variants} selectedId={right?.id ?? ""} onSelect={setRightId} summary={rightWidgets} />
      </div>
    </div>
  );
}

function widgetSummary(project: ProjectSnapshotV2, rootWidgetId?: string) {
  if (!rootWidgetId) return [];
  const tree = buildWidgetTree(project, rootWidgetId);
  return tree ? flattenWidgetTree(tree) : [];
}

function CompareColumn({
  label,
  variants,
  selectedId,
  summary,
  onSelect,
}: {
  label: string;
  variants: NonNullable<ProjectSnapshotV2["variantsById"][string]>[];
  selectedId: string;
  summary: ReturnType<typeof widgetSummary>;
  onSelect(id: string): void;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded border border-neutral-700 bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-neutral-700 p-3">
        <span className="text-xs font-semibold uppercase text-neutral-400">{label}</span>
        <select
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>{variant.name}</option>
          ))}
        </select>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="mb-3 text-xs text-neutral-400">{summary.length} widgets</div>
        <div className="space-y-1">
          {summary.map((item) => (
            <div key={item.widget.id} className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-300">
              {item.widget.name} · {item.widget.type}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
