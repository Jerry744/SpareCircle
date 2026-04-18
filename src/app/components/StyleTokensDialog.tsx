import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { USER_STYLE_TOKEN_PRESET } from "../constants/styleTokenPresets";
import { useEditorBackend } from "../backend/editorStore";

interface StyleTokensDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StyleTokensDialog({ open, onOpenChange }: StyleTokensDialogProps) {
  const [nameDraft, setNameDraft] = useState("");
  const [valueDraft, setValueDraft] = useState("#3B82F6");
  const [error, setError] = useState<string | null>(null);

  const {
    state: {
      project,
      selectedWidgetIds,
    },
    actions: {
      createStyleToken,
      updateStyleToken,
      deleteStyleToken,
    },
  } = useEditorBackend();

  const tokenUsageById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const widget of Object.values(project.widgetsById)) {
      if (widget.fillTokenId) {
        counts.set(widget.fillTokenId, (counts.get(widget.fillTokenId) ?? 0) + 1);
      }
      if (widget.textColorTokenId) {
        counts.set(widget.textColorTokenId, (counts.get(widget.textColorTokenId) ?? 0) + 1);
      }
    }
    return counts;
  }, [project.widgetsById]);

  const handleCreate = () => {
    const normalizedName = nameDraft.trim();
    const normalizedValue = valueDraft.trim();

    if (!normalizedName) {
      setError("Token name is required.");
      return;
    }
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizedValue)) {
      setError("Token color must be a valid hex value.");
      return;
    }

    createStyleToken(normalizedName, normalizedValue);
    setNameDraft("");
    setError(null);
  };

  const handleImportMaterialPreset = () => {
    for (const token of USER_STYLE_TOKEN_PRESET) {
      createStyleToken(token.name, token.value);
    }
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-neutral-600 bg-neutral-800 text-neutral-100 shadow-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-neutral-100">Style Tokens</DialogTitle>
          <DialogDescription className="text-neutral-300">
            MVP supports hex color tokens. A future settings panel will add RGB/HSL and more palettes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-neutral-600 bg-neutral-900/80 px-3 py-2">
            <div className="text-xs text-neutral-300">
              {project.styleTokens.length} token(s), {selectedWidgetIds.length} widget(s) selected
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="border border-highlight-700 bg-highlight-900 text-highlight-100 hover:bg-highlight-800"
              onClick={handleImportMaterialPreset}
            >
              Import Material Preset
            </Button>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2 rounded-md border border-neutral-600 bg-neutral-900/60 p-3">
            <div>
              <label className="text-xs text-neutral-300">Token Name</label>
              <Input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="Primary"
                className="mt-1 border-neutral-600 bg-neutral-800 text-neutral-100 placeholder:text-neutral-400 focus-visible:border-highlight-500 focus-visible:ring-highlight-500/30"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-300">Color</label>
              <Input
                type="color"
                value={valueDraft}
                onChange={(event) => setValueDraft(event.target.value)}
                className="mt-1 w-14 border-neutral-600 bg-neutral-800 p-1"
              />
            </div>
            <Button type="button" className="bg-highlight-500 text-neutral-950 hover:bg-highlight-400" onClick={handleCreate}>Add</Button>
          </div>
          {error ? <div className="text-xs text-error-400">{error}</div> : null}

          <div className="max-h-72 overflow-auto rounded-md border border-neutral-600 bg-neutral-900/70">
            {project.styleTokens.map((token) => (
              <div key={token.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 border-b border-neutral-600/80 px-3 py-2 last:border-b-0">
                <span className="inline-flex h-3 w-3 rounded-full border border-neutral-500 shadow-[0_0_0_1px_theme(colors.neutral.900)]" style={{ backgroundColor: token.value }} />
                <Input
                  value={token.name}
                  onChange={(event) => updateStyleToken(token.id, { name: event.target.value })}
                  className="border-neutral-600 bg-neutral-800 text-neutral-100 focus-visible:border-highlight-500 focus-visible:ring-highlight-500/30"
                />
                <Input
                  type="color"
                  value={token.value}
                  onChange={(event) => updateStyleToken(token.id, { value: event.target.value })}
                  className="w-14 border-neutral-600 bg-neutral-800 p-1"
                />
                <Button
                  type="button"
                  size="sm"
                  className="border border-error-900 bg-error-900/50 text-error-100 hover:bg-error-900/80"
                  onClick={() => deleteStyleToken(token.id)}
                >
                  Delete{tokenUsageById.get(token.id) ? ` (${tokenUsageById.get(token.id)})` : ""}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-neutral-600 bg-neutral-900 text-neutral-200 hover:bg-neutral-700 hover:text-neutral-100"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
