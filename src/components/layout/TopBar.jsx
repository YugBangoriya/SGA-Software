// SGA — Last updated: Bug Fix — Notification bell wired up with live dropdown panel showing pending invoices, low stock, upcoming reminders, and pending follow-ups
// src/components/layout/TopBar.jsx
// Desktop top header — Design Document §4.2
//
// NOTIFICATION BELL FIX:
//   The bell button previously had no onClick handler — the comment said
//   "will be wired up in Phase 10" but was never implemented. This fix adds:
//   1. A click handler that toggles a dropdown notification panel.
//   2. The panel pulls live counts from useDashboardStats (same data source
//      as the Dashboard summary cards) — no extra Firestore queries beyond
//      what the hook already manages.
//   3. Four notification types shown when count > 0:
//      - Pending invoices awaiting approval → navigates to /invoices
//      - Low stock items → navigates to /inventory
//      - Upcoming CNG reminders (next 30 days) → navigates to /reminders
//      - Pending follow-ups → navigates to /messaging/follow-ups
//   4. Badge on the bell icon shows the total alert count (not just a red dot).
//      When all counts are 0, the badge disappears and the panel shows
//      "All caught up!" empty state.
//   5. Click outside the panel closes it (mousedown listener on document).
//   6. Footer button in the panel deep-links to /reports for quick access
//      to the full Profit & Loss / Analytics hub.

import { useState, useEffect, useRef } from "react";
import { Bell, FileText, Package, Clock, MessageSquare, ChevronRight, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAuthStore       from "@/store/authStore";
import StatusBadge        from "@/components/ui/StatusBadge";
import { useTranslation } from "react-i18next";
import { useDashboardStats } from "@/hooks/useDashboardStats";

export default function TopBar({ pageTitle }) {
  const { userDoc, role }       = useAuthStore();
  const { t }                   = useTranslation();
  const navigate                = useNavigate();
  const { stats, loading }      = useDashboardStats();

  const [showNotifications, setShowNotifications] = useState(false);
  const panelRef = useRef(null);

  // ── Close dropdown on click outside ─────────────────────────────────────
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  // ── Build notification items from live stats ─────────────────────────────
  // Only items with count > 0 are shown. Each item has a navigation target.
  const notifications = [
    stats.pendingInvoices > 0 && {
      id:    "pending-invoices",
      icon:  FileText,
      color: "#CC6600",
      bg:    "#FFF8F0",
      label: `${stats.pendingInvoices} invoice${stats.pendingInvoices > 1 ? "s" : ""} pending approval`,
      sub:   "Awaiting your review",
      path:  "/invoices",
    },
    stats.lowStockItems > 0 && {
      id:    "low-stock",
      icon:  Package,
      color: "#CC0000",
      bg:    "#FFF0F0",
      label: `${stats.lowStockItems} item${stats.lowStockItems > 1 ? "s" : ""} low on stock`,
      sub:   "Check inventory levels",
      path:  "/inventory",
    },
    stats.upcomingReminders > 0 && {
      id:    "reminders",
      icon:  Clock,
      color: "#0055CC",
      bg:    "#EEF3FF",
      label: `${stats.upcomingReminders} CNG reminder${stats.upcomingReminders > 1 ? "s" : ""} due soon`,
      sub:   "Customers due for re-test in next 30 days",
      path:  "/reminders",
    },
    stats.pendingFollowUps > 0 && {
      id:    "follow-ups",
      icon:  MessageSquare,
      color: "#6A1B9A",
      bg:    "#F8F0FF",
      label: `${stats.pendingFollowUps} follow-up${stats.pendingFollowUps > 1 ? "s" : ""} pending`,
      sub:   "Scheduled customer follow-ups",
      path:  "/messaging/follow-ups",
    },
  ].filter(Boolean);

  const unreadCount = notifications.length;

  const handleNotifClick = (path) => {
    navigate(path);
    setShowNotifications(false);
  };

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

        {/* ── Notification Bell with dropdown ──────────────────────────────── */}
        <div ref={panelRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className="relative p-2 rounded-btn transition-colors"
            style={{
              color:      showNotifications ? "var(--color-primary)"       : "var(--text-secondary)",
              background: showNotifications ? "var(--color-primary-light)" : "var(--bg-card)",
              border:     `1px solid ${showNotifications ? "var(--color-primary)" : "var(--border-default)"}`,
            }}
            aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} item${unreadCount > 1 ? "s" : ""} need attention` : ""}`}
            aria-expanded={showNotifications}
            aria-haspopup="true"
          >
            <Bell size={17} />
            {/* Badge — only shown when there are actual alerts and data is loaded */}
            {!loading && unreadCount > 0 && (
              <span
                style={{
                  position:       "absolute",
                  top:            "3px",
                  right:          "3px",
                  minWidth:       "16px",
                  height:         "16px",
                  background:     "var(--status-unpaid-text)",
                  color:          "#FFFFFF",
                  borderRadius:   "50%",
                  fontSize:       "9px",
                  fontWeight:     700,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontFamily:     "system-ui",
                  lineHeight:     1,
                  padding:        "0 2px",
                  border:         "1.5px solid var(--nav-bg)",
                }}
                aria-hidden="true"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* ── Notifications dropdown panel ────────────────────────────── */}
          {showNotifications && (
            <div
              role="dialog"
              aria-label="Notifications"
              style={{
                position:     "absolute",
                top:          "calc(100% + 8px)",
                right:        0,
                width:        "320px",
                background:   "var(--bg-card)",
                border:       "1.5px solid var(--border-default)",
                borderRadius: "14px",
                boxShadow:    "0 16px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08)",
                zIndex:       50,
                overflow:     "hidden",
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  padding:      "14px 16px 12px",
                  borderBottom: "1px solid var(--border-default)",
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "space-between",
                  background:   "var(--nav-bg)",
                }}
              >
                <div>
                  <p style={{
                    fontSize:   "14px",
                    fontWeight: 700,
                    color:      "var(--text-primary)",
                    margin:     0,
                    fontFamily: "system-ui",
                  }}>
                    Notifications
                  </p>
                  <p style={{
                    fontSize:   "11px",
                    color:      "var(--text-secondary)",
                    margin:     "2px 0 0",
                    fontFamily: "system-ui",
                  }}>
                    {loading
                      ? "Loading…"
                      : unreadCount > 0
                        ? `${unreadCount} item${unreadCount > 1 ? "s" : ""} need attention`
                        : "All caught up"}
                  </p>
                </div>
                {!loading && unreadCount > 0 && (
                  <span style={{
                    background:   "#FFEBEE",
                    color:        "#CC0000",
                    border:       "1px solid #F0B8B8",
                    borderRadius: "20px",
                    padding:      "3px 10px",
                    fontSize:     "11px",
                    fontWeight:   700,
                    fontFamily:   "system-ui",
                  }}>
                    {unreadCount} alert{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Notification items list */}
              <div style={{ maxHeight: "340px", overflowY: "auto" }}>
                {loading ? (
                  /* Loading state */
                  <div style={{
                    padding:    "28px 16px",
                    textAlign:  "center",
                    color:      "var(--text-secondary)",
                    fontSize:   "13px",
                    fontFamily: "system-ui",
                  }}>
                    <div style={{
                      width:          "20px",
                      height:         "20px",
                      border:         "2px solid var(--border-default)",
                      borderTopColor: "var(--color-primary)",
                      borderRadius:   "50%",
                      animation:      "sga-spin 0.8s linear infinite",
                      margin:         "0 auto 8px",
                    }} />
                    Loading notifications…
                  </div>

                ) : unreadCount === 0 ? (
                  /* Empty state */
                  <div style={{
                    padding:   "32px 16px",
                    textAlign: "center",
                  }}>
                    <CheckCircle
                      size={36}
                      style={{ margin: "0 auto 10px", display: "block", color: "#1A7A1A" }}
                    />
                    <p style={{
                      fontSize:   "13px",
                      fontWeight: 700,
                      color:      "var(--text-primary)",
                      margin:     "0 0 4px",
                      fontFamily: "system-ui",
                    }}>
                      All caught up!
                    </p>
                    <p style={{
                      fontSize:   "12px",
                      color:      "var(--text-secondary)",
                      margin:     0,
                      fontFamily: "system-ui",
                    }}>
                      No pending items right now.
                    </p>
                  </div>

                ) : (
                  /* Notification rows */
                  notifications.map((notif, i) => {
                    const Icon = notif.icon;
                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif.path)}
                        style={{
                          width:        "100%",
                          display:      "flex",
                          alignItems:   "center",
                          gap:          "12px",
                          padding:      "12px 16px",
                          background:   "transparent",
                          border:       "none",
                          borderBottom: i < notifications.length - 1
                            ? "1px solid var(--border-default)"
                            : "none",
                          cursor:     "pointer",
                          textAlign:  "left",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--color-primary-light)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {/* Icon chip */}
                        <div style={{
                          width:           "36px",
                          height:          "36px",
                          borderRadius:    "10px",
                          background:      notif.bg,
                          border:          `1.5px solid ${notif.color}30`,
                          display:         "flex",
                          alignItems:      "center",
                          justifyContent:  "center",
                          flexShrink:      0,
                        }}>
                          <Icon size={16} color={notif.color} />
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize:   "13px",
                            fontWeight: 600,
                            color:      "var(--text-primary)",
                            margin:     0,
                            lineHeight: 1.35,
                            fontFamily: "system-ui",
                          }}>
                            {notif.label}
                          </p>
                          <p style={{
                            fontSize:   "11px",
                            color:      "var(--text-secondary)",
                            margin:     "2px 0 0",
                            fontFamily: "system-ui",
                          }}>
                            {notif.sub}
                          </p>
                        </div>

                        <ChevronRight size={14} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer — quick link to full Reports hub */}
              <div style={{
                padding:      "10px 12px",
                borderTop:    "1px solid var(--border-default)",
                background:   "var(--nav-bg)",
              }}>
                <button
                  onClick={() => handleNotifClick("/reports")}
                  style={{
                    width:          "100%",
                    background:     "var(--color-primary)",
                    color:          "#FFFFFF",
                    border:         "none",
                    borderRadius:   "8px",
                    padding:        "8px 12px",
                    fontSize:       "12px",
                    fontWeight:     600,
                    cursor:         "pointer",
                    fontFamily:     "system-ui",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    gap:            "6px",
                    transition:     "background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-secondary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-primary)"; }}
                >
                  View Reports &amp; Analytics
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
        {/* ── End notification bell ─────────────────────────────────────────── */}

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

      {/* Spinner keyframe for loading state in notification panel */}
      <style>{`@keyframes sga-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </header>
  );
}