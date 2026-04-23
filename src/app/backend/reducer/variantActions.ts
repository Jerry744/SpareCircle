// Variant reducer actions for ProjectSnapshotV2.
// See `dev-plan/interaction-design-framework/05-variant.md` §4.

import type { VariantStatus } from "../types/variant";

export type VariantCreateMode = "blank" | "copy_current" | "copy_of";

export type VariantAction =
  | {
      type: "createVariant";
      boardId: string;
      mode: VariantCreateMode;
      name?: string;
      sourceVariantId?: string;
      variantId?: string;
      rootWidgetId?: string;
      now?: string;
    }
  | { type: "renameVariant"; variantId: string; name: string; now?: string }
  | { type: "duplicateVariant"; variantId: string; name?: string; variantIdOverride?: string; now?: string }
  | { type: "setCanonicalVariant"; boardId: string; variantId: string; now?: string }
  | { type: "setVariantStatus"; variantId: string; status: VariantStatus; now?: string }
  | { type: "reorderVariants"; boardId: string; orderedIds: string[] }
  | { type: "deleteVariant"; variantId: string }
  | { type: "moveVariantScreen"; variantId: string; position: { x: number; y: number }; now?: string }
  | { type: "moveVariantWidget"; widgetId: string; targetParentId: string; targetIndex: number; now?: string }
  | { type: "setVariantWidgetVisibility"; widgetId: string; visible: boolean; now?: string }
  | { type: "setBoardResolution"; boardId: string; width: number; height: number; now?: string };
