import { Plus, Monitor, Smartphone, Tablet } from "lucide-react";
import { useEditorBackend } from "../backend/editorStore";

export function ScreensPanel() {
  const {
    state: {
      project,
    },
    actions: { setActiveScreen },
  } = useEditorBackend();

  const screens = project.screens.map((screen) => ({
    id: screen.id,
    name: screen.name,
    icon: Monitor,
    active: screen.id === project.activeScreenId,
  }));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-10 flex items-center justify-between px-3 border-b border-[#1e1e1e]">
        <span className="text-xs font-semibold text-gray-400">SCREENS</span>
        <button className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-gray-400 hover:text-gray-200">
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {screens.map((screen) => (
            <div
              key={screen.id}
              className={`px-3 py-2 rounded cursor-pointer flex items-center gap-2 transition-colors ${
                screen.active
                  ? "bg-[#3c4a5d] text-white"
                  : "hover:bg-[#3c3c3c] text-gray-300"
              }`}
              onClick={() => setActiveScreen(screen.id)}
            >
              <screen.icon size={14} />
              <span className="text-sm flex-1">{screen.name}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-[#3c3c3c]">
          <div className="text-xs text-gray-500 mb-2 px-1">DEVICE PREVIEW</div>
          <div className="flex gap-2 px-1">
            <button className="flex-1 p-2 bg-[#3c4a5d] hover:bg-[#4a5a6d] rounded transition-colors flex items-center justify-center text-gray-200">
              <Monitor size={16} />
            </button>
            <button className="flex-1 p-2 hover:bg-[#3c3c3c] rounded transition-colors flex items-center justify-center text-gray-400">
              <Tablet size={16} />
            </button>
            <button className="flex-1 p-2 hover:bg-[#3c3c3c] rounded transition-colors flex items-center justify-center text-gray-400">
              <Smartphone size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}