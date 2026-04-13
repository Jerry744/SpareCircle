export interface DesignTokenPreset {
  name: string;
  value: string;
}

export const MATERIAL_COLOR_PRESET: DesignTokenPreset[] = [
  { name: "Primary", value: "#3B82F6" },
  { name: "Secondary", value: "#EC4899" },
  { name: "Success", value: "#10B981" },
  { name: "Warning", value: "#F59E0B" },
  { name: "Error", value: "#EF4444" },
  { name: "Surface", value: "#F3F4F6" },
  { name: "OnSurface", value: "#1F2937" },
  { name: "Info", value: "#06B6D4" },
];