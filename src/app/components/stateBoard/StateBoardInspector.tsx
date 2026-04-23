import type { ProjectSnapshotV2 } from "../../backend/types/projectV2";
import type { StateBoard } from "../../backend/types/stateBoard";
import type { VariantAction } from "../../backend/reducer/variantActions";

interface StateBoardInspectorProps {
  project: ProjectSnapshotV2;
  board: StateBoard;
  selectedVariantId: string;
  onVariantAction(action: VariantAction): void;
}

export function StateBoardInspector({
  project,
  board,
  selectedVariantId,
  onVariantAction,
}: StateBoardInspectorProps): JSX.Element {
  const variant = project.variantsById[selectedVariantId] ?? project.variantsById[board.canonicalVariantId];
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
