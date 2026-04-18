import { Download, FileCode } from "lucide-react";

export function ExportPanel() {
  return (
    <div>
      <div className="text-sm font-semibold mb-3 text-neutral-100">Export Options</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-neutral-800 hover:bg-neutral-600 rounded cursor-pointer transition-colors border border-transparent hover:border-highlight-500/30">
          <FileCode size={24} className="text-highlight-500 mb-2" />
          <div className="text-sm font-semibold mb-1 text-neutral-100">C Source Code</div>
          <div className="text-xs text-neutral-300">Export as LVGL C files</div>
        </div>
        <div className="p-4 bg-neutral-800 hover:bg-neutral-600 rounded cursor-pointer transition-colors border border-transparent hover:border-highlight-500/30">
          <Download size={24} className="text-success-500 mb-2" />
          <div className="text-sm font-semibold mb-1 text-neutral-100">Binary</div>
          <div className="text-xs text-neutral-300">Compile and download</div>
        </div>
      </div>
      <div className="mt-4 p-3 bg-neutral-800 rounded border border-neutral-600">
        <div className="text-xs text-neutral-300 mb-2">Export Settings</div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-neutral-200">
            <input type="checkbox" defaultChecked className="rounded accent-highlight-500" />
            Include assets
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-200">
            <input type="checkbox" defaultChecked className="rounded accent-highlight-500" />
            Generate screen navigation
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-200">
            <input type="checkbox" className="rounded accent-highlight-500" />
            Optimize for size
          </label>
        </div>
      </div>
    </div>
  );
}
