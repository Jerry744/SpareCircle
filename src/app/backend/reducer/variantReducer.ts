/**
 * Thin action router for variant-related state mutations.
 *
 * Design rules:
 * - Keep this file focused on action dispatch only.
 * - Delegate domain mutations to `variantReducerHandlers`.
 * - Run `syncSectionIndexes` only for actions that can affect section mapping/indexes.
 */
import type { VariantAction } from "./variantActions";
import type { ProjectSnapshotV2 } from "../types/projectV2";
import { makeSectionId, syncSectionIndexes } from "../stateBoard/sectionModel";
import {
  handleBindCanonicalFrame,
  handleCreateSection,
  handleCreateVariant,
  handleDeleteVariant,
  handleDeleteVariantWidgets,
  handleDeleteSectionFrame,
  handleDuplicateSectionFrame,
  handleDuplicateVariantWidgets,
  handleInsertVariantWidget,
  handleMoveVariantScreen,
  handleMoveVariantWidget,
  handleMoveSectionFrame,
  handleMoveStateSection,
  handlePromoteSectionFrame,
  handleRenameSection,
  handleRenameVariant,
  handleRenameWidget,
  handleReorderVariants,
  handleSetBoardResolution,
  handleSetCanonicalVariant,
  handleSetVariantStatus,
  handleSetVariantWidgetPositions,
  handleSetVariantWidgetVisibility,
  syncIfChanged,
} from "./variantReducerHandlers";

export function variantReducer(project: ProjectSnapshotV2, action: VariantAction): ProjectSnapshotV2 {
  switch (action.type) {
    case "createVariant": return syncIfChanged(project, handleCreateVariant(project, action));
    case "renameVariant": return handleRenameVariant(project, action);
    case "duplicateVariant": return syncIfChanged(project, handleCreateVariant(project, {
      type: "createVariant", boardId: project.variantsById[action.variantId]?.boardId ?? "",
      mode: "copy_of", sourceVariantId: action.variantId, name: action.name, variantId: action.variantIdOverride, now: action.now,
    }));
    case "setCanonicalVariant": return syncIfChanged(project, handleSetCanonicalVariant(project, action));
    case "createSection": return handleCreateSection(project, action);
    case "removeSection": return project.treeNodesById[action.sectionId]?.kind === "state_section" ? syncSectionIndexes(project) : project;
    case "renameSection": return handleRenameSection(project, action);
    case "bindCanonicalFrame": return handleBindCanonicalFrame(project, action);
    case "unbindCanonicalFrame": return project.treeNodesById[action.sectionId]?.kind === "state_section" ? project : project;
    case "mapStateSection": return action.sectionId === makeSectionId(action.stateId) ? syncSectionIndexes(project) : project;
    case "setVariantStatus": return syncIfChanged(project, handleSetVariantStatus(project, action));
    case "reorderVariants": return syncIfChanged(project, handleReorderVariants(project, action));
    case "deleteVariant": return syncIfChanged(project, handleDeleteVariant(project, action));
    case "moveVariantScreen": return handleMoveVariantScreen(project, action);
    case "moveStateSection": return syncIfChanged(project, handleMoveStateSection(project, action));
    case "moveSectionFrame": return syncIfChanged(project, handleMoveSectionFrame(project, action));
    case "promoteSectionFrame": return syncIfChanged(project, handlePromoteSectionFrame(project, action));
    case "deleteSectionFrame": return syncIfChanged(project, handleDeleteSectionFrame(project, action));
    case "duplicateSectionFrame": return syncIfChanged(project, handleDuplicateSectionFrame(project, action));
    case "insertVariantWidget": return handleInsertVariantWidget(project, action);
    case "moveVariantWidget": return syncIfChanged(project, handleMoveVariantWidget(project, action));
    case "deleteVariantWidgets": return syncIfChanged(project, handleDeleteVariantWidgets(project, action));
    case "duplicateVariantWidgets": return handleDuplicateVariantWidgets(project, action);
    case "setVariantWidgetPositions": return handleSetVariantWidgetPositions(project, action);
    case "setVariantWidgetVisibility": return handleSetVariantWidgetVisibility(project, action);
    case "renameWidget": return syncIfChanged(project, handleRenameWidget(project, action));
    case "setBoardResolution": return syncIfChanged(project, handleSetBoardResolution(project, action));
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return project;
    }
  }
}
