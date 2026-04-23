// Snapshot domain types.
// Corresponds to `dev-plan/interaction-design-framework/01-data-model.md` §3.6.
// A Snapshot is a user-triggered, full-project freeze. It lives alongside
// (not inside) the undo history and does NOT represent a Variant.

import type { ProjectSnapshotCore } from "./projectV2";

export interface SnapshotMeta {
  id: string;
  name: string;
  createdAt: string;
  description?: string;
}

export interface Snapshot extends SnapshotMeta {
  // Intentionally stores `ProjectSnapshotCore` (without snapshots/workspaceMode/
  // zoomLevel) to avoid snapshots nesting recursively.
  project: ProjectSnapshotCore;
}
