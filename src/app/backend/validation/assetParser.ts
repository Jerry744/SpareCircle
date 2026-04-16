import type { AssetItem } from "../types";
import { isRecord, isValidAssetId, isAssetMimeType, isValidDataUrl } from "./helpers";

export function parseAsset(
  input: unknown,
  path: string,
): { ok: true; asset: AssetItem } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: `${path} must be an object` };
  }

  const { id, name, mimeType, dataUrl } = input;
  if (!isValidAssetId(id)) return { ok: false, error: `${path}.id must be a valid asset id` };
  if (typeof name !== "string" || !name.trim()) return { ok: false, error: `${path}.name must be a non-empty string` };
  if (!isAssetMimeType(mimeType)) return { ok: false, error: `${path}.mimeType is not supported` };
  if (typeof dataUrl !== "string" || !isValidDataUrl(dataUrl, mimeType)) {
    return { ok: false, error: `${path}.dataUrl is invalid or exceeds size limit` };
  }

  return {
    ok: true,
    asset: { id, name: name.trim(), mimeType, dataUrl },
  };
}

export function parseAssets(
  input: unknown,
): { ok: true; assets: Record<string, AssetItem> } | { ok: false; error: string } {
  if (input === undefined) return { ok: true, assets: {} };
  if (!isRecord(input)) return { ok: false, error: "Project.assets must be an object" };

  const assets: Record<string, AssetItem> = {};
  for (const [assetId, rawAsset] of Object.entries(input)) {
    const parsed = parseAsset(rawAsset, `Project.assets.${assetId}`);
    if (!parsed.ok) return parsed;
    if (parsed.asset.id !== assetId) {
      return { ok: false, error: `Project.assets.${assetId}.id must match key` };
    }
    assets[assetId] = parsed.asset;
  }

  return { ok: true, assets };
}
