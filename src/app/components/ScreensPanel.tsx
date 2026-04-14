import { Copy, Monitor, Pencil, Plus, Trash2 } from "lucide-react";
import { useEditorBackend } from "../backend/editorStore";

export function ScreensPanel() {
  const {
    state: {
      project,
    },
    actions: { setActiveScreen, createScreen, renameScreen, duplicateScreen, deleteScreen },
  } = useEditorBackend();

  const screens = project.screens.map((screen) => ({
    id: screen.id,
    name: screen.name,
    icon: Monitor,
    active: screen.id === project.activeScreenId,
  }));

  return (
    <div className="shrink-0 flex flex-col min-h-0 max-h-[40%]">
      <div className="h-10 flex items-center justify-between px-3 border-b border-[#1e1e1e]">
        <span className="text-xs font-semibold text-gray-400">SCREENS</span>
        <button
          className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-gray-400 hover:text-gray-200"
          onClick={() => createScreen()}
          aria-label="Create screen"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="overflow-y-auto p-2">
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
              <button
                className="p-1 hover:bg-[#4c4c4c] rounded text-gray-400 hover:text-gray-200"
                onClick={(event) => {
                  event.stopPropagation();
                  const nextName = window.prompt("Rename screen", screen.name)?.trim();
                  if (nextName) {
                    renameScreen(screen.id, nextName);
                  }
                }}
                aria-label="Rename screen"
              >
                <Pencil size={12} />
              </button>
              <button
                className="p-1 hover:bg-[#4c4c4c] rounded text-gray-400 hover:text-gray-200"
                onClick={(event) => {
                  event.stopPropagation();
                  duplicateScreen(screen.id);
                }}
                aria-label="Duplicate screen"
              >
                <Copy size={12} />
              </button>
              <button
                className="p-1 hover:bg-[#4c4c4c] rounded text-gray-400 hover:text-rose-300 disabled:opacity-40"
                disabled={project.screens.length <= 1}
                onClick={(event) => {
                  event.stopPropagation();
                  if (project.screens.length <= 1) {
                    return;
                  }
                  const approved = window.confirm(`Delete ${screen.name}?`);
                  if (approved) {
                    deleteScreen(screen.id);
                  }
                }}
                aria-label="Delete screen"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}