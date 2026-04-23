import type { StateBoard } from "../../backend/types/stateBoard";
import type { Variant } from "../../backend/types/variant";
import { VariantMeta } from "../stateBoard/VariantMeta";

interface VariantListPanelProps {
  board: StateBoard;
  variants: Variant[];
  activeVariantId: string;
  onSelect(variantId: string): void;
  onSetCanonical(variantId: string): void;
  onArchive(variantId: string): void;
  onDelete(variantId: string): void;
}

export function VariantListPanel({
  board,
  variants,
  activeVariantId,
  onSelect,
  onSetCanonical,
  onArchive,
  onDelete,
}: VariantListPanelProps): JSX.Element {
  return (
    <section className="rounded border border-neutral-700 bg-neutral-900/90 p-3 shadow-lg ring-1 ring-neutral-500/30">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-neutral-300">
        <span>Variants</span>
        <span>{variants.length}</span>
      </div>
      <div className="space-y-2">
        {variants.map((variant) => {
          const isActive = variant.id === activeVariantId;
          const isCanonical = variant.id === board.canonicalVariantId;
          return (
            <div
              key={variant.id}
              className={`rounded border p-2 text-xs ${
                isActive ? "border-highlight-500 bg-highlight-500/10" : "border-neutral-700 bg-neutral-800"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(variant.id)}
                className="mb-2 flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="truncate font-medium text-neutral-100">{variant.name}</span>
                <VariantMeta isCanonical={isCanonical} statusLabel={variant.status} />
              </button>
              <div className="mb-2 truncate text-[11px] text-neutral-400">
                {new Date(variant.updatedAt).toLocaleString()}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => onSetCanonical(variant.id)} className="text-highlight-300 hover:text-highlight-200">
                  Canonical
                </button>
                <button type="button" onClick={() => onArchive(variant.id)} className="text-neutral-300 hover:text-neutral-100">
                  Archive
                </button>
                <button type="button" onClick={() => onDelete(variant.id)} className="text-danger-300 hover:text-danger-200">
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
