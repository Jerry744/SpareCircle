import { useState } from "react";
import { getActiveScreenFromProject, useEditorBackend } from "../../backend/editorStore";

const COLOR_FORMAT_OPTIONS = [
  { value: "monochrome", label: "1-bit (Monochrome)" },
  { value: "grayscale8", label: "8-bit (Grayscale)" },
  { value: "rgb565", label: "16-bit (RGB565)" },
  { value: "rgb888", label: "24-bit (RGB888)" },
  { value: "argb8888", label: "32-bit (ARGB8888)" },
] as const;

export function SettingsPanel() {
  const {
    state: { project },
    actions: { setColorFormat, updateScreenMeta },
  } = useEditorBackend();
  const activeScreen = getActiveScreenFromProject(project);
  const [widthDraft, setWidthDraft] = useState<string | null>(null);
  const [heightDraft, setHeightDraft] = useState<string | null>(null);

  const commitDimension = (key: "width" | "height", draft: string | null, fallback: number) => {
    const parsed = parseInt(draft ?? "", 10);
    const value = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    updateScreenMeta(activeScreen.id, key, value);
    if (key === "width") {
      setWidthDraft(null);
    } else {
      setHeightDraft(null);
    }
  };

  return (
    <div>
      <div className="text-sm font-semibold mb-3 text-neutral-100">Project Settings</div>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-neutral-300 mb-1 block">Project Name</label>
          <input
            type="text"
            defaultValue="smart_thermostat"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm focus:border-highlight-500 outline-none text-neutral-100"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-300 mb-1 block">Display Resolution</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={widthDraft ?? String(activeScreen.meta.width)}
              onChange={(event) => setWidthDraft(event.target.value)}
              onBlur={() => commitDimension("width", widthDraft, activeScreen.meta.width)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitDimension("width", widthDraft, activeScreen.meta.width);
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setWidthDraft(null);
                  event.currentTarget.blur();
                }
              }}
              className="px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm focus:border-highlight-500 outline-none text-neutral-100"
            />
            <input
              type="text"
              value={heightDraft ?? String(activeScreen.meta.height)}
              onChange={(event) => setHeightDraft(event.target.value)}
              onBlur={() => commitDimension("height", heightDraft, activeScreen.meta.height)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitDimension("height", heightDraft, activeScreen.meta.height);
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setHeightDraft(null);
                  event.currentTarget.blur();
                }
              }}
              className="px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm focus:border-highlight-500 outline-none text-neutral-100"
            />
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">Width × Height (px)</div>
        </div>
        <div>
          <label className="text-xs text-neutral-300 mb-1 block">Color Format</label>
          <select
            value={project.colorFormat ?? "rgb888"}
            onChange={(event) => setColorFormat(event.target.value as typeof COLOR_FORMAT_OPTIONS[number]["value"])}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm focus:border-highlight-500 outline-none cursor-pointer text-neutral-100"
          >
            {COLOR_FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {(project.colorFormat === "monochrome" || project.colorFormat === "grayscale8") ? (
            <p className="mt-1 text-xs text-yellow-400">
              {project.colorFormat === "monochrome"
                ? "Colors will be quantized to black or white based on luminance."
                : "Colors will be converted to 8-bit grayscale."}
            </p>
          ) : null}
        </div>
        <div>
          <label className="text-xs text-neutral-300 mb-1 block">Target Platform</label>
          <select className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm focus:border-highlight-500 outline-none cursor-pointer text-neutral-100">
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
