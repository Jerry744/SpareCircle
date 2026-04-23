// Workspace mode type.
// Corresponds to `dev-plan/interaction-design-framework/01-data-model.md` §3.7.
// Designer vs Engineer is only a UI weighting; both modes share the same
// underlying ProjectSnapshotV2 (PRD §5.6).

export type WorkspaceMode = "designer" | "engineer";

export const WORKSPACE_MODES: WorkspaceMode[] = ["designer", "engineer"];

export const DEFAULT_WORKSPACE_MODE: WorkspaceMode = "designer";
