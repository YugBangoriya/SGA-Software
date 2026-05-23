// src/components/layout/TopBar.jsx
// Desktop top header — Design Document §4.2

import { Bell, Search } from "lucide-react";
import useAuthStore     from "@/store/authStore";
import StatusBadge      from "@/components/ui/StatusBadge";
import { useTranslation } from "react-i18next";

export default function TopBar({ pageTitle }) {
  const { userDoc, role } = useAuthStore();
  const { t }             = useTranslation();

  return (
    <header
      className="hidden md:flex items-center justify-between px-6 py-3 border-b flex-shrink-0 sticky top-0 z-30"
      style={{
        background:  "var(--nav-bg)",
        borderColor: "var(--border-default)",
        boxShadow:   "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Page title */}
      <h2
        className="font-bold"
        style={{ fontSize: "18px", color: "var(--text-primary)" }}
      >
        {pageTitle || "Dashboard"}
      </h2>

      {/* Right side actions */}
      <div className="flex items-center gap-3">
        {/* Notifications bell */}
        <button
          className="relative p-2 rounded-btn transition-colors"
          style={{ color: "var(--text-secondary)", background: "var(--bg-card)", border: "1px solid var(--border-default)" }}
          aria-label="Notifications"
        >
          <Bell size={17} />
          {/* Unread dot — will be wired up in Phase 10 */}
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: "var(--status-unpaid-text)" }}
            aria-label="Unread notifications"
          />
        </button>

        {/* User chip */}
        {userDoc && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-btn"
            style={{ background: "var(--color-primary-light)", border: "1px solid var(--border-default)" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
              style={{ background: "var(--color-primary)" }}
              aria-hidden="true"
            >
              {userDoc.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                {userDoc.name || "User"}
              </p>
              <StatusBadge status={role} />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
