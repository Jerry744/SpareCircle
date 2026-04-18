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
      <div className="h-10 flex items-center justify-between px-3 border-b border-neutral-900">
        <span className="text-xs font-semibold text-neutral-300">SCREENS</span>
        <button
          className="p-1 hover:bg-neutral-600 rounded transition-colors text-neutral-300 hover:text-neutral-100"
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
                  ? "bg-highlight-900 text-white"
                  : "hover:bg-neutral-600 text-neutral-200"
              }`}
              onClick={() => setActiveScreen(screen.id)}
            >
              <screen.icon size={14} />
              <span className="text-sm flex-1">{screen.name}</span>
              <button
                className="p-1 hover:bg-neutral-500 rounded text-neutral-300 hover:text-neutral-100"
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
                className="p-1 hover:bg-neutral-500 rounded text-neutral-300 hover:text-neutral-100"
                onClick={(event) => {
                  event.stopPropagation();
                  duplicateScreen(screen.id);
                }}
                aria-label="Duplicate screen"
              >
                <Copy size={12} />
              </button>
              <button
                className="p-1 hover:bg-neutral-500 rounded text-neutral-300 hover:text-error-400 disabled:opacity-40"
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