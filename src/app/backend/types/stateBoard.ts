// StateBoard domain types.
// Corresponds to `dev-plan/interaction-design-framework/01-data-model.md` §3.2.
// A StateBoard is the internal design surface of a single StateNode and
// owns a set of Variants. Exactly one Variant is Canonical (see INV-3).

export interface StateBoardMeta {
  width: number;
  height: number;
  fill?: string;
}

export interface StateBoard {
  id: string;
  stateNodeId: string;
  meta: StateBoardMeta;
  variantIds: string[];
  canonicalVariantId: string;
  notes?: string;
}

export const DEFAULT_STATE_BOARD_META: StateBoardMeta = {
  width: 480,
  height: 320,
  fill: "#1f2937",
};
