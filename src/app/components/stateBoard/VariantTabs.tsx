import type { Variant } from "../../backend/types/variant";

export interface VariantTabsProps {
  variants: Variant[];
  activeVariantId: string;
  canonicalVariantId: string;
  onSelect(variantId: string): void;
  onSetCanonical?(variantId: string): void;
}

export function VariantTabs({
  variants,
  activeVariantId,
  canonicalVariantId,
  onSelect,
  onSetCanonical,
}: VariantTabsProps): JSX.Element {
  return (
    <div className="inline-flex max-w-[420px] items-center gap-2 overflow-x-auto rounded border border-neutral-700 bg-neutral-900/90 p-2 shadow-lg ring-1 ring-neutral-500/30">
      {variants.map((variant) => {
        const isActive = variant.id === activeVariantId;
        return (
          <button
            key={variant.id}
            type="button"
            onClick={() => onSelect(variant.id)}
            className={`flex shrink-0 items-center gap-2 rounded border px-3 py-1.5 text-xs transition-colors ${
              isActive
                ? "border-highlight-500 bg-highlight-500/15 text-neutral-100"
                : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:text-neutral-100"
            }`}
          >
            <span>{variant.name}</span>
          </button>
        );
      })}
      {!variants.some((item) => item.id === canonicalVariantId) && variants.length > 0 ? (
        <button
          type="button"
          className="rounded border border-warning-700 bg-warning-900/20 px-2 py-1 text-[11px] text-warning-300"
          onClick={() => onSetCanonical?.(variants[0].id)}
        >
          Set first as Canonical
        </button>
      ) : null}
    </div>
  );
}
