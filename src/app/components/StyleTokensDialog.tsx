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
import { MATERIAL_COLOR_PRESET } from "../constants/designTokens";
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
    for (const token of MATERIAL_COLOR_PRESET) {
      createStyleToken(token.name, token.value);
    }
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Style Tokens</DialogTitle>
          <DialogDescription>
            MVP supports hex color tokens. A future settings panel will add RGB/HSL and more palettes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {project.styleTokens.length} token(s), {selectedWidgetIds.length} widget(s) selected
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleImportMaterialPreset}>
              Import Material Preset
            </Button>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Token Name</label>
              <Input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="Primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Color</label>
              <Input type="color" value={valueDraft} onChange={(event) => setValueDraft(event.target.value)} className="w-14 p-1" />
            </div>
            <Button type="button" onClick={handleCreate}>Add</Button>
          </div>
          {error ? <div className="text-xs text-rose-500">{error}</div> : null}

          <div className="max-h-72 overflow-auto rounded border">
            {project.styleTokens.map((token) => (
              <div key={token.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-3 py-2 border-b last:border-b-0">
                <span className="inline-flex h-3 w-3 rounded-full border" style={{ backgroundColor: token.value }} />
                <Input
                  value={token.name}
                  onChange={(event) => updateStyleToken(token.id, { name: event.target.value })}
                />
                <Input
                  type="color"
                  value={token.value}
                  onChange={(event) => updateStyleToken(token.id, { value: event.target.value })}
                  className="w-14 p-1"
                />
                <Button type="button" variant="destructive" size="sm" onClick={() => deleteStyleToken(token.id)}>
                  Delete{tokenUsageById.get(token.id) ? ` (${tokenUsageById.get(token.id)})` : ""}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}