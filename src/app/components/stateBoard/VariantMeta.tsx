export interface VariantMetaProps {
  isCanonical: boolean;
  statusLabel?: string;
}

export function VariantMeta({
  isCanonical,
  statusLabel = "Draft",
}: VariantMetaProps): JSX.Element {
  return isCanonical ? (
    <span className="rounded bg-highlight-500/20 px-2 py-0.5 text-[11px] font-semibold text-highlight-300">
      Canonical
    </span>
  ) : (
    <span className="rounded bg-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300">
      {statusLabel}
    </span>
  );
}
