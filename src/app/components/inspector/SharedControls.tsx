import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { ProjectSnapshot } from "../../backend/types";
import {
  INSPECTOR_ERROR_CLASS,
  INSPECTOR_INPUT_CLASS,
  INSPECTOR_SECTION_BUTTON_CLASS,
  INSPECTOR_SELECT_CONTENT_CLASS,
  INSPECTOR_SELECT_ITEM_CLASS,
  INSPECTOR_SELECT_TRIGGER_CLASS,
} from "./config";

export function AssetProperty({
  selectedAssetId,
  options,
  onChange,
  onDelete,
}: {
  selectedAssetId: string | null;
  options: ProjectSnapshot["assets"][string][];
  onChange: (assetId: string | null) => void;
  onDelete: (assetId: string) => void;
}) {
  const selectedAsset = selectedAssetId
    ? (options.find((item) => item.id === selectedAssetId) ?? null)
    : null;

  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-300">Source</div>
      <div className="flex items-center gap-2">
        <Select
          value={selectedAssetId ?? "__none__"}
          onValueChange={(v) => onChange(v === "__none__" ? null : v)}
        >
          <SelectTrigger className={INSPECTOR_SELECT_TRIGGER_CLASS}>
            <SelectValue placeholder="No asset selected">
              {selectedAsset ? selectedAsset.name : "No asset selected"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className={INSPECTOR_SELECT_CONTENT_CLASS}>
            <SelectItem className={INSPECTOR_SELECT_ITEM_CLASS} value="__none__">No asset selected</SelectItem>
            {options.map((asset) => (
              <SelectItem className={INSPECTOR_SELECT_ITEM_CLASS} key={asset.id} value={asset.id}>{asset.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-neutral-600 bg-neutral-900 px-2 text-neutral-200 hover:bg-neutral-700 hover:text-neutral-100"
          disabled={!selectedAsset}
          onClick={() => {
            if (selectedAsset) onDelete(selectedAsset.id);
          }}
          title="Delete selected asset from project"
        >
          <Trash2 size={12} />
        </Button>
      </div>
      {selectedAsset ? <div className="text-[11px] text-neutral-400">{selectedAsset.mimeType}</div> : null}
      {options.length === 0 ? (
        <div className="text-[11px] text-neutral-400">Import images from toolbar first.</div>
      ) : null}
    </div>
  );
}

export function PropertySection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-neutral-900">
      <button onClick={onToggle} className={INSPECTOR_SECTION_BUTTON_CLASS}>
        <span className="text-sm font-semibold">{title}</span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {expanded && <div className="space-y-2 px-3 py-2">{children}</div>}
    </div>
  );
}

export function PropertyRow({
  label,
  value,
  unit,
  error,
  onChange,
  onBlur,
  onKeyDown,
}: {
  label: string;
  value: string;
  unit?: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-neutral-300">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            className={`w-20 rounded px-2 py-1 text-xs ${INSPECTOR_INPUT_CLASS}`}
          />
          {unit && <span className="text-xs text-neutral-400">{unit}</span>}
        </div>
      </div>
      {error ? <div className={INSPECTOR_ERROR_CLASS}>{error}</div> : null}
    </div>
  );
}

export function ColorProperty({
  label,
  value,
  tokenId,
  tokenOptions,
  error,
  onChange,
  onBlur,
  onTokenChange,
  onClearOverride,
  onKeyDown,
}: {
  label: string;
  value: string;
  tokenId: string | null;
  tokenOptions: ProjectSnapshot["styleTokens"];
  error?: string;
  onChange: (value: string) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onTokenChange: (tokenId: string | null) => void;
  onClearOverride: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const resolvedToken = tokenId
    ? (tokenOptions.find((t) => t.id === tokenId) ?? null)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-neutral-300">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className="h-6 w-8 cursor-pointer rounded border border-neutral-600 bg-neutral-800"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            className={`w-24 rounded px-2 py-1 text-xs ${INSPECTOR_INPUT_CLASS}`}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={tokenId ?? "__none__"}
          onValueChange={(v) => onTokenChange(v === "__none__" ? null : v)}
        >
          <SelectTrigger className={INSPECTOR_SELECT_TRIGGER_CLASS}>
            <SelectValue placeholder="Use local value">
              {resolvedToken ? (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full border border-neutral-500"
                    style={{ backgroundColor: resolvedToken.value }}
                  />
                  <span className="text-neutral-100">{resolvedToken.name}</span>
                </span>
              ) : (
                <span className="text-neutral-300">Use local value</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className={INSPECTOR_SELECT_CONTENT_CLASS}>
            <SelectItem className={INSPECTOR_SELECT_ITEM_CLASS} value="__none__">Use local value</SelectItem>
            {tokenOptions.map((token) => (
              <SelectItem className={INSPECTOR_SELECT_ITEM_CLASS} key={token.id} value={token.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full border border-neutral-500"
                    style={{ backgroundColor: token.value }}
                  />
                  <span>{token.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-neutral-600 bg-neutral-900 px-2 text-[11px] text-neutral-200 hover:bg-neutral-700 hover:text-neutral-100"
          onClick={onClearOverride}
        >
          Reset
        </Button>
      </div>
      {error ? <div className={INSPECTOR_ERROR_CLASS}>{error}</div> : null}
    </div>
  );
}

export function TextProperty({
  label,
  value,
  error,
  onChange,
  onBlur,
  onKeyDown,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-neutral-300">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={`w-full rounded px-2 py-1 text-xs ${INSPECTOR_INPUT_CLASS}`}
      />
      {error ? <div className={INSPECTOR_ERROR_CLASS}>{error}</div> : null}
    </div>
  );
}

export function BatchPropertyRow({
  label,
  value,
  unit,
  isMixed,
  onCommit,
}: {
  label: string;
  value: string | boolean;
  unit?: string;
  isMixed: boolean;
  onCommit: (v: string | boolean) => void;
}) {
  const [draft, setDraft] = useState(isMixed ? "" : String(value));

  useEffect(() => {
    setDraft(isMixed ? "" : String(value));
  }, [isMixed, value]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-neutral-300">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={draft}
            placeholder={isMixed ? "Mixed" : ""}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft.trim()) onCommit(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (draft.trim()) onCommit(draft);
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                setDraft(isMixed ? "" : String(value));
                e.currentTarget.blur();
              }
            }}
            className={`w-20 rounded px-2 py-1 text-xs ${INSPECTOR_INPUT_CLASS} ${isMixed ? "text-neutral-400 italic" : "text-neutral-100"}`}
          />
          {unit && <span className="text-xs text-neutral-400">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

export function BatchColorRow({
  label,
  value,
  isMixed,
  onCommit,
}: {
  label: string;
  value: string;
  isMixed: boolean;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(isMixed ? "" : value);

  useEffect(() => {
    setDraft(isMixed ? "" : value);
  }, [isMixed, value]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-neutral-300">{label}</label>
        <div className="flex items-center gap-2">
          {!isMixed && (
            <input
              type="color"
              value={draft || "#000000"}
              onChange={(e) => {
                setDraft(e.target.value);
                onCommit(e.target.value);
              }}
              className="h-6 w-8 cursor-pointer rounded border border-neutral-600 bg-neutral-800"
            />
          )}
          <input
            type="text"
            value={draft}
            placeholder={isMixed ? "Mixed" : ""}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft.trim()) onCommit(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (draft.trim()) onCommit(draft);
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                setDraft(isMixed ? "" : value);
                e.currentTarget.blur();
              }
            }}
            className={`w-24 rounded px-2 py-1 text-xs ${INSPECTOR_INPUT_CLASS} ${isMixed ? "text-neutral-400 italic" : "text-neutral-100"}`}
          />
        </div>
      </div>
    </div>
  );
}

export function CheckboxProperty({
  label,
  checked,
  error,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  error?: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const inputId = `inspector-boolean-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded border border-neutral-600 bg-neutral-800 accent-highlight-500"
        />
        <label htmlFor={inputId} className="cursor-pointer text-xs text-neutral-200">
          {label}
        </label>
      </div>
      {error ? <div className={INSPECTOR_ERROR_CLASS}>{error}</div> : null}
    </div>
  );
}
