const COLORS = [
  { name: "Primary", value: "#5b9dd9" },
  { name: "Secondary", value: "#7eb3e5" },
  { name: "Background", value: "#1e1e1e" },
  { name: "Surface", value: "#2c2c2c" },
  { name: "Text Primary", value: "#e8e8e8" },
  { name: "Text Secondary", value: "#9ca3af" },
];

export function ThemesPanel() {
  return (
    <div>
      <div className="text-sm font-semibold mb-3 text-neutral-100">Global Theme Colors</div>
      <div className="grid grid-cols-3 gap-3">
        {COLORS.map((color) => (
          <div key={color.name} className="p-3 bg-neutral-800 rounded border border-neutral-600">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded border border-neutral-600"
                style={{ backgroundColor: color.value }}
              />
              <div className="flex-1">
                <div className="text-xs text-neutral-100">{color.name}</div>
                <div className="text-[10px] text-neutral-400">{color.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
