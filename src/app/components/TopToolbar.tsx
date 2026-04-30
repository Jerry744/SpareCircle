import {
  Save,
  FolderOpen,
  Play,
  Download,
  Settings,
  Undo,
  Redo,
  Grid,
  Maximize2,
  Sun,
  Moon,
  Monitor,
  Palette,
  Magnet,
  Grid2x2,
  PanelLeft,
  PanelRight,
  PanelBottom,
  GitBranch,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useEditorBackend } from "../backend/editorStore";
import { StyleTokensDialog } from "./StyleTokensDialog";
import { useLayout } from "./layoutContext";

export type EditorSurfaceMode = "ui" | "navmap";

interface TopToolbarProps {
  surfaceMode?: EditorSurfaceMode;
  onSurfaceModeChange?: (mode: EditorSurfaceMode) => void;
  undoState?: {
    canUndo: boolean;
    canRedo: boolean;
    onUndo(): void;
    onRedo(): void;
  };
  projectControls?: {
    projectName: string;
    styleTokenCount: number;
    pixelSnapEnabled: boolean;
    magnetSnapEnabled: boolean;
    serializeProject(): string;
    hydrateProject(serializedProject: string): { ok: true; warning?: string } | { ok: false; error: string };
    setProjectName(projectName: string): void;
    setCanvasSnapSettings(settings: { pixelSnapEnabled?: boolean; magnetSnapEnabled?: boolean }): void;
  };
}

export function TopToolbar({
  surfaceMode = "ui",
  onSurfaceModeChange,
  undoState,
  projectControls,
}: TopToolbarProps = {}) {
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [tokensOpen, setTokensOpen] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState("");
  const {
    state: {
      history,
      interaction,
      project,
    },
    actions: { undo, redo, serializeProject, hydrateProject, exportLvglC, setCanvasSnapSettings, setProjectName },
  } = useEditorBackend();

  const layout = useLayout();

  const projectName = projectControls?.projectName ?? project.projectName;
  const styleTokenCount = projectControls?.styleTokenCount ?? project.styleTokens.length;
  const pixelSnapEnabled = projectControls?.pixelSnapEnabled ?? project.canvasSnap?.pixelSnapEnabled ?? false;
  const magnetSnapEnabled = projectControls?.magnetSnapEnabled ?? project.canvasSnap?.magnetSnapEnabled ?? true;

  const canUndo = undoState?.canUndo ?? (history.past.length > 0 && !interaction);
  const canRedo = undoState?.canRedo ?? (history.future.length > 0 && !interaction);
  const undoAction = undoState?.onUndo ?? undo;
  const redoAction = undoState?.onRedo ?? redo;

  useEffect(() => {
    if (!isEditingProjectName) {
      setProjectNameInput(projectName);
    }
  }, [projectName, isEditingProjectName]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        return;
      }

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) {
          undoAction();
        }
      }

      if ((key === "y") || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        if (canRedo) {
          redoAction();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, undoAction, redoAction]);

  const handleSave = () => {
    const serialized = projectControls?.serializeProject() ?? serializeProject();
    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    const normalizedFileName = projectName.trim() || "sparecircle-project";
    anchor.download = normalizedFileName.endsWith(".json") ? normalizedFileName : `${normalizedFileName}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
    setImportError(null);
    setImportWarning(null);
    setExportError(null);
  };

  const commitProjectName = () => {
    const nextName = projectNameInput.trim();
    (projectControls?.setProjectName ?? setProjectName)(nextName || projectName);
    setIsEditingProjectName(false);
  };

  const handleOpen = () => {
    const pasted = window.prompt("Paste SpareCircle project JSON");
    if (pasted === null) {
      return;
    }

    const result = projectControls?.hydrateProject(pasted) ?? hydrateProject(pasted);
    if (!result.ok) {
      setImportError(result.error);
      setImportWarning(null);
      return;
    }

    setImportError(null);
    setImportWarning(result.warning ?? null);
    setExportError(null);
  };

  const handleExport = async () => {
    const result = await exportLvglC();
    if (!result.ok) {
      setExportError(result.error);
      return;
    }

    setExportError(null);
    setImportError(null);
    setImportWarning(null);
  };

  return (
    <div className="h-12 bg-neutral-700 border-b border-neutral-900 flex items-center justify-between px-3 relative">
      {/* Left Section - Project Info + Panel Toggles */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">

          <span className="font-semibold text-neutral-100">SpareCircle</span>
        </div>
        <div className="h-6 w-px bg-neutral-600" />
        {isEditingProjectName ? (
          <input
            value={projectNameInput}
            autoFocus
            onChange={(event) => setProjectNameInput(event.target.value)}
            onBlur={commitProjectName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitProjectName();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setProjectNameInput(projectName);
                setIsEditingProjectName(false);
              }
            }}
            className="text-sm text-neutral-100 bg-neutral-800 border border-neutral-500 rounded px-2 py-0.5 min-w-[220px]"
            aria-label="Project name"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingProjectName(true)}
            className="text-sm text-neutral-300 hover:text-neutral-100 transition-colors"
            title="Rename project"
          >
            {projectName}
          </button>
        )}
        <div className="h-6 w-px bg-neutral-600" />

        {/* Panel Toggle Buttons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={layout.toggleLeftSidebar}
            title={layout.leftSidebarCollapsed ? "Show Left Panel" : "Hide Left Panel"}
            aria-label={layout.leftSidebarCollapsed ? "Show Left Panel" : "Hide Left Panel"}
            aria-pressed={!layout.leftSidebarCollapsed}
            className={`p-1.5 rounded flex items-center justify-center transition-colors ${
              !layout.leftSidebarCollapsed
                ? "bg-highlight-500/20 text-highlight-400"
                : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-600"
            }`}
          >
            <PanelLeft size={16} />
          </button>
          <button
            onClick={layout.toggleBottomPanel}
            title={layout.bottomPanelCollapsed ? "Show Bottom Panel" : "Hide Bottom Panel"}
            aria-label={layout.bottomPanelCollapsed ? "Show Bottom Panel" : "Hide Bottom Panel"}
            aria-pressed={!layout.bottomPanelCollapsed}
            className={`p-1.5 rounded flex items-center justify-center transition-colors ${
              !layout.bottomPanelCollapsed
                ? "bg-highlight-500/20 text-highlight-400"
                : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-600"
            }`}
          >
            <PanelBottom size={16} />
          </button>
          <button
            onClick={layout.toggleRightSidebar}
            title={layout.rightSidebarCollapsed ? "Show Right Panel" : "Hide Right Panel"}
            aria-label={layout.rightSidebarCollapsed ? "Show Right Panel" : "Hide Right Panel"}
            aria-pressed={!layout.rightSidebarCollapsed}
            className={`p-1.5 rounded flex items-center justify-center transition-colors ${
              !layout.rightSidebarCollapsed
                ? "bg-highlight-500/20 text-highlight-400"
                : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-600"
            }`}
          >
            <PanelRight size={16} />
          </button>
        </div>
      </div>

      {/* Center Section - Main Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={undoAction}
          disabled={!canUndo}
          className="px-3 py-1.5 hover:bg-neutral-600 rounded flex items-center gap-2 transition-colors text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Undo size={16} />
        </button>
        <button
          onClick={redoAction}
          disabled={!canRedo}
          className="px-3 py-1.5 hover:bg-neutral-600 rounded flex items-center gap-2 transition-colors text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Redo size={16} />
        </button>
        <div className="h-6 w-px bg-neutral-600 mx-1" />
        <button className="px-3 py-1.5 hover:bg-neutral-600 rounded flex items-center gap-2 transition-colors text-neutral-200">
          <Grid size={16} />
          <span className="text-sm">Grid</span>
        </button>
        <button
          onClick={() => (projectControls?.setCanvasSnapSettings ?? setCanvasSnapSettings)({ pixelSnapEnabled: !pixelSnapEnabled })}
          title="Pixel Snap"
          aria-label="Pixel Snap"
          aria-pressed={pixelSnapEnabled}
          className={`px-3 py-1.5 rounded flex items-center gap-2 transition-colors ${pixelSnapEnabled ? "bg-highlight-500 text-white" : "hover:bg-neutral-600 text-neutral-200"}`}
        >
          <Grid2x2 size={16} />
          <span className="text-sm">Pixel</span>
        </button>
        <button
          onClick={() => (projectControls?.setCanvasSnapSettings ?? setCanvasSnapSettings)({ magnetSnapEnabled: !magnetSnapEnabled })}
          title="Magnet Snap"
          aria-label="Magnet Snap"
          aria-pressed={magnetSnapEnabled}
          className={`px-3 py-1.5 rounded flex items-center gap-2 transition-colors ${magnetSnapEnabled ? "bg-highlight-500 text-white" : "hover:bg-neutral-600 text-neutral-200"}`}
        >
          <Magnet size={16} />
          <span className="text-sm">Snap</span>
        </button>
        <button
          onClick={() => setTokensOpen(true)}
          className="px-3 py-1.5 hover:bg-neutral-600 rounded flex items-center gap-2 transition-colors text-neutral-200"
        >
          <Palette size={16} />
          <span className="text-sm">Style Tokens ({styleTokenCount})</span>
        </button>
        <button className="px-3 py-1.5 hover:bg-neutral-600 rounded flex items-center gap-2 transition-colors text-neutral-200">
          <Maximize2 size={16} />
        </button>
        <div className="h-6 w-px bg-neutral-600 mx-1" />
        <div className="flex items-center gap-1 bg-neutral-800 rounded p-0.5">
          <button
            onClick={() => onSurfaceModeChange?.("ui")}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              surfaceMode === "ui"
                ? "bg-highlight-500 text-white"
                : "text-neutral-200 hover:bg-neutral-600"
            }`}
            title="Switch to UI Canvas"
          >
            UI
          </button>
          <button
            onClick={() => onSurfaceModeChange?.("navmap")}
            className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
              surfaceMode === "navmap"
                ? "bg-highlight-500 text-white"
                : "text-neutral-200 hover:bg-neutral-600"
            }`}
            title="Switch to Navigation Map"
          >
            <GitBranch size={12} />
            NavMap
          </button>
        </div>
        <div className="h-6 w-px bg-neutral-600 mx-1" />
        <div className="flex items-center gap-1 bg-neutral-800 rounded p-0.5">
          <button className="px-2 py-1 hover:bg-neutral-600 rounded text-xs transition-colors text-neutral-200">
            <Monitor size={14} />
          </button>
          <button className="px-2 py-1 hover:bg-neutral-600 rounded text-xs transition-colors text-neutral-200">
            <Sun size={14} />
          </button>
          <button className="px-2 py-1 hover:bg-neutral-600 rounded text-xs transition-colors text-neutral-200">
            <Moon size={14} />
          </button>
        </div>
      </div>

      {/* Right Section - Project Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleOpen}
          className="px-3 py-1.5 hover:bg-neutral-600 rounded flex items-center gap-2 transition-colors text-neutral-200"
        >
          <FolderOpen size={16} />
          <span className="text-sm">Open</span>
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 hover:bg-neutral-600 rounded flex items-center gap-2 transition-colors text-neutral-200"
        >
          <Save size={16} />
          <span className="text-sm">Save</span>
        </button>
        <button className="px-3 py-1.5 bg-highlight-500 hover:bg-highlight-400 rounded flex items-center gap-2 transition-colors text-white">
          <Play size={16} />
          <span className="text-sm">Simulate</span>
        </button>
        <button
          onClick={() => {
            void handleExport();
          }}
          className="px-3 py-1.5 bg-success-500 hover:bg-success-400 rounded flex items-center gap-2 transition-colors text-white"
        >
          <Download size={16} />
          <span className="text-sm">Export</span>
        </button>
        <div className="h-6 w-px bg-neutral-600 mx-1" />
        <button className="px-3 py-1.5 hover:bg-neutral-600 rounded flex items-center gap-2 transition-colors text-neutral-200">
          <Settings size={16} />
        </button>
      </div>
      {importError ? (
        <div className="absolute right-3 -bottom-7 text-[11px] text-rose-400 bg-neutral-700 px-2 py-1 rounded border border-error-900">
          Open failed: {importError}
        </div>
      ) : null}
      {!importError && exportError ? (
        <div className="absolute right-3 -bottom-7 text-[11px] text-rose-400 bg-neutral-700 px-2 py-1 rounded border border-error-900">
          Export failed: {exportError}
        </div>
      ) : null}
      {!importError && !exportError && importWarning ? (
        <div className="absolute right-3 -bottom-7 text-[11px] text-amber-300 bg-neutral-700 px-2 py-1 rounded border border-warning-900">
          Imported with migration warning: {importWarning}
        </div>
      ) : null}
      <StyleTokensDialog open={tokensOpen} onOpenChange={setTokensOpen} />
    </div>
  );
}
