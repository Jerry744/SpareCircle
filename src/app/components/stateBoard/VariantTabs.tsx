import type { Variant } from "../../backend/types/variant";
import { Copy, GitCompare, MoreHorizontal, Plus, Star, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { VariantMeta } from "./VariantMeta";

export interface VariantTabsProps {
  variants: Variant[];
  activeVariantId: string;
  canonicalVariantId: string;
  onSelect(variantId: string): void;
  onCreateBlank?(): void;
  onCreateCopy?(): void;
  onRename?(variantId: string, name: string): void;
  onDuplicate?(variantId: string): void;
  onSetCanonical?(variantId: string): void;
  onArchive?(variantId: string): void;
  onDelete?(variantId: string): void;
  onCompare?(): void;
}

export function VariantTabs({
  variants,
  activeVariantId,
  canonicalVariantId,
  onSelect,
  onCreateBlank,
  onCreateCopy,
  onRename,
  onDuplicate,
  onSetCanonical,
  onArchive,
  onDelete,
  onCompare,
}: VariantTabsProps): JSX.Element {
  return (
    <div className="inline-flex max-w-[560px] items-center gap-2 overflow-x-auto rounded border border-neutral-700 bg-neutral-900/90 p-2 shadow-lg ring-1 ring-neutral-500/30">
      <button
        type="button"
        title="Create blank Variant"
        onClick={onCreateBlank}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-neutral-700 bg-neutral-800 text-neutral-200 hover:text-neutral-100"
      >
        <Plus size={15} />
      </button>
      {variants.map((variant) => {
        const isActive = variant.id === activeVariantId;
        const isCanonical = variant.id === canonicalVariantId;
        return (
          <div
            key={variant.id}
            className={`flex shrink-0 items-center gap-2 rounded border px-3 py-1.5 text-xs transition-colors ${
              isActive
                ? "border-highlight-500 bg-highlight-500/15 text-neutral-100"
                : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:text-neutral-100"
            }`}
          >
            <button type="button" onClick={() => onSelect(variant.id)} className="flex items-center gap-2">
              <span>{variant.name}</span>
              <VariantMeta isCanonical={isCanonical} statusLabel={variant.status} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title={`${variant.name} actions`}
                  className="flex h-5 w-5 items-center justify-center rounded hover:bg-neutral-700"
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem
                  onClick={() => {
                    const nextName = window.prompt("Variant name", variant.name);
                    if (nextName) onRename?.(variant.id, nextName);
                  }}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate?.(variant.id)}>
                  <Copy size={14} className="mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetCanonical?.(variant.id)}>
                  <Star size={14} className="mr-2" /> Set Canonical
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onArchive?.(variant.id)}>
                  Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete?.(variant.id)}>
                  <Trash2 size={14} className="mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
      <button
        type="button"
        title="Copy current Variant"
        onClick={onCreateCopy}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-neutral-700 bg-neutral-800 text-neutral-200 hover:text-neutral-100"
      >
        <Copy size={15} />
      </button>
      <button
        type="button"
        title="Compare Variants"
        onClick={onCompare}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-neutral-700 bg-neutral-800 text-neutral-200 hover:text-neutral-100"
      >
        <GitCompare size={15} />
      </button>
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
