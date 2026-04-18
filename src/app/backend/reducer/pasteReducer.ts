import type { EditorAction, EditorState } from "../types";
import type { ClipboardPayload } from "../clipboard";
import { instantiateClipboard } from "../clipboard";
import { getActiveScreen } from "../tree";
import { commitProjectChange, pruneDanglingEventBindings } from "./helpers";

export function handlePasteClipboardSubtrees(state: EditorState, action: EditorAction): EditorState {
  if (state.interaction) return state;

  const payload = action.payload as ClipboardPayload | undefined;
  if (!payload?.roots?.length) return state;

  const targetParentId = (action.targetParentId as string | undefined) ?? getActiveScreen(state.project).rootNodeId;
  const targetIndex = action.targetIndex as number | undefined;

  if (!state.project.widgetsById[targetParentId]) return state;

  const { nextProject, newRootIds } = instantiateClipboard(state.project, payload, targetParentId, targetIndex);
  if (newRootIds.length === 0) return state;

  return commitProjectChange(state, pruneDanglingEventBindings(nextProject), newRootIds);
}
