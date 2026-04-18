import { Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useEditorBackend } from "../../backend/editorStore";

function estimateAssetSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    return 0;
  }

  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetsPanel() {
  const {
    state: { project },
    actions: { importAssets, deleteAsset },
  } = useEditorBackend();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assets = Object.values(project.assets).sort((left, right) => left.name.localeCompare(right.name));

  const handleImport = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const result = await importAssets(files);
    if (!result.ok) {
      setError(result.error);
      setMessage(null);
      return;
    }

    setMessage(`Imported ${result.importedCount} asset${result.importedCount > 1 ? "s" : ""}`);
    setError(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-neutral-100">Project Assets</div>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 bg-highlight-500 hover:bg-highlight-400 rounded text-xs flex items-center gap-1 transition-colors text-white"
          >
            <Upload size={12} />
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif"
            multiple
            className="hidden"
            onChange={(event) => {
              void handleImport(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>
      {error ? <div className="mb-2 text-[11px] text-rose-400">Import failed: {error}</div> : null}
      {!error && message ? <div className="mb-2 text-[11px] text-emerald-300">{message}</div> : null}
      {assets.length === 0 ? (
        <div className="text-xs text-neutral-400 border border-dashed border-neutral-600 rounded p-4">
          No assets yet. Import image files here to use them in Image widgets.
        </div>
      ) : null}
      <div className="grid grid-cols-6 gap-1.5">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="group relative p-1.5 bg-neutral-800 hover:bg-neutral-600 rounded transition-colors border border-transparent hover:border-highlight-500/30"
            title={`${asset.name} • ${formatBytes(estimateAssetSize(asset.dataUrl))}`}
          >
            <div className="w-full aspect-square bg-neutral-900 rounded flex items-center justify-center overflow-hidden">
              <img src={asset.dataUrl} alt={asset.name} className="max-w-full max-h-full object-contain" />
            </div>
            <div className="mt-1 text-[10px] truncate text-neutral-300 leading-tight">{asset.name}</div>
            <button
              type="button"
              onClick={() => deleteAsset(asset.id)}
              className="absolute top-1 right-1 p-0.5 rounded bg-neutral-900/80 text-neutral-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete asset"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
