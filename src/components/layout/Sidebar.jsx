// ─────────────────────────────────────────────────────────────────────────────
// src/components/layout/Sidebar.jsx
// Desktop left sidebar — Design Document §4.2
// Shows: icons + labels when expanded | icons only when collapsed
// Visible only on md+ (hidden on mobile)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut,
} from "lucide-react";
import useAuthStore  from "@/store/authStore";
import useThemeStore from "@/store/themeStore";
import { getNavTabsForRole, getMoreMenuItemsForRole } from "@/lib/rbac";
import { useTranslation } from "react-i18next";

const ICON_MAP = {
  home:           LayoutDashboard,
  customers:      Users,
  invoices:       FileText,
  inventory:      Package,
  messaging:      MessageSquare,
  quotations:     ClipboardList,
  "car-repo":     Car,
  "docs-repo":    FolderOpen,
  "audit-log":    ShieldCheck,
  admin:          Settings2,
  settings:       Settings,
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { role, userDoc, logout } = useAuthStore();
  const { theme, toggleTheme }    = useThemeStore();
  const { t }                     = useTranslation();
  const location                  = useLocation();

  // Build the full navigation list: main tabs + more items (deduplicated)
  const mainTabs   = getNavTabsForRole(role).filter((t) => t.id !== "more");
  const moreItems  = getMoreMenuItemsForRole(role);
  const allNavItems = [
    ...mainTabs,
    { divider: true },
    ...moreItems,
  ];

  const w = collapsed ? "64px" : "220px";

  return (
    <aside
      className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-40 overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        width:       w,
        background:  "var(--nav-bg)",
        borderRight: "1px solid var(--border-default)",
        boxShadow:   "2px 0 12px rgba(0,0,0,0.06)",
      }}
      aria-label="Sidebar navigation"
    >
      {/* ── Logo / Brand ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-5 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-white text-xs select-none"
          style={{ background: "var(--color-primary)" }}
        >
          SG
        </div>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <p
              className="font-bold truncate leading-tight"
              style={{ fontSize: "13px", color: "var(--text-primary)" }}
            >
              Shree Ganesh
            </p>
            <p
              className="truncate"
              style={{ fontSize: "10px", color: "var(--text-secondary)" }}
            >
              Business Management
            </p>
          </div>
        )}
      </div>

      {/* ── Nav items ────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3" aria-label="Main">
        {allNavItems.map((item, idx) => {
          if (item.divider) {
            return (
              <div
                key={`divider-${idx}`}
                className="mx-3 my-2"
                style={{ height: "1px", background: "var(--border-default)" }}
                aria-hidden="true"
              />
            );
          }
          const Icon     = ICON_MAP[item.id] || Settings;
          const isActive = item.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className="flex items-center gap-3 mx-2 mb-0.5 rounded-btn transition-all duration-150 select-none"
              style={{
                padding:    collapsed ? "10px 0" : "9px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: isActive ? "var(--color-primary-light)" : "transparent",
                color:      isActive ? "var(--color-primary)"       : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 400,
              }}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2.5 : 1.75}
                className="flex-shrink-0"
              />
              {!collapsed && (
                <span style={{ fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.label}
                </span>
              )}
              {isActive && collapsed && (
                <span
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full"
                  style={{ background: "var(--color-primary)" }}
                  aria-hidden="true"
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Bottom: user chip + theme toggle + collapse ──────────── */}
      <div
        className="flex-shrink-0 border-t pb-4 pt-3 px-2 flex flex-col gap-1"
        style={{ borderColor: "var(--border-default)" }}
      >
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full rounded-btn transition-colors px-3 py-2"
          style={{
            justifyContent: collapsed ? "center" : "flex-start",
            color:          "var(--text-secondary)",
          }}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
          {!collapsed && (
            <span style={{ fontSize: "12px" }}>
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          )}
        </button>

        {/* User chip */}
        {!collapsed && userDoc && (
          <div
            className="flex items-center gap-2 rounded-btn px-3 py-2 mt-1"
            style={{ background: "var(--color-primary-light)" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0 font-bold text-xs"
              style={{ background: "var(--color-primary)" }}
              aria-hidden="true"
            >
              {userDoc.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {userDoc.name || "User"}
              </p>
              <p className="text-xs truncate capitalize" style={{ color: "var(--color-primary)" }}>
                {userDoc.role}
              </p>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full rounded-btn px-3 py-2 transition-colors"
          style={{
            justifyContent: collapsed ? "center" : "flex-start",
            color:          "var(--status-unpaid-text)",
          }}
          title="Sign Out"
          aria-label="Sign Out"
        >
          <LogOut size={16} />
          {!collapsed && <span style={{ fontSize: "12px", fontWeight: 500 }}>Sign Out</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-3 w-full rounded-btn px-3 py-2 mt-1 transition-colors"
          style={{
            justifyContent: collapsed ? "center" : "flex-start",
            color:          "var(--text-placeholder)",
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span style={{ fontSize: "11px" }}>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
