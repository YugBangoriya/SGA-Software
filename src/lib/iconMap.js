// src/lib/iconMap.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for icon-id → Lucide component mapping.
//
// Previously: More.jsx and Sidebar.jsx each kept their own ICON_MAP object.
// This caused a maintenance risk — adding a new nav item to rbac.js required
// manually updating BOTH maps. If one was missed the wrong icon (or the Settings
// fallback) would appear on one surface but not the other.
//
// Phase 11 fix: Both More.jsx and Sidebar.jsx now import ICON_MAP from here.
// When a new item is added to getMoreMenuItemsForRole() in rbac.js, add its
// icon entry here ONCE and it will be reflected everywhere automatically.
//
// Convention: the key matches the `icon` value returned by rbac.js
// (for More items: item.icon; for Sidebar items: ICON_MAP[item.id]).
// ─────────────────────────────────────────────────────────────────────────────

import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  MessageSquare,
  ClipboardList,
  Car,
  FolderOpen,
  ShieldCheck,
  Settings2,
  Settings,
  Bell,
} from "lucide-react";

/**
 * Maps nav item `id` (and `icon` string from rbac.js) → Lucide component.
 * Used by Sidebar.jsx (keyed by item.id) and More.jsx (keyed by item.icon).
 * All string keys that appear in either place are included here.
 */
const ICON_MAP = {
  // Bottom nav tabs (id-keyed, used by Sidebar)
  home:           LayoutDashboard,
  customers:      Users,
  invoices:       FileText,
  inventory:      Package,

  // More menu items (icon-keyed, used by More.jsx; id-keyed, used by Sidebar)
  messaging:      MessageSquare,
  quotations:     ClipboardList,
  reminders:      Bell,         // CNG re-test reminders (Phase 9 addition)
  "car-repo":     Car,
  "docs-repo":    FolderOpen,
  "audit-log":    ShieldCheck,
  admin:          Settings2,
  settings:       Settings,

  // Aliases used by More.jsx's icon string lookup (item.icon is the string value)
  MessageSquare:  MessageSquare,
  ClipboardList:  ClipboardList,
  Car:            Car,
  FolderOpen:     FolderOpen,
  ShieldCheck:    ShieldCheck,
  Settings2:      Settings2,
  Settings:       Settings,
  Bell:           Bell,
};

export default ICON_MAP;