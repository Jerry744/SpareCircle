/**
 * SpareCircle platform design token system.
 * These tokens theme the editor UI only and are not persisted in ProjectSnapshot.styleTokens.
 *
 * Dark-first, Material Design 3 inspired.
 *
 * Neutral scale: pure grays, 900=deepest canvas, 100=near-white text.
 * Highlight: brand steel-blue (#5b9dd9 family) for accents and selection.
 * Primary: vibrant indigo for CTA elements.
 * Secondary: slate for secondary interactive elements.
 * Status: semantic success/warning/error/info colors.
 */
export const DESIGN_TOKENS = {
  highlight: {
    100: "#ddeaf6",
    200: "#b9d4ee",
    300: "#8ab8e3",
    400: "#78b0e0",
    500: "#5b9dd9",
    600: "#4585c0",
    700: "#3370a7",
    800: "#25598d",
    900: "#1c3a54",
  },

  primary: {
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
  },

  secondary: {
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },

  neutral: {
    50:  "#f5f5f5",
    100: "#e8e8e8",
    200: "#d4d4d4",
    300: "#a3a3a3",
    400: "#737373",
    500: "#525252",
    600: "#3c3c3c",
    700: "#2c2c2c",
    800: "#252525",
    900: "#1e1e1e",
    950: "#111111",
  },

  status: {
    success: { 100: "#d1fae5", 400: "#4ade80", 500: "#22c55e", 900: "#14532d" },
    warning: { 100: "#fef9c3", 400: "#facc15", 500: "#eab308", 900: "#713f12" },
    error:   { 100: "#fee2e2", 400: "#f87171", 500: "#ef4444", 900: "#7f1d1d" },
    info:    { 100: "#dbeafe", 400: "#60a5fa", 500: "#3b82f6", 900: "#1e3a8a" },
  },
} as const;

export type HighlightShade = keyof typeof DESIGN_TOKENS.highlight;
export type NeutralShade = keyof typeof DESIGN_TOKENS.neutral;

/**
 * Semantic theme mappings for dark mode (current default).
 * Light mode reserved for future implementation.
 */
export const THEME_CONFIG = {
  dark: {
    canvasBg:    DESIGN_TOKENS.neutral[900],
    panelBg:     DESIGN_TOKENS.neutral[700],
    elevatedBg:  DESIGN_TOKENS.neutral[800],
    hoverBg:     DESIGN_TOKENS.neutral[600],
    divider:     DESIGN_TOKENS.neutral[900],
    selectedBg:  DESIGN_TOKENS.highlight[900],
    accent:      DESIGN_TOKENS.highlight[500],
    accentHover: DESIGN_TOKENS.highlight[400],
    textPrimary:   DESIGN_TOKENS.neutral[100],
    textSecondary: DESIGN_TOKENS.neutral[300],
    textMuted:     DESIGN_TOKENS.neutral[400],
  },
} as const;
