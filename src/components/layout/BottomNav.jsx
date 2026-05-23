// ─────────────────────────────────────────────────────────────────────────────
// src/components/layout/BottomNav.jsx
// Mobile bottom navigation bar — Design Document §4.1
// 5 tabs: Home | Customers | Invoices | Inventory | More
// Visible only on mobile (hidden on md+)
// ─────────────────────────────────────────────────────────────────────────────

import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  MoreHorizontal,
} from "lucide-react";
import useAuthStore from "@/store/authStore";
import { getNavTabsForRole } from "@/lib/rbac";
import { useTranslation } from "react-i18next";

// Icon map by id
const ICON_MAP = {
  home:      LayoutDashboard,
  customers: Users,
  invoices:  FileText,
  inventory: Package,
  more:      MoreHorizontal,
};

export default function BottomNav() {
  const { role }     = useAuthStore();
  const { t }        = useTranslation();
  const location     = useLocation();
  const tabs         = getNavTabsForRole(role);

  const NAV_LABELS = {
    home:      t("nav.home"),
    customers: t("nav.customers"),
    invoices:  t("nav.invoices"),
    inventory: t("nav.inventory"),
    more:      t("nav.more"),
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      style={{
        background:  "var(--nav-bg)",
        borderTop:   "1px solid var(--border-default)",
        boxShadow:   "var(--shadow-nav)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around h-16">
        {tabs.map((tab) => {
          const Icon     = ICON_MAP[tab.id] || MoreHorizontal;
          const isActive = tab.id === "more"
            ? location.pathname.startsWith("/more") || isMoreActive(location.pathname)
            : location.pathname === tab.path || (tab.id === "home" && location.pathname === "/");

          return (
            <NavLink
              key={tab.id}
              to={tab.path}
              className="flex flex-col items-center justify-center flex-1 gap-0.5 min-w-0 py-1 px-1
                         transition-all duration-200 select-none"
              style={({ isActive: navIsActive }) => ({
                color:       isActive ? "var(--nav-active)" : "var(--nav-inactive)",
                background:  "transparent",
              })}
              aria-label={NAV_LABELS[tab.id]}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Active indicator dot above icon */}
              <span
                className="w-1 h-1 rounded-full mb-0.5 transition-all duration-200"
                style={{
                  background:  isActive ? "var(--nav-active)" : "transparent",
                  opacity:     isActive ? 1 : 0,
                  transform:   isActive ? "scale(1)" : "scale(0)",
                }}
                aria-hidden="true"
              />
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.75}
                className="transition-transform duration-200"
                style={{ transform: isActive ? "scale(1.08)" : "scale(1)" }}
              />
              <span
                className="text-center leading-tight truncate w-full text-center"
                style={{
                  fontSize:   "9px",
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: "0.2px",
                }}
              >
                {NAV_LABELS[tab.id]}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

// Paths that live under "More" menu
function isMoreActive(pathname) {
  return ["/messaging", "/quotations", "/car-repo", "/docs-repo", "/audit-log", "/admin", "/settings"].some(
    (p) => pathname.startsWith(p)
  );
}
