import { 
  Square, 
  Type, 
  ToggleRight, 
  Circle,
  Image as ImageIcon,
  List,
  BarChart3,
  Calendar,
  Layers,
  Radio,
  CheckSquare,
  Sliders,
  Menu,
  Grid3x3
} from "lucide-react";
import { mapPaletteWidgetToType } from "../backend/editorStore";

interface Widget {
  id: string;
  name: string;
  icon: any;
  category: string;
}

const widgets: Widget[] = [
  { id: "container", name: "Container", icon: Square, category: "Layout" },
  { id: "panel", name: "Panel", icon: Layers, category: "Layout" },
  { id: "grid", name: "Grid", icon: Grid3x3, category: "Layout" },
  { id: "label", name: "Label", icon: Type, category: "Basic" },
  { id: "button", name: "Button", icon: Square, category: "Basic" },
  { id: "image", name: "Image", icon: ImageIcon, category: "Basic" },
  { id: "switch", name: "Switch", icon: ToggleRight, category: "Input" },
  { id: "slider", name: "Slider", icon: Sliders, category: "Input" },
  { id: "checkbox", name: "Checkbox", icon: CheckSquare, category: "Input" },
  { id: "radio", name: "Radio", icon: Radio, category: "Input" },
  { id: "dropdown", name: "Dropdown", icon: Menu, category: "Input" },
  { id: "arc", name: "Arc", icon: Circle, category: "Display" },
  { id: "bar", name: "Bar", icon: BarChart3, category: "Display" },
  { id: "chart", name: "Chart", icon: BarChart3, category: "Display" },
  { id: "calendar", name: "Calendar", icon: Calendar, category: "Display" },
  { id: "list", name: "List", icon: List, category: "Display" },
];

export function WidgetsPanel() {
  const categories = Array.from(new Set(widgets.map((w) => w.category)));

  return (
    <div className="h-full bg-[#2c2c2c] border-r border-[#1e1e1e] flex flex-col">
      <div className="h-10 flex items-center px-3 border-b border-[#1e1e1e]">
        <span className="text-xs font-semibold text-gray-400">WIDGETS</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {categories.map((category) => (
          <div key={category} className="mb-4">
            <div className="text-xs text-gray-500 mb-2 px-1 font-semibold">{category}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {widgets
                .filter((w) => w.category === category)
                .map((widget) => {
                  const supported = mapPaletteWidgetToType(widget.id) !== null;
                  return (
                  <div
                    key={widget.id}
                    className={`p-2 rounded flex flex-col items-center gap-1 transition-colors border ${
                      supported
                        ? "bg-[#252525] hover:bg-[#3c3c3c] cursor-pointer border-transparent hover:border-[#5b9dd9]/30"
                        : "bg-[#212121] cursor-not-allowed border-[#2a2a2a] opacity-45"
                    }`}
                    draggable={supported}
                    onDragStart={(e) => {
                      if (!supported) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData("widget", widget.id);
                    }}
                    title={supported ? widget.name : `${widget.name} (Demo2 暂不支持)`}
                  >
                    <widget.icon size={18} className="text-gray-400" />
                    <span className="text-xs text-center text-gray-300">{widget.name}</span>
                  </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}