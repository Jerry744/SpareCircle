import {
  FileCode,
  Image as ImageIcon,
  Package,
  Palette,
  Settings as SettingsIcon,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface BottomPanelTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const BOTTOM_PANEL_TABS: BottomPanelTab[] = [
  { id: "assets", label: "Assets", icon: ImageIcon },
  { id: "components", label: "Components", icon: Package },
  { id: "themes", label: "Themes & Colors", icon: Palette },
  { id: "events", label: "Events", icon: Zap },
  { id: "export", label: "Export", icon: FileCode },
  { id: "settings", label: "Project Settings", icon: SettingsIcon },
];
