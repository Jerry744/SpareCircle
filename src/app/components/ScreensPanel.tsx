import { Copy, Monitor, Pencil, Plus, Trash2 } from "lucide-react";
import { useEditorBackend } from "../backend/editorStore";
import type { ProjectSnapshotV2, StateSectionNode } from "../backend/types/projectV2";
import type { VariantAction } from "../backend/reducer/variantActions";
import { makeSectionId } from "../backend/stateBoard/sectionModel";

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
  onOpenStateVariant,
  onVariantAction: _onVariantAction,
}: Required<Pick<ScreensPanelProps, "stateProject" | "onVariantAction" | "onOpenStateVariant">> & ScreensPanelProps) {
  const activeScreenId = activeStateNodeId
    ? stateProject.navigationMap.stateNodes[activeStateNodeId]?.screenGroupId
    : undefined;
  const states = stateProject.navigationMap.stateNodeOrder
    .map((id) => stateProject.navigationMap.stateNodes[id])
    .filter((stateNode) => !activeScreenId || stateNode?.screenGroupId === activeScreenId)
    .filter(Boolean);

  return (
    <div className="shrink-0 flex flex-col min-h-0 max-h-[58%]">
      <div className="h-10 flex items-center px-3">
        <span className="text-xs font-semibold text-neutral-300">States</span>
      </div>
      <div className="overflow-y-auto p-2">
        {states.map((stateNode) => {
          const board = stateProject.stateBoardsById[stateNode.boardId];
          const canonicalVariant = board ? stateProject.variantsById[board.canonicalVariantId] : undefined;
          const isActive = activeStateNodeId === stateNode.id;
          const sectionId = makeSectionId(canonicalVariant?.id ?? "");
          const sectionNode = stateProject.treeNodesById?.[sectionId];
          const canonicalFrameWId = sectionNode?.kind === "state_section"
            ? sectionNode.childrenIds.find((cid) => stateProject.widgetsById[cid]?.frameRole === "canonical")
            : undefined;
          const bindingStatus = canonicalVariant && canonicalFrameWId === canonicalVariant.rootWidgetId
            ? "valid"
            : sectionNode
              ? "conflict"
              : "missing";
          return (
            <button
              key={stateNode.id}
              type="button"
              className={`flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-left text-xs ${
                isActive ? "bg-highlight-900 text-white" : "text-neutral-200 hover:bg-neutral-700"
              }`}
              onClick={() => {
                if (!board) return;
                onOpenStateVariant(stateNode.id, board.canonicalVariantId);
              }}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{stateNode.name}</span>
              <span className={isActive ? "text-neutral-100" : "text-neutral-400"}>{bindingStatus}</span>
            </button>
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
