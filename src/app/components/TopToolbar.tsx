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
  Palette
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
    actions: { undo, redo, serializeProject, hydrateProject, exportLvglC },
  } = useEditorBackend();

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
    <div className="h-12 bg-[#2c2c2c] border-b border-[#1e1e1e] flex items-center justify-between px-3 relative">
      {/* Left Section - Project Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#5b9dd9] to-[#7eb3e5] rounded flex items-center justify-center font-bold text-sm text-white">
            LV
          </div>
          <span className="font-semibold text-gray-100">LVGL Designer</span>
        </div>
        <div className="h-6 w-px bg-[#3c3c3c]" />
        <span className="text-sm text-gray-400">smart_thermostat.lvproj</span>
      </div>

      {/* Center Section - Main Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="px-3 py-1.5 hover:bg-[#3c3c3c] rounded flex items-center gap-2 transition-colors text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Undo size={16} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="px-3 py-1.5 hover:bg-[#3c3c3c] rounded flex items-center gap-2 transition-colors text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Redo size={16} />
        </button>
        <div className="h-6 w-px bg-[#3c3c3c] mx-1" />
        <button className="px-3 py-1.5 hover:bg-[#3c3c3c] rounded flex items-center gap-2 transition-colors text-gray-300">
          <Grid size={16} />
          <span className="text-sm">Grid</span>
        </button>
        <button
          onClick={() => setTokensOpen(true)}
          className="px-3 py-1.5 hover:bg-[#3c3c3c] rounded flex items-center gap-2 transition-colors text-gray-300"
        >
          <Palette size={16} />
          <span className="text-sm">Style Tokens ({project.styleTokens.length})</span>
        </button>
        <button className="px-3 py-1.5 hover:bg-[#3c3c3c] rounded flex items-center gap-2 transition-colors text-gray-300">
          <Maximize2 size={16} />
        </button>
        <div className="h-6 w-px bg-[#3c3c3c] mx-1" />
        <div className="flex items-center gap-1 bg-[#252525] rounded p-0.5">
          <button className="px-2 py-1 hover:bg-[#3c3c3c] rounded text-xs transition-colors text-gray-300">
            <Monitor size={14} />
          </button>
          <button className="px-2 py-1 hover:bg-[#3c3c3c] rounded text-xs transition-colors text-gray-300">
            <Sun size={14} />
          </button>
          <button className="px-2 py-1 hover:bg-[#3c3c3c] rounded text-xs transition-colors text-gray-300">
            <Moon size={14} />
          </button>
        </div>
      </div>

      {/* Right Section - Project Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleOpen}
          className="px-3 py-1.5 hover:bg-[#3c3c3c] rounded flex items-center gap-2 transition-colors text-gray-300"
        >
          <FolderOpen size={16} />
          <span className="text-sm">Open</span>
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 hover:bg-[#3c3c3c] rounded flex items-center gap-2 transition-colors text-gray-300"
        >
          <Save size={16} />
          <span className="text-sm">Save</span>
        </button>
        <button className="px-3 py-1.5 bg-[#5b9dd9] hover:bg-[#6ba8dd] rounded flex items-center gap-2 transition-colors text-white">
          <Play size={16} />
          <span className="text-sm">Simulate</span>
        </button>
        <button
          onClick={() => {
            void handleExport();
          }}
          className="px-3 py-1.5 bg-[#4caf50] hover:bg-[#5cb860] rounded flex items-center gap-2 transition-colors text-white"
        >
          <Download size={16} />
          <span className="text-sm">Export</span>
        </button>
        <div className="h-6 w-px bg-[#3c3c3c] mx-1" />
        <button className="px-3 py-1.5 hover:bg-[#3c3c3c] rounded flex items-center gap-2 transition-colors text-gray-300">
          <Settings size={16} />
        </button>
      </div>
      {importError ? (
        <div className="absolute right-3 -bottom-7 text-[11px] text-rose-400 bg-[#2c2c2c] px-2 py-1 rounded border border-[#4b1f27]">
          Open failed: {importError}
        </div>
      ) : null}
      {!importError && exportError ? (
        <div className="absolute right-3 -bottom-7 text-[11px] text-rose-400 bg-[#2c2c2c] px-2 py-1 rounded border border-[#4b1f27]">
          Export failed: {exportError}
        </div>
      ) : null}
      {!importError && !exportError && importWarning ? (
        <div className="absolute right-3 -bottom-7 text-[11px] text-amber-300 bg-[#2c2c2c] px-2 py-1 rounded border border-[#5c4314]">
          Imported with migration warning: {importWarning}
        </div>
      ) : null}
      <StyleTokensDialog open={tokensOpen} onOpenChange={setTokensOpen} />
    </div>
  );
}