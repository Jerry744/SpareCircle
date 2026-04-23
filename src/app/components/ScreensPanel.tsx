import { useState } from "react";
import { Check, Copy, Monitor, Pencil, Plus, Save, Star, Trash2 } from "lucide-react";
import { useEditorBackend } from "../backend/editorStore";
import type { ProjectSnapshotV2 } from "../backend/types/projectV2";
import type { VariantAction } from "../backend/reducer/variantActions";

interface ScreensPanelProps {
  stateProject?: ProjectSnapshotV2;
  activeStateNodeId?: string;
  activeVariantId?: string;
  onOpenStateVariant?(stateNodeId: string, variantId: string): void;
  onVariantAction?(action: VariantAction): void;
}

export function ScreensPanel(props: ScreensPanelProps = {}) {
  if (props.stateProject && props.onVariantAction && props.onOpenStateVariant) {
    return <StateScreensPanel {...props as Required<Pick<ScreensPanelProps, "stateProject" | "onVariantAction" | "onOpenStateVariant">> & ScreensPanelProps} />;
  }
  return <LegacyScreensPanel />;
}

function StateScreensPanel({
  stateProject,
  activeStateNodeId,
  activeVariantId,
  onOpenStateVariant,
  onVariantAction,
}: Required<Pick<ScreensPanelProps, "stateProject" | "onVariantAction" | "onOpenStateVariant">> & ScreensPanelProps) {
  const [savedStateIds, setSavedStateIds] = useState<Set<string>>(new Set());
  const states = stateProject.navigationMap.stateNodeOrder
    .map((id) => stateProject.navigationMap.stateNodes[id])
    .filter(Boolean);

  return (
    <div className="shrink-0 flex flex-col min-h-0 max-h-[58%]">
      <div className="h-10 flex items-center justify-between px-3 border-b border-neutral-900">
        <span className="text-xs font-semibold text-neutral-300">SCREENS</span>
      </div>
      <div className="overflow-y-auto p-2 space-y-2">
        {states.map((stateNode) => {
          const board = stateProject.stateBoardsById[stateNode.boardId];
          const variants = board?.variantIds
            .map((id) => stateProject.variantsById[id])
            .filter(Boolean) ?? [];
          const isSaved = savedStateIds.has(stateNode.id);
          return (
            <section key={stateNode.id} className="rounded border border-neutral-800 bg-neutral-700/70">
              <div className="flex items-center gap-2 border-b border-neutral-800 px-2 py-2">
                <Monitor size={14} className="text-neutral-300" />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-neutral-100"
                  onClick={() => board && onOpenStateVariant(stateNode.id, board.canonicalVariantId)}
                >
                  {stateNode.name}
                </button>
                <button
                  type="button"
                  title="Save state panel"
                  className="flex h-6 w-6 items-center justify-center rounded text-neutral-300 hover:bg-neutral-600 hover:text-neutral-100"
                  onClick={() => setSavedStateIds((prev) => new Set(prev).add(stateNode.id))}
                >
                  {isSaved ? <Check size={13} /> : <Save size={13} />}
                </button>
              </div>
              {board ? (
                <div className="space-y-1 p-2">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-400">
                    <span>{board.meta.width} × {board.meta.height}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Blank screen"
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-neutral-600"
                        onClick={() => onVariantAction({ type: "createVariant", boardId: board.id, mode: "blank", name: "Blank Screen" })}
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        type="button"
                        title="Copy canonical"
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-neutral-600"
                        onClick={() => onVariantAction({ type: "createVariant", boardId: board.id, mode: "copy_current", name: "Screen Copy" })}
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                  {variants.map((variant) => {
                    const active = activeStateNodeId === stateNode.id && activeVariantId === variant.id;
                    const canonical = board.canonicalVariantId === variant.id;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                          active ? "bg-highlight-900 text-white" : "text-neutral-200 hover:bg-neutral-600"
                        }`}
                        onClick={() => onOpenStateVariant(stateNode.id, variant.id)}
                      >
                        {canonical ? <Star size={12} className="text-highlight-300" /> : <span className="h-3 w-3 rounded border border-neutral-500" />}
                        <span className="min-w-0 flex-1 truncate">{variant.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LegacyScreensPanel() {
  const {
    state: { project },
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
                screen.active ? "bg-highlight-900 text-white" : "hover:bg-neutral-600 text-neutral-200"
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
                  if (nextName) renameScreen(screen.id, nextName);
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
                  if (project.screens.length <= 1) return;
                  if (window.confirm(`Delete ${screen.name}?`)) deleteScreen(screen.id);
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
