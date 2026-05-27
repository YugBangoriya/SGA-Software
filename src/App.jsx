// SGA — Last updated: Fixed /inventory/:id route param — changed :id to :itemId so ItemDetailPage useParams() works
// src/App.jsx — FIXED: All modules wired to real components

import { useEffect }           from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import useAuthStore   from "@/store/authStore";
import useThemeStore  from "@/store/themeStore";
import { ROLES }      from "@/lib/rbac";

import ProtectedRoute from "@/components/layout/ProtectedRoute";
import ErrorBoundary  from "@/components/layout/ErrorBoundary";
import { ToastContainer } from "@/components/ui/Toast";

// ── Public Pages
import Login          from "@/pages/Login";
import Dashboard      from "@/pages/Dashboard";
import More           from "@/pages/More";
import Unauthorized   from "@/pages/Unauthorized";

// ── Phase 2: Customers
import CustomerRoutes from "@/pages/customers/CustomerRoutes";

// ── Phase 3: Inventory
import InventoryPage  from "@/pages/inventory/index";
import ItemDetailPage from "@/pages/inventory/ItemDetailPage";

// ── Phase 4: Invoices
import InvoiceList     from "@/pages/invoices/InvoiceList";
import CreateInvoice   from "@/pages/invoices/CreateInvoice";
import InvoiceDetail   from "@/pages/invoices/InvoiceDetail";
import PendingPayments from "@/pages/invoices/PendingPayments";

// ── Phase 5: Quotations
import QuotationsPage from "@/pages/quotations/QuotationsPage";

// ── Phase 6: Car Repository
import CarRepositoryPage from "@/pages/carRepository/index";

// ── Phase 7: Docs Repository
import { DocsRepositoryPage } from "@/pages/docsRepository/index";

// ── Phase 8: Messaging
import UnifiedInbox     from "@/pages/messaging/index";
import FollowUpLog      from "@/pages/messaging/FollowUpLog";
import TemplateManager  from "@/pages/messaging/TemplateManager";

// ── Phase 9: Reminders
import ReminderLog from "@/pages/reminders/ReminderLog";

// ── Phase 10: Reporting & Audit
import ReportingHub                from "@/pages/reporting/ReportingHub";
import AuditLogViewer              from "@/pages/reporting/AuditLogViewer";
import ProfitLossReport            from "@/pages/reporting/ProfitLossReport";
import PendingInvoicesSummary      from "@/pages/reporting/PendingInvoicesSummary";
import CustomerAcquisitionPipeline from "@/pages/reporting/CustomerAcquisitionPipeline";
import FollowUpTracker             from "@/pages/reporting/FollowUpTracker";

// ── Phase 11: Settings
import { SettingsPage } from "@/pages/settings/index";

export default function App() {
  const { initAuth, userDoc } = useAuthStore();
  const { syncFromUserDoc }   = useThemeStore();

  useEffect(() => {
    const unsubscribe = initAuth();
    return () => unsubscribe && unsubscribe();
  }, []);

  useEffect(() => {
    if (userDoc) syncFromUserDoc(userDoc);
  }, [userDoc]);

  return (
    <BrowserRouter>
      {/*
       * ErrorBoundary wraps all routes so that if ANY page component throws
       * a JS error during render, the entire app does NOT go blank.
       * Instead the ErrorBoundary catches it, shows a recovery screen,
       * and lets the user navigate away without a full page refresh.
       *
       * This fixes the intermittent blank screen issue on:
       * Messaging, Quotations, Reminders, Car Repo, Docs Repo, Admin, Settings
       */}
      <ErrorBoundary>
        <Routes>

          {/* ── Public ──────────────────────────────────────────────────── */}
          <Route path="/login"        element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ── Dashboard ───────────────────────────────────────────────── */}
          <Route path="/" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE, ROLES.ACCOUNTANT]}>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/more" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE, ROLES.ACCOUNTANT]}>
              <More />
            </ProtectedRoute>
          } />

          {/* ── Phase 2: Customers ──────────────────────────────────────── */}
          <Route path="/customers/*" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE]}>
              <CustomerRoutes />
            </ProtectedRoute>
          } />

          {/* ── Phase 3: Inventory ──────────────────────────────────────── */}
          <Route path="/inventory" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE]}>
              <InventoryPage />
            </ProtectedRoute>
          } />
          {/*
           * FIX: Changed :id → :itemId so ItemDetailPage's useParams() correctly
           * receives { itemId } instead of { id }. The old :id param meant
           * `const { itemId } = useParams()` always returned undefined, which caused
           * Firebase doc() to call undefined.indexOf('/') internally → the
           * "Cannot read properties of undefined (reading 'indexOf')" error.
           */}
          <Route path="/inventory/:itemId" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE]}>
              <ItemDetailPage />
            </ProtectedRoute>
          } />

          {/* ── Phase 4: Invoices ───────────────────────────────────────── */}
          <Route path="/invoices" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE]}>
              <InvoiceList />
            </ProtectedRoute>
          } />
          <Route path="/invoices/new" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE]}>
              <CreateInvoice />
            </ProtectedRoute>
          } />
          <Route path="/invoices/pending-payments" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <PendingPayments />
            </ProtectedRoute>
          } />
          <Route path="/invoices/:id" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE]}>
              <InvoiceDetail />
            </ProtectedRoute>
          } />

          {/* ── Phase 5: Quotations ─────────────────────────────────────── */}
          <Route path="/quotations/*" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <QuotationsPage />
            </ProtectedRoute>
          } />

          {/* ── Phase 6: Car Repository ─────────────────────────────────── */}
          <Route path="/car-repo" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE]}>
              <CarRepositoryPage />
            </ProtectedRoute>
          } />

          {/* ── Phase 7: Docs Repository ────────────────────────────────── */}
          <Route path="/docs-repo" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <DocsRepositoryPage />
            </ProtectedRoute>
          } />

          {/* ── Phase 8: Messaging ──────────────────────────────────────── */}
          <Route path="/messaging" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <UnifiedInbox />
            </ProtectedRoute>
          } />
          <Route path="/messaging/follow-ups" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <FollowUpLog />
            </ProtectedRoute>
          } />
          <Route path="/messaging/templates" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <TemplateManager />
            </ProtectedRoute>
          } />

          {/* ── Phase 9: Reminders ──────────────────────────────────────── */}
          <Route path="/reminders" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <ReminderLog />
            </ProtectedRoute>
          } />

          {/* ── Phase 10: Reporting & Audit ─────────────────────────────── */}
          <Route path="/reports" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <ReportingHub />
            </ProtectedRoute>
          } />
          <Route path="/audit-log" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <AuditLogViewer />
            </ProtectedRoute>
          } />
          <Route path="/reports/profit-loss" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <ProfitLossReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/pending-invoices" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <PendingInvoicesSummary />
            </ProtectedRoute>
          } />
          <Route path="/reports/customers" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <CustomerAcquisitionPipeline />
            </ProtectedRoute>
          } />
          <Route path="/reports/follow-ups" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <FollowUpTracker />
            </ProtectedRoute>
          } />

          {/* ── Phase 11: Settings & Admin ──────────────────────────────── */}
          <Route path="/settings/*" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE, ROLES.ACCOUNTANT]}>
              <SettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/*" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE, ROLES.ACCOUNTANT]}>
              <SettingsPage />
            </ProtectedRoute>
          } />

          {/* ── Catch-all ───────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </ErrorBoundary>

      <ToastContainer />
    </BrowserRouter>
  );
}