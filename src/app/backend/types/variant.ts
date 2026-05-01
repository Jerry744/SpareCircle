// Variant domain types.
// Corresponds to `dev-plan/interaction-design-framework/01-data-model.md` §3.3.
// A Variant is one design alternative inside a StateBoard. The widget tree
// rooted at `rootWidgetId` reuses the existing WidgetNode model; its root
// widget stays typed as "Screen" so canvas/rendering/export code keeps
// working unchanged (PRD §6.5 + §6.6).

export type VariantStatus = "canonical" | "draft" | "archived";

export const VARIANT_STATUSES: VariantStatus[] = ["canonical", "draft", "archived"];

export interface Variant {
  id: string;
  boardId: string;
  name: string;
  status: VariantStatus;
  // canonicalFrameId points into ProjectSnapshotV2.widgetsById. The referenced
  // widget must be a frame root: type="Screen", parentId=null, and
  // frameRole="canonical".
  canonicalFrameId: string;
  // rootWidgetId points into ProjectSnapshotV2.widgetsById. The referenced
  // widget must be type="Screen" and parentId=null (INV-4).
  /** @deprecated Use canonicalFrameId. Kept during the frame-first migration. */
  rootWidgetId: string;
  description?: string;
  // ISO-8601 timestamps. Persisted verbatim for deterministic diffs.
  createdAt: string;
  updatedAt: string;
}

export function getVariantCanonicalFrameId(variant: Variant): string {
  return variant.canonicalFrameId || variant.rootWidgetId;
}
