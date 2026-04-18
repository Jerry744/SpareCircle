import { Package, Plus } from "lucide-react";

const COMPONENTS = [
  { name: "Header Component", widgets: 3 },
  { name: "Navigation Bar", widgets: 5 },
  { name: "Status Card", widgets: 4 },
];

export function ComponentsPanel() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-neutral-100">Reusable Components</div>
        <button className="px-3 py-1 bg-highlight-500 hover:bg-highlight-400 rounded text-xs flex items-center gap-1 transition-colors text-white">
          <Plus size={12} />
          Create
        </button>
      </div>
      <div className="space-y-2">
        {COMPONENTS.map((component) => (
          <div
            key={component.name}
            className="p-3 bg-neutral-800 hover:bg-neutral-600 rounded cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-highlight-500/30"
          >
            <div>
              <div className="text-sm text-neutral-100">{component.name}</div>
              <div className="text-xs text-neutral-400">{component.widgets} widgets</div>
            </div>
            <Package size={16} className="text-neutral-400" />
          </div>
        ))}
      </div>
    </div>
  );
}
