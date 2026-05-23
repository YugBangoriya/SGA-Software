// src/pages/Dashboard.jsx
// Phase 10 update: wired up useDashboardStats to show real summary numbers.
//
// FIX (Phase 2 Bug): QuickAction was using <a href={path}> which triggers
// a full-page reload in a BrowserRouter SPA. Replaced with React Router
// <Link> for proper client-side navigation. This fixes the "New Customer"
// dashboard button not working as a SPA navigation.
//
// FIX (Phase 10 — Phase 9 Flag #1):
//   useDashboardStats hook existed but was never called here. All four
//   summary cards ("Pending Invoices", "Low Stock Items", "Upcoming Reminders",
//   "Pending Follow-ups") were hardcoded to show "—". Now they show live counts.

import { useTranslation }                from "react-i18next";
import { Link }                          from "react-router-dom";
import useAuthStore                      from "@/store/authStore";
import AppShell                          from "@/components/layout/AppShell";
import { hasPermission, PERMISSIONS }    from "@/lib/rbac";
import { useDashboardStats }             from "@/hooks/useDashboardStats";
import {
  FileText, Users, Plus, ClipboardList,
  Bell, TrendingUp, Package, MessageSquare,
  RefreshCw,
} from "lucide-react";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function SummaryCard({ label, value, color, icon: Icon, loading }) {
  return (
    <div className="sg-card flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + "22", color }}
      >
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
          {loading ? (
            <span style={{ opacity: 0.4, fontSize: 16 }}>…</span>
          ) : (
            value ?? "—"
          )}
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)", marginTop: "2px" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { userDoc, role } = useAuthStore();
  const { t }             = useTranslation();

  // ── Live stats from Firestore ─────────────────────────────────────────
  const { stats, loading } = useDashboardStats();

  const canCreateInvoice   = hasPermission(role, PERMISSIONS.INVOICE_CREATE);
  const canCreateCustomer  = hasPermission(role, PERMISSIONS.CUSTOMERS_CREATE_EDIT);
  const canCreateQuotation = hasPermission(role, PERMISSIONS.QUOTATION_GENERATE);

  return (
    <AppShell pageTitle="Dashboard">
      {/* Greeting */}
      <div className="mb-6">
        <h1
          className="font-bold"
          style={{ fontSize: "22px", color: "var(--text-primary)" }}
        >
          {greeting()}, {userDoc?.name?.split(" ")[0] || "there"} 👋
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
        </p>
      </div>

      {/* Summary cards — now showing live data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <SummaryCard
          label="Pending Invoices"
          value={stats.pendingInvoices}
          color="#CC6600"
          icon={FileText}
          loading={loading}
        />
        <SummaryCard
          label="Low Stock Items"
          value={stats.lowStockItems}
          color="#CC0000"
          icon={Package}
          loading={loading}
        />
        <SummaryCard
          label="Upcoming Reminders"
          value={stats.upcomingReminders}
          color="#0055CC"
          icon={Bell}
          loading={loading}
        />
        <SummaryCard
          label="Pending Follow-ups"
          value={stats.pendingFollowUps}
          color="#661F1F"
          icon={MessageSquare}
          loading={loading}
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h2
          className="font-semibold mb-3"
          style={{ fontSize: "16px", color: "var(--text-primary)" }}
        >
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {canCreateInvoice && (
            <QuickAction label="New Invoice"   icon={<Plus size={16} />}          path="/invoices/new"   />
          )}
          {canCreateCustomer && (
            <QuickAction label="New Customer"  icon={<Users size={16} />}          path="/customers/new"  />
          )}
          {canCreateQuotation && (
            <QuickAction label="New Quotation" icon={<ClipboardList size={16} />}  path="/quotations/new" />
          )}
        </div>
      </div>

      {/* Outstanding balance strip — visible only when non-zero */}
      {!loading && stats.outstandingAmount > 0 && (
        <div
          className="rounded-card p-4 mb-4 flex items-center gap-3"
          style={{
            background: "#FFF8F0",
            border: "1.5px solid #FFD088",
          }}
        >
          <TrendingUp size={18} color="#CC6600" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#CC6600", margin: 0 }}>
              Outstanding Balance
            </p>
            <p style={{ fontSize: 12, color: "#AA5500", margin: "2px 0 0" }}>
              ₹{stats.outstandingAmount.toLocaleString("en-IN")} due across unpaid &amp; partial invoices
            </p>
          </div>
          <Link
            to="/invoices/pending-payments"
            style={{ marginLeft: "auto", fontSize: 12, color: "#0055CC", fontWeight: 600, textDecoration: "none" }}
          >
            View →
          </Link>
        </div>
      )}
    </AppShell>
  );
}

// ── QuickAction: uses React Router Link instead of <a href> ─────────────────
// Previously <a href> caused a full page reload in the SPA, losing auth state
// momentarily. Link does in-memory client-side navigation — no reload.
function QuickAction({ label, icon, path }) {
  return (
    <Link
      to={path}
      className="sg-btn sg-btn-secondary flex items-center gap-2"
      style={{ fontSize: "13px", padding: "8px 16px", minHeight: "40px", textDecoration: "none" }}
    >
      {icon}
      {label}
    </Link>
  );
}