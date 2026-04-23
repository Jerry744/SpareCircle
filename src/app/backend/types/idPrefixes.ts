// Centralized ID prefixes for the v2 state-machine data model.
// Keeping prefixes in one place makes persistence migration and debug
// logs predictable. See `dev-plan/interaction-design-framework/00-architecture.md`
// section 5 ("Naming conventions") for the canonical list.

export const ID_PREFIX = {
  stateNode: "state-node",
  transition: "transition",
  variant: "variant",
  screenGroup: "screen-group",
  // A StateBoard is 1:1 with a StateNode, so its id is derived from the
  // owning StateNode id. `makeBoardId()` below enforces the convention.
  stateBoard: "board",
  transitionEventBinding: "binding",
  snapshot: "snapshot",
} as const;

export type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX];

function generateRandomSuffix(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeId(prefix: IdPrefix): string {
  return `${prefix}-${generateRandomSuffix().toLowerCase()}`;
}

// Board ids are derived from the StateNode id so that `board-<uuid>` always
// points back to the unique owning node. Downstream resolvers use this to
// fetch a board without keeping an extra index.
export function makeBoardId(stateNodeId: string): string {
  if (!stateNodeId.startsWith(`${ID_PREFIX.stateNode}-`)) {
    // Fallback: still produce a namespaced id so migrations can rewrite it
    // later without clashing with freshly created boards.
    return `${ID_PREFIX.stateBoard}-${stateNodeId}`;
  }
  const suffix = stateNodeId.slice(ID_PREFIX.stateNode.length + 1);
  return `${ID_PREFIX.stateBoard}-${suffix}`;
}

export function isIdWithPrefix(value: unknown, prefix: IdPrefix): value is string {
  return typeof value === "string" && value.startsWith(`${prefix}-`) && value.length > prefix.length + 1;
}
