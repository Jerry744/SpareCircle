import { 
  Image as ImageIcon, 
  Palette, 
  Package, 
  Zap, 
  Settings as SettingsIcon,
  FileCode,
  Plus,
  Upload,
  Download,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { getActiveScreenFromProject, useEditorBackend } from "../backend/editorStore";

interface BottomPanelProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "assets", label: "Assets", icon: ImageIcon },
  { id: "components", label: "Components", icon: Package },
  { id: "themes", label: "Themes & Colors", icon: Palette },
  { id: "events", label: "Events", icon: Zap },
  { id: "export", label: "Export", icon: FileCode },
  { id: "settings", label: "Project Settings", icon: SettingsIcon },
];

export function BottomPanel({ activeTab, onTabChange }: BottomPanelProps) {
  return (
    <div className="h-56 bg-neutral-700 border-t border-neutral-900 flex flex-col">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 pt-1 border-b border-neutral-900">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-2 flex items-center gap-2 text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-highlight-500 text-neutral-100"
                : "border-transparent text-neutral-300 hover:text-neutral-100"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "assets" && <AssetsPanel />}
        {activeTab === "components" && <ComponentsPanel />}
        {activeTab === "themes" && <ThemesPanel />}
        {activeTab === "events" && <EventsPanel />}
        {activeTab === "export" && <ExportPanel />}
        {activeTab === "settings" && <SettingsPanel />}
      </div>
    </div>
  );
}

function AssetsPanel() {
  const {
    state: { project },
    actions: { importAssets, deleteAsset },
  } = useEditorBackend();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assets = Object.values(project.assets).sort((left, right) => left.name.localeCompare(right.name));

  const estimateAssetSize = (dataUrl: string): number => {
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex < 0) {
      return 0;
    }

    const base64 = dataUrl.slice(commaIndex + 1);
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
      {error ? (
        <div className="mb-2 text-[11px] text-rose-400">Import failed: {error}</div>
      ) : null}
      {!error && message ? (
        <div className="mb-2 text-[11px] text-emerald-300">{message}</div>
      ) : null}
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

function ComponentsPanel() {
  const components = [
    { name: "Header Component", widgets: 3 },
    { name: "Navigation Bar", widgets: 5 },
    { name: "Status Card", widgets: 4 },
  ];

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
        {components.map((comp, i) => (
          <div
            key={i}
            className="p-3 bg-neutral-800 hover:bg-neutral-600 rounded cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-highlight-500/30"
          >
            <div>
              <div className="text-sm text-neutral-100">{comp.name}</div>
              <div className="text-xs text-neutral-400">{comp.widgets} widgets</div>
            </div>
            <Package size={16} className="text-neutral-400" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemesPanel() {
  const colors = [
    { name: "Primary", value: "#5b9dd9" },
    { name: "Secondary", value: "#7eb3e5" },
    { name: "Background", value: "#1e1e1e" },
    { name: "Surface", value: "#2c2c2c" },
    { name: "Text Primary", value: "#e8e8e8" },
    { name: "Text Secondary", value: "#9ca3af" },
  ];

  return (
    <div>
      <div className="text-sm font-semibold mb-3 text-neutral-100">Global Theme Colors</div>
      <div className="grid grid-cols-3 gap-3">
        {colors.map((color, i) => (
          <div key={i} className="p-3 bg-neutral-800 rounded border border-neutral-600">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded border border-neutral-600"
                style={{ backgroundColor: color.value }}
              />
              <div className="flex-1">
                <div className="text-xs text-neutral-100">{color.name}</div>
                <div className="text-[10px] text-neutral-400">{color.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsPanel() {
  const events = [
    { widget: "Button1", event: "CLICKED", action: "Screen_LoadScreen(Screen2)" },
    { widget: "Slider1", event: "VALUE_CHANGED", action: "SetTemperature(value)" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-neutral-100">Event Handlers</div>
        <button className="px-3 py-1 bg-highlight-500 hover:bg-highlight-400 rounded text-xs flex items-center gap-1 transition-colors text-white">
          <Plus size={12} />
          Add Event
        </button>
      </div>
      <div className="space-y-2">
        {events.map((event, i) => (
          <div key={i} className="p-3 bg-neutral-800 rounded border border-neutral-600">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-neutral-100">{event.widget}</div>
              <Zap size={14} className="text-warning-500" />
            </div>
            <div className="text-xs text-neutral-300">Event: {event.event}</div>
            <div className="text-xs text-neutral-300">Action: {event.action}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportPanel() {
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

const COLOR_FORMAT_OPTIONS = [
  { value: "monochrome", label: "1-bit (Monochrome)" },
  { value: "grayscale8", label: "8-bit (Grayscale)" },
  { value: "rgb565", label: "16-bit (RGB565)" },
  { value: "rgb888", label: "24-bit (RGB888)" },
  { value: "argb8888", label: "32-bit (ARGB8888)" },
] as const;

function SettingsPanel() {
  const {
    state: { project },
    actions: { setColorFormat, updateScreenMeta },
  } = useEditorBackend();

  const activeScreen = getActiveScreenFromProject(project);
  const [widthDraft, setWidthDraft] = useState<string | null>(null);
  const [heightDraft, setHeightDraft] = useState<string | null>(null);

  const commitDimension = (key: "width" | "height", draft: string | null, fallback: number) => {
    const parsed = parseInt(draft ?? "", 10);
    const value = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    updateScreenMeta(activeScreen.id, key, value);
    if (key === "width") setWidthDraft(null);
    else setHeightDraft(null);
  };

  return (
    <div>
      <div className="text-sm font-semibold mb-3 text-neutral-100">Project Settings</div>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-300 mb-1 block">Project Name</label>
          <input
            type="text"
            defaultValue="smart_thermostat"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm focus:border-highlight-500 outline-none text-neutral-100"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-300 mb-1 block">Display Resolution</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={widthDraft ?? String(activeScreen.meta.width)}
              onChange={(e) => setWidthDraft(e.target.value)}
              onBlur={() => commitDimension("width", widthDraft, activeScreen.meta.width)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { commitDimension("width", widthDraft, activeScreen.meta.width); e.currentTarget.blur(); }
                if (e.key === "Escape") { setWidthDraft(null); e.currentTarget.blur(); }
              }}
              className="px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm focus:border-highlight-500 outline-none text-neutral-100"
            />
            <input
              type="text"
              value={heightDraft ?? String(activeScreen.meta.height)}
              onChange={(e) => setHeightDraft(e.target.value)}
              onBlur={() => commitDimension("height", heightDraft, activeScreen.meta.height)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { commitDimension("height", heightDraft, activeScreen.meta.height); e.currentTarget.blur(); }
                if (e.key === "Escape") { setHeightDraft(null); e.currentTarget.blur(); }
              }}
              className="px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm focus:border-highlight-500 outline-none text-neutral-100"
            />
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">Width × Height (px)</div>
        </div>
        <div>
          <label className="text-xs text-neutral-300 mb-1 block">Color Format</label>
          <select
            value={project.colorFormat ?? "rgb888"}
            onChange={(e) => setColorFormat(e.target.value as typeof COLOR_FORMAT_OPTIONS[number]["value"])}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm focus:border-highlight-500 outline-none cursor-pointer text-neutral-100"
          >
            {COLOR_FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {(project.colorFormat === "monochrome" || project.colorFormat === "grayscale8") && (
            <p className="mt-1 text-xs text-yellow-400">
              {project.colorFormat === "monochrome"
                ? "Colors will be quantized to black or white based on luminance."
                : "Colors will be converted to 8-bit grayscale."}
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-neutral-300 mb-1 block">Target Platform</label>
          <select className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm focus:border-highlight-500 outline-none cursor-pointer text-neutral-100">
            <option>ESP32</option>
            <option>STM32</option>
            <option>Arduino</option>
            <option>Desktop (SDL)</option>
          </select>
        </div>
      </div>
    </div>
  );
}