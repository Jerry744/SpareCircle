import {
  type AssetItem,
  type EditorAction,
  type EditorState,
  type WidgetNode,
} from "../types";
import { transformProjectWidgets } from "../tree";
import { getWidgetById } from "../tree";
import { commitProjectChange, removeAssetReferences } from "./helpers";

export function handleImportAssets(state: EditorState, action: EditorAction): EditorState {
  const assets = (action.assets as AssetItem[] | undefined) ?? [];
  if (assets.length === 0) return state;

  const nextAssets = { ...state.project.assets };
  let changed = false;
  for (const asset of assets) {
    if (!asset?.id || nextAssets[asset.id]) continue;
    nextAssets[asset.id] = asset;
    changed = true;
  }
  if (!changed) return state;

  return commitProjectChange(state, { ...state.project, assets: nextAssets });
}

export function handleDeleteAsset(state: EditorState, action: EditorAction): EditorState {
  const assetId = action.assetId as string;
  if (!assetId || !state.project.assets[assetId]) return state;

  const { [assetId]: _removed, ...remainingAssets } = state.project.assets;
  const nextProject = removeAssetReferences({ ...state.project, assets: remainingAssets }, assetId);

  return commitProjectChange(state, nextProject, state.selectedWidgetIds);
}

export function handleAssignWidgetAsset(state: EditorState, action: EditorAction): EditorState {
  const widgetId = action.widgetId as string;
  const assetId = (action.assetId as string | null) ?? null;
  if (!widgetId) return state;

  const targetWidget = getWidgetById(state.project, widgetId);
  if (!targetWidget || targetWidget.type !== "Image") return state;
  if (assetId && !state.project.assets[assetId]) return state;

  const normalizedAssetId = assetId ?? undefined;
  if (targetWidget.assetId === normalizedAssetId) return state;

  const nextProject = transformProjectWidgets(state.project, [widgetId], (widget: WidgetNode) => ({
    ...widget,
    assetId: normalizedAssetId,
  }));

  return commitProjectChange(state, nextProject, [widgetId]);
}
