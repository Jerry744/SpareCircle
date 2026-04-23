export type AssetMimeType = "image/png" | "image/jpeg" | "image/gif";

export interface AssetItem {
  id: string;
  name: string;
  mimeType: AssetMimeType;
  dataUrl: string;
}
