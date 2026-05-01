import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { StateBoard } from "../../backend/types/stateBoard";
import type { VariantAction } from "../../backend/reducer/variantActions";
import type { WidgetNode } from "../../backend/types/widget";
import type { StateBoardSelection } from "./stateBoardSelection";

interface StateBoardInspectorProps {
  project: ProjectSnapshotV2;
  board: StateBoard;
  selectedVariantId: string;
  selection: StateBoardSelection;
  onVariantAction(action: VariantAction): void;
}

export function StateBoardInspector({
  project,
  board,
  selectedVariantId,
  selection,
  onVariantAction,
}: StateBoardInspectorProps): JSX.Element {
  if (selection.kind === "mixed") {
    const widgetCount = Object.values(selection.widgetIdsByVariant).reduce((sum, ids) => sum + ids.length, 0);
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-neutral-900 bg-neutral-800/60 p-3">
          <div className="mb-1 text-xs text-neutral-400">MIXED SELECTION</div>
          <div className="font-semibold text-neutral-100">
            {selection.variantIds.length} screens, {widgetCount} widgets
          </div>
        </div>
        <div className="space-y-4 p-3 text-sm text-neutral-300">
          <div className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2">
            Mixed screen/widget selection is active. Inspector editing is not wired for mixed V2 selections yet.
          </div>
        </div>
      </div>
    );
  }

  if (selection.kind === "widget") {
    const variant = project.variantsById[selection.variantId];
    const selectedWidgets = selection.widgetIds
      .map((widgetId) => project.widgetsById[widgetId])
      .filter((widget): widget is WidgetNode => Boolean(widget));

    if (!variant || selectedWidgets.length === 0) {
      return (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-400">
          Select a widget to view properties
        </div>
      );
    }

    if (selectedWidgets.length > 1) {
      return (
        <div className="flex h-full flex-col">
          <div className="border-b border-neutral-900 bg-neutral-800/60 p-3">
            <div className="mb-1 text-xs text-neutral-400">SELECTED WIDGETS</div>
            <div className="font-semibold text-neutral-100">{selectedWidgets.length} widgets</div>
            <div className="mt-1 text-xs text-neutral-300">{variant.name}</div>
          </div>
          <div className="space-y-4 p-3 text-sm text-neutral-300">
            <div className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2">
              Multi-widget editing is not wired for V2 yet. Selection and inspector routing are synced.
            </div>
          </div>
        </div>
      );
    }

    const widget = selectedWidgets[0];
    const isFrame = widget.type === "Screen";
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-neutral-900 bg-neutral-800/60 p-3">
          <div className="mb-1 text-xs text-neutral-400">SELECTED WIDGET</div>
          <div className="font-semibold text-neutral-100">{widget.name}</div>
          <div className="mt-1 text-xs text-neutral-300">{widget.type}</div>
        </div>
        <div className="space-y-4 p-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-300">Name</label>
            <input
              value={widget.name}
              onChange={(event) => onVariantAction({ type: "renameWidget", widgetId: widget.id, name: event.target.value })}
              className="w-full rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-highlight-500"
            />
          </div>
          <div className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300">
            Screen: {variant.name}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="X" value={widget.x} />
            <Metric label="Y" value={widget.y} />
            <Metric label="Width" value={widget.width} />
            <Metric label="Height" value={widget.height} />
          </div>
          <button
            type="button"
            onClick={() =>
              onVariantAction({
                type: "setVariantWidgetVisibility",
                widgetId: widget.id,
                visible: widget.visible === false,
              })
            }
            className="w-full rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm font-semibold text-neutral-100"
          >
            {widget.visible === false ? "Show Widget" : "Hide Widget"}
          </button>
        </div>
      </div>
    );
  }

  if (selection.kind === "screen" && selection.variantIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-400">
        Select a screen or widget to view properties
      </div>
    );
  }

  const inspectedVariantId = selection.variantIds[0] ?? selectedVariantId;
  const variant = project.variantsById[inspectedVariantId] ?? project.variantsById[board.canonicalVariantId];
  const root = variant ? project.widgetsById[variant.rootWidgetId] : null;

  if (!variant || !root) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-400">
        Select a screen to view properties
      </div>
    );
  }

  const isCanonical = board.canonicalVariantId === variant.id;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-900 bg-neutral-800/60 p-3">
        <div className="mb-1 text-xs text-neutral-400">SELECTED SCREEN</div>
        <div className="font-semibold text-neutral-100">{variant.name}</div>
        <div className="mt-1 text-xs text-neutral-300">{isCanonical ? "Canonical" : variant.status}</div>
      </div>
      <div className="space-y-4 p-3">
        <div>
          <label className="mb-1 block text-xs text-neutral-300">Name</label>
          <input
            value={variant.name}
            onChange={(event) => onVariantAction({ type: "renameVariant", variantId: variant.id, name: event.target.value })}
            className="w-full rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-highlight-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-neutral-300">X</label>
            <div className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300">{root.x}</div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-300">Y</label>
            <div className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300">{root.y}</div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-300">State Resolution</label>
          <div className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300">
            {board.meta.width} × {board.meta.height}
          </div>
        </div>
        <button
          type="button"
          disabled={isCanonical}
          onClick={() => onVariantAction({ type: "setCanonicalVariant", boardId: board.id, variantId: variant.id })}
          className="w-full rounded border border-highlight-700 bg-highlight-900/30 px-3 py-2 text-sm font-semibold text-highlight-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Set as Canonical
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-300">{label}</label>
      <div className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300">{value}</div>
    </div>
  );
}
