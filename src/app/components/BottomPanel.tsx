import { 
  Image as ImageIcon, 
  Palette, 
  Package, 
  Zap, 
  Settings as SettingsIcon,
  FileCode,
  Plus,
  Upload,
  Download
} from "lucide-react";

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
  const assets = [
    { name: "icon_home.png", size: "2.4 KB", type: "image" },
    { name: "icon_settings.png", size: "1.8 KB", type: "image" },
    { name: "background.jpg", size: "45.2 KB", type: "image" },
    { name: "logo.svg", size: "3.1 KB", type: "vector" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-200">Project Assets</div>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-[#5b9dd9] hover:bg-[#6ba8dd] rounded text-xs flex items-center gap-1 transition-colors text-white">
            <Upload size={12} />
            Import
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {assets.map((asset, i) => (
          <div
            key={i}
            className="p-3 bg-[#252525] hover:bg-[#3c3c3c] rounded cursor-pointer transition-colors border border-transparent hover:border-[#5b9dd9]/30"
          >
            <div className="w-full aspect-square bg-[#1e1e1e] rounded flex items-center justify-center mb-2">
              <ImageIcon size={24} className="text-gray-500" />
            </div>
            <div className="text-xs truncate text-gray-300">{asset.name}</div>
            <div className="text-[10px] text-gray-500">{asset.size}</div>
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