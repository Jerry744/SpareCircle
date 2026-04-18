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
} from "lucide-react";
import { useEffect, useState } from "react";
import { useEditorBackend } from "../backend/editorStore";
import { StyleTokensDialog } from "./StyleTokensDialog";

export function TopToolbar() {
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [tokensOpen, setTokensOpen] = useState(false);
  const {
    state: {
      history,
      interaction,
      project,
    },
    actions: { undo, redo, serializeProject, hydrateProject, exportLvglC, setCanvasSnapSettings },
  } = useEditorBackend();

  const pixelSnapEnabled = project.canvasSnap?.pixelSnapEnabled ?? false;
  const magnetSnapEnabled = project.canvasSnap?.magnetSnapEnabled ?? true;

  const canUndo = history.past.length > 0 && !interaction;
  const canRedo = history.future.length > 0 && !interaction;

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
          undo();
        }
      }

      if ((key === "y") || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        if (canRedo) {
          redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const handleSave = () => {
    const serialized = serializeProject();
    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sparecircle-project.json";
    anchor.click();

    URL.revokeObjectURL(url);
    setImportError(null);
    setImportWarning(null);
    setExportError(null);
  };

  const handleOpen = () => {
    const pasted = window.prompt("Paste SpareCircle project JSON");
    if (pasted === null) {
      return;
    }

    const result = hydrateProject(pasted);
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
      {/* Left Section - Project Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-highlight-500 to-highlight-300 rounded flex items-center justify-center font-bold text-sm text-white">
            LV
          </div>
          <span className="font-semibold text-neutral-100">LVGL Designer</span>
        </div>
        <div className="h-6 w-px bg-neutral-600" />
        <span className="text-sm text-neutral-300">smart_thermostat.lvproj</span>
      </div>

      {/* Center Section - Main Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="px-3 py-1.5 hover:bg-neutral-600 rounded flex items-center gap-2 transition-colors text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Undo size={16} />
        </button>
        <button
          onClick={redo}
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
          onClick={() => setCanvasSnapSettings({ pixelSnapEnabled: !pixelSnapEnabled })}
          title="Pixel Snap"
          aria-label="Pixel Snap"
          aria-pressed={pixelSnapEnabled}
          className={`px-3 py-1.5 rounded flex items-center gap-2 transition-colors ${pixelSnapEnabled ? "bg-highlight-500 text-white" : "hover:bg-neutral-600 text-neutral-200"}`}
        >
          <Grid2x2 size={16} />
          <span className="text-sm">Pixel</span>
        </button>
        <button
          onClick={() => setCanvasSnapSettings({ magnetSnapEnabled: !magnetSnapEnabled })}
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
          <span className="text-sm">Style Tokens ({project.styleTokens.length})</span>
        </button>
        <button className="px-3 py-1.5 hover:bg-neutral-600 rounded flex items-center gap-2 transition-colors text-neutral-200">
          <Maximize2 size={16} />
        </button>
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
