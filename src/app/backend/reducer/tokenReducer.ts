import {
  type EditorAction,
  type EditorState,
  type StyleToken,
  type WidgetNode,
} from "../types";
import { getWidgetById, transformProjectWidgets } from "../tree";
import {
  commitProjectChange,
  makeUniqueTokenName,
  getNextStyleTokenId,
  sanitizeStyleTokenValue,
  updateWidgetTokenReference,
  removeTokenReferences,
} from "./helpers";

export function handleCreateStyleToken(state: EditorState, action: EditorAction): EditorState {
  const name = (action.name as string | undefined)?.trim();
  const value = action.value as string;
  const normalizedValue = sanitizeStyleTokenValue(value);
  if (!name || !normalizedValue) return state;

  const nextToken: StyleToken = {
    id: getNextStyleTokenId(state.project),
    name: makeUniqueTokenName(state.project.styleTokens.map((token) => token.name), name),
    type: "color",
    value: normalizedValue,
  };

  return commitProjectChange(state, {
    ...state.project,
    styleTokens: [...state.project.styleTokens, nextToken],
  });
}

export function handleUpdateStyleToken(state: EditorState, action: EditorAction): EditorState {
  const tokenId = action.tokenId as string;
  const updates = (action.updates as { name?: string; value?: string }) ?? {};
  const tokenIndex = state.project.styleTokens.findIndex((token) => token.id === tokenId);
  if (tokenIndex < 0) return state;

  const current = state.project.styleTokens[tokenIndex];
  const nextName = updates.name !== undefined
    ? makeUniqueTokenName(
        state.project.styleTokens.filter((token) => token.id !== tokenId).map((token) => token.name),
        updates.name,
      )
    : current.name;
  const nextValue = updates.value !== undefined ? sanitizeStyleTokenValue(updates.value) : current.value;
  if (!nextValue) return state;
  if (nextName === current.name && nextValue === current.value) return state;

  const nextTokens = [...state.project.styleTokens];
  nextTokens[tokenIndex] = { ...current, name: nextName, value: nextValue };

  return commitProjectChange(state, { ...state.project, styleTokens: nextTokens });
}

export function handleDeleteStyleToken(state: EditorState, action: EditorAction): EditorState {
  const tokenId = action.tokenId as string;
  if (!tokenId || !state.project.styleTokens.some((token) => token.id === tokenId)) return state;

  const nextProject = removeTokenReferences(
    { ...state.project, styleTokens: state.project.styleTokens.filter((token) => token.id !== tokenId) },
    tokenId,
  );

  return commitProjectChange(state, nextProject);
}

export function handleAssignWidgetStyleToken(state: EditorState, action: EditorAction): EditorState {
  const widgetId = action.widgetId as string;
  const propertyName = action.propertyName as "fill" | "textColor";
  const tokenId = action.tokenId as string | null;

  if (!widgetId || (propertyName !== "fill" && propertyName !== "textColor")) return state;
  if (tokenId && !state.project.styleTokens.some((token) => token.id === tokenId)) return state;

  const targetWidget = getWidgetById(state.project, widgetId);
  if (!targetWidget) return state;

  const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) =>
    updateWidgetTokenReference(widget, propertyName, tokenId),
  );
  if (JSON.stringify(nextProject) === JSON.stringify(state.project)) return state;

  return commitProjectChange(state, nextProject, [widgetId]);
}
