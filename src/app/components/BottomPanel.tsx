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
import { useEditorBackend } from "../backend/editorStore";

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
    <div className="h-56 bg-[#2c2c2c] border-t border-[#1e1e1e] flex flex-col">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 pt-1 border-b border-[#1e1e1e]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-2 flex items-center gap-2 text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-[#5b9dd9] text-gray-100"
                : "border-transparent text-gray-400 hover:text-gray-200"
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
        <div className="text-sm font-semibold text-gray-200">Project Assets</div>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 bg-[#5b9dd9] hover:bg-[#6ba8dd] rounded text-xs flex items-center gap-1 transition-colors text-white"
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
        <div className="text-xs text-gray-500 border border-dashed border-[#3c3c3c] rounded p-4">
          No assets yet. Import image files here to use them in Image widgets.
        </div>
      ) : null}
      <div className="grid grid-cols-4 gap-2">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="p-3 bg-[#252525] hover:bg-[#3c3c3c] rounded transition-colors border border-transparent hover:border-[#5b9dd9]/30"
          >
            <div className="w-full aspect-square bg-[#1e1e1e] rounded flex items-center justify-center mb-2">
              <img src={asset.dataUrl} alt={asset.name} className="max-w-full max-h-full object-contain rounded" />
            </div>
            <div className="text-xs truncate text-gray-300">{asset.name}</div>
            <div className="text-[10px] text-gray-500">{asset.mimeType} • {formatBytes(estimateAssetSize(asset.dataUrl))}</div>
            <button
              type="button"
              onClick={() => deleteAsset(asset.id)}
              className="mt-2 px-2 py-1 text-[10px] rounded border border-[#4a2c2c] text-rose-300 hover:bg-[#3a2323] flex items-center gap-1"
            >
              <Trash2 size={10} />
              Delete
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
        <div className="text-sm font-semibold text-gray-200">Reusable Components</div>
        <button className="px-3 py-1 bg-[#5b9dd9] hover:bg-[#6ba8dd] rounded text-xs flex items-center gap-1 transition-colors text-white">
          <Plus size={12} />
          Create
        </button>
      </div>
      <div className="space-y-2">
        {components.map((comp, i) => (
          <div
            key={i}
            className="p-3 bg-[#252525] hover:bg-[#3c3c3c] rounded cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-[#5b9dd9]/30"
          >
            <div>
              <div className="text-sm text-gray-200">{comp.name}</div>
              <div className="text-xs text-gray-500">{comp.widgets} widgets</div>
            </div>
            <Package size={16} className="text-gray-500" />
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
      <div className="text-sm font-semibold mb-3 text-gray-200">Global Theme Colors</div>
      <div className="grid grid-cols-3 gap-3">
        {colors.map((color, i) => (
          <div key={i} className="p-3 bg-[#252525] rounded border border-[#3c3c3c]">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded border border-[#3c3c3c]"
                style={{ backgroundColor: color.value }}
              />
              <div className="flex-1">
                <div className="text-xs text-gray-200">{color.name}</div>
                <div className="text-[10px] text-gray-500">{color.value}</div>
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
        <div className="text-sm font-semibold text-gray-200">Event Handlers</div>
        <button className="px-3 py-1 bg-[#5b9dd9] hover:bg-[#6ba8dd] rounded text-xs flex items-center gap-1 transition-colors text-white">
          <Plus size={12} />
          Add Event
        </button>
      </div>
      <div className="space-y-2">
        {events.map((event, i) => (
          <div key={i} className="p-3 bg-[#252525] rounded border border-[#3c3c3c]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-200">{event.widget}</div>
              <Zap size={14} className="text-[#fbbf24]" />
            </div>
            <div className="text-xs text-gray-400">Event: {event.event}</div>
            <div className="text-xs text-gray-400">Action: {event.action}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportPanel() {
  return (
    <div>
      <div className="text-sm font-semibold mb-3 text-gray-200">Export Options</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-[#252525] hover:bg-[#3c3c3c] rounded cursor-pointer transition-colors border border-transparent hover:border-[#5b9dd9]/30">
          <FileCode size={24} className="text-[#5b9dd9] mb-2" />
          <div className="text-sm font-semibold mb-1 text-gray-200">C Source Code</div>
          <div className="text-xs text-gray-400">Export as LVGL C files</div>
        </div>
        <div className="p-4 bg-[#252525] hover:bg-[#3c3c3c] rounded cursor-pointer transition-colors border border-transparent hover:border-[#5b9dd9]/30">
          <Download size={24} className="text-[#4caf50] mb-2" />
          <div className="text-sm font-semibold mb-1 text-gray-200">Binary</div>
          <div className="text-xs text-gray-400">Compile and download</div>
        </div>
      </div>
      <div className="mt-4 p-3 bg-[#252525] rounded border border-[#3c3c3c]">
        <div className="text-xs text-gray-400 mb-2">Export Settings</div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" defaultChecked className="rounded accent-[#5b9dd9]" />
            Include assets
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" defaultChecked className="rounded accent-[#5b9dd9]" />
            Generate screen navigation
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" className="rounded accent-[#5b9dd9]" />
            Optimize for size
          </label>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div>
      <div className="text-sm font-semibold mb-3 text-gray-200">Project Settings</div>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Project Name</label>
          <input
            type="text"
            defaultValue="smart_thermostat"
            className="w-full px-3 py-2 bg-[#252525] border border-[#3c3c3c] rounded text-sm focus:border-[#5b9dd9] outline-none text-gray-200"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Display Resolution</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              defaultValue="480"
              className="px-3 py-2 bg-[#252525] border border-[#3c3c3c] rounded text-sm focus:border-[#5b9dd9] outline-none text-gray-200"
            />
            <input
              type="text"
              defaultValue="320"
              className="px-3 py-2 bg-[#252525] border border-[#3c3c3c] rounded text-sm focus:border-[#5b9dd9] outline-none text-gray-200"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Color Depth</label>
          <select className="w-full px-3 py-2 bg-[#252525] border border-[#3c3c3c] rounded text-sm focus:border-[#5b9dd9] outline-none cursor-pointer text-gray-200">
            <option>16-bit (RGB565)</option>
            <option>24-bit (RGB888)</option>
            <option>32-bit (ARGB8888)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Target Platform</label>
          <select className="w-full px-3 py-2 bg-[#252525] border border-[#3c3c3c] rounded text-sm focus:border-[#5b9dd9] outline-none cursor-pointer text-gray-200">
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