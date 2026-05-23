// src/pages/PlaceholderPage.jsx
// Generic placeholder for modules not yet built.
// Shows the module name and which phase builds it.

import { Construction } from "lucide-react";
import AppShell from "@/components/layout/AppShell";

const MODULE_INFO = {
  "/customers":  { title: "Customer Records",   phase: 2 },
  "/invoices":   { title: "Invoice Module",     phase: 4 },
  "/inventory":  { title: "Inventory",          phase: 3 },
  "/messaging":  { title: "Unified Messaging",  phase: 8 },
  "/quotations": { title: "Quotations",         phase: 5 },
  "/car-repo":   { title: "Car Repository",     phase: 6 },
  "/docs-repo":  { title: "Docs Repository",    phase: 7 },
  "/audit-log":  { title: "Audit Log",          phase: 10 },
  "/admin":      { title: "Admin Panel",        phase: 11 },
  "/settings":   { title: "Settings",           phase: 11 },
  "/more":       { title: "More",               phase: 1 },
};

export default function PlaceholderPage({ path }) {
  const info  = MODULE_INFO[path] || { title: "Module", phase: "?" };
  return (
    <AppShell pageTitle={info.title}>
      <div
        className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 rounded-card"
        style={{ background: "var(--bg-card)", border: "1px dashed var(--border-default)" }}
      >
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center mb-5"
          style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}
        >
          <Construction size={30} />
        </div>
        <h2
          className="font-bold mb-2"
          style={{ fontSize: "20px", color: "var(--text-primary)" }}
        >
          {info.title}
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "280px" }}>
          This module will be built in <strong>Phase {info.phase}</strong>.
        </p>
        <div
          className="mt-4 px-4 py-2 rounded-badge text-xs font-semibold"
          style={{
            background: "var(--color-primary-light)",
            color:      "var(--color-primary)",
          }}
        >
          Phase {info.phase} — Coming Soon
        </div>
      </div>
    </AppShell>
  );
}
