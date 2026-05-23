// src/pages/Dashboard.jsx
// Phase 1 shell — summary cards layout, quick actions.
// Real data wired up in Phase 10 (Reporting).

import { useTranslation } from "react-i18next";
import useAuthStore from "@/store/authStore";
import AppShell    from "@/components/layout/AppShell";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { FileText, Users, Plus, ClipboardList } from "lucide-react";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function SummaryCard({ label, value, color, icon: Icon }) {
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
          {value ?? "—"}
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
  const { t } = useTranslation();

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

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <SummaryCard label="Pending Invoices"     value="—" color="#CC6600"  icon={FileText}   />
        <SummaryCard label="Low Stock Items"       value="—" color="#CC0000"  icon={Users}      />
        <SummaryCard label="Upcoming Reminders"    value="—" color="#0055CC"  icon={FileText}   />
        <SummaryCard label="Pending Follow-ups"    value="—" color="#661F1F"  icon={ClipboardList} />
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
            <QuickAction label="New Invoice" icon={<Plus size={16} />} path="/invoices/new" />
          )}
          {canCreateCustomer && (
            <QuickAction label="New Customer" icon={<Users size={16} />} path="/customers/new" />
          )}
          {canCreateQuotation && (
            <QuickAction label="New Quotation" icon={<ClipboardList size={16} />} path="/quotations/new" />
          )}
        </div>
      </div>

      {/* Coming soon notice */}
      <div
        className="rounded-card p-5 text-center"
        style={{
          background:  "var(--color-primary-light)",
          border:      "1px dashed var(--color-secondary)",
        }}
      >
        <p className="font-semibold" style={{ color: "var(--color-primary)", fontSize: "14px" }}>
          🚧 Dashboard data will populate as modules are built
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>
          Phase 1 complete — authentication, RBAC, navigation, and theme system are live.
        </p>
      </div>
    </AppShell>
  );
}

function QuickAction({ label, icon, path }) {
  return (
    <a
      href={path}
      className="sg-btn sg-btn-secondary flex items-center gap-2"
      style={{ fontSize: "13px", padding: "8px 16px", minHeight: "40px" }}
    >
      {icon}
      {label}
    </a>
  );
}
