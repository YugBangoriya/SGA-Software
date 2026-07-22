// SGA — Last updated: Added /invoices/:id/edit-items route for Owner/SuperAdmin to edit items on PENDING invoices before approval (EditPendingInvoice); smart Edit button in InvoiceDetail routes to this page when invoice is PENDING
// src/App.jsx — All modules wired to real components
//
// REQUEST 3 CHANGE:
//   /inventory       → allowedRoles now [SUPERADMIN, OWNER] only (was + EMPLOYEE)
//   /inventory/:itemId → allowedRoles now [SUPERADMIN, OWNER] only (was + EMPLOYEE)
//
//   Employees who attempt to navigate directly to /inventory (e.g. via the
//   browser address bar) are redirected to /unauthorized by ProtectedRoute.
//   Employees can still access inventory items during invoice creation because
//   InvoiceStepItems.jsx performs a direct Firestore query — it does not use
//   the /inventory route at all. The Firestore security rules still allow
//   employee reads on /inventory documents, which is required for that flow.

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
import InvoiceList          from "@/pages/invoices/InvoiceList";
import CreateInvoice        from "@/pages/invoices/CreateInvoice";
import InvoiceDetail        from "@/pages/invoices/InvoiceDetail";
import EditInvoice          from "@/pages/invoices/EditInvoice";
import EditPendingInvoice   from "@/pages/invoices/EditPendingInvoice";
import PendingPayments      from "@/pages/invoices/PendingPayments";
import CreateReturnInvoice  from "@/pages/invoices/CreateReturnInvoice";

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
import SalesReport                 from "@/pages/reporting/SalesReport";

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
          {/*
           * REQUEST 3: ROLES.EMPLOYEE removed from both inventory routes.
           *
           * Employees who visit /inventory directly (e.g. via browser address bar
           * or a stale bookmark) will be redirected to /unauthorized by
           * ProtectedRoute, exactly like Messaging or Quotations.
           *
           * Employees can still SELECT inventory items during invoice creation
           * (Step 2 — InvoiceStepItems.jsx) because that component queries
           * Firestore directly and does not use this route at all.
           * The Firestore security rules are NOT changed — employee reads on
           * /inventory documents remain permitted so the invoice flow works.
           */}
          <Route path="/inventory" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <InventoryPage />
            </ProtectedRoute>
          } />
          {/*
           * FIX (preserved): Changed :id → :itemId so ItemDetailPage's useParams()
           * correctly receives { itemId } instead of { id }.
           *
           * REQUEST 3: ROLES.EMPLOYEE also removed from the item detail route.
           */}
          <Route path="/inventory/:itemId" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <ItemDetailPage />
            </ProtectedRoute>
          } />

          {/* ── Phase 4: Invoices ───────────────────────────────────────── */}
          <Route path="/invoices" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE]}>
              <InvoiceList />
            </ProtectedRoute>
          } />
          <Route path="/invoices/return/new" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <CreateReturnInvoice />
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
          <Route path="/invoices/:id/edit" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <EditInvoice />
            </ProtectedRoute>
          } />
          {/* Edit items on PENDING invoices only — full edit before approval */}
          <Route path="/invoices/:id/edit-items" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <EditPendingInvoice />
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
          <Route path="/reports/sales" element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.OWNER]}>
              <SalesReport />
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