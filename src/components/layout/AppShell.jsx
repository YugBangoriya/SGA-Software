// SGA — Last updated: Added AppUpdateBanner to detect and display new PWA version notifications
// ─────────────────────────────────────────────────────────────────────────────
// src/components/layout/AppShell.jsx
// Authenticated layout wrapper.
// Mobile:  Content fills screen above fixed bottom nav (pb-20)
// Desktop: Content sits to the right of fixed sidebar with top bar
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import Sidebar  from "./Sidebar";
import BottomNav from "./BottomNav";
import TopBar   from "./TopBar";
import AppUpdateBanner from "./AppUpdateBanner";

export default function AppShell({ children, pageTitle }) {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-app)" }}
    >
      {/* Update available banner — shown above everything when a new SW activates */}
      <AppUpdateBanner />

      {/* Desktop sidebar — fixed left */}
      <Sidebar />

      {/* Main content area */}
      <div
        className="
          flex flex-col min-h-screen
          md:ml-[220px]
          transition-all duration-300
        "
      >
        {/* Desktop top bar */}
        <TopBar pageTitle={pageTitle} />

        {/* Page content */}
        <main
          className="flex-1 p-4 md:p-6 pb-24 md:pb-6"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — fixed bottom */}
      <BottomNav />
    </div>
  );
}