/**
 * reportingRoutes.jsx
 *
 * Drop these <Route> elements inside your existing <Routes> block in App.jsx.
 * They are wrapped in a ProtectedRoute that checks for 'owner' or 'superadmin' role,
 * except AuditLogViewer which is already restricted in the component itself.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HOW TO INTEGRATE into App.jsx:
 *
 * 1. Import the screens:
 *
 *    import ReportingHub           from './ReportingHub';
 *    import AuditLogViewer         from './AuditLogViewer';
 *    import ProfitLossReport       from './ProfitLossReport';
 *    import PendingInvoicesSummary from './PendingInvoicesSummary';
 *    import CustomerAcquisitionPipeline from './CustomerAcquisitionPipeline';
 *    import FollowUpTracker        from './FollowUpTracker';
 *    import DashboardHome          from './DashboardHome';
 *
 * 2. Replace your existing '/' or '/dashboard' route with DashboardHome.
 *
 * 3. Add the reporting routes inside your existing <Routes> block:
 *
 *    // ── Reporting & Analytics (Phase 10) ──────────────────────────────
 *    <Route
 *      path="/reporting"
 *      element={
 *        <OwnerGuard userRole={userRole}>
 *          <ReportingHub userRole={userRole} />
 *        </OwnerGuard>
 *      }
 *    />
 *    <Route
 *      path="/reporting/audit"
 *      element={<AuditLogViewer userRole={userRole} />}
 *    />
 *    <Route
 *      path="/reporting/profit-loss"
 *      element={
 *        <OwnerGuard userRole={userRole}>
 *          <ProfitLossReport />
 *        </OwnerGuard>
 *      }
 *    />
 *    <Route
 *      path="/reporting/pending-invoices"
 *      element={
 *        <OwnerGuard userRole={userRole}>
 *          <PendingInvoicesSummary
 *            onNavigateToInvoice={(id) => navigate(`/invoices/${id}`)}
 *          />
 *        </OwnerGuard>
 *      }
 *    />
 *    <Route
 *      path="/reporting/pipeline"
 *      element={
 *        <OwnerGuard userRole={userRole}>
 *          <CustomerAcquisitionPipeline />
 *        </OwnerGuard>
 *      }
 *    />
 *    <Route
 *      path="/reporting/follow-ups"
 *      element={
 *        <OwnerGuard userRole={userRole}>
 *          <FollowUpTracker />
 *        </OwnerGuard>
 *      }
 *    />
 *
 * ─────────────────────────────────────────────────────────────────────────
 * OwnerGuard (add this helper component in App.jsx or a separate guards.jsx):
 *
 *    function OwnerGuard({ userRole, children }) {
 *      const allowed = ['owner', 'superadmin'];
 *      if (!allowed.includes((userRole || '').toLowerCase())) {
 *        return <Navigate to="/" replace />;
 *      }
 *      return children;
 *    }
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DashboardHome props needed in App.jsx:
 *
 *    <Route
 *      path="/"
 *      element={
 *        <DashboardHome
 *          userName={currentUser?.displayName || currentUser?.email}
 *          userRole={userRole}
 *        />
 *      }
 *    />
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Bottom Nav link to Reporting (add inside your BottomNav or MoreMenu screen):
 *
 *    import { BarChart2 } from 'lucide-react';
 *
 *    // Inside MoreMenu / the "More" tab screen:
 *    <NavItem
 *      icon={BarChart2}
 *      label="Reports"
 *      onClick={() => navigate('/reporting')}
 *      restricted={['owner', 'superadmin']}
 *    />
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Firestore indexes required (add in Firebase Console → Firestore → Indexes):
 *
 *   Collection: invoices
 *     Fields: approvalStatus ASC, date ASC          (for PendingInvoicesSummary)
 *     Fields: approvalStatus ASC, date DESC          (for ProfitLossReport)
 *     Fields: paymentStatus  ASC, date ASC           (for PendingInvoicesSummary)
 *
 *   Collection: followUps
 *     Fields: status ASC, scheduledDate ASC          (for FollowUpTracker)
 *
 *   Collection: reminderLog
 *     Fields: nextReminderDate ASC                   (for DashboardStats)
 *
 *   Collection: auditLog
 *     Fields: userId ASC, timestamp DESC             (for AuditLogViewer user filter)
 *     Fields: action ASC,  timestamp DESC            (for AuditLogViewer action filter)
 *
 *   Note: Single-field indexes are created automatically by Firestore.
 *   Composite indexes must be created manually or via firebase.indexes.json.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const REPORTING_ROUTES = [
  { path: '/reporting',                  label: 'Reports Hub',         roles: ['owner', 'superadmin'] },
  { path: '/reporting/audit',            label: 'Audit Log',           roles: ['owner', 'superadmin'] },
  { path: '/reporting/profit-loss',      label: 'Profit & Loss',       roles: ['owner', 'superadmin'] },
  { path: '/reporting/pending-invoices', label: 'Pending Invoices',    roles: ['owner', 'superadmin'] },
  { path: '/reporting/pipeline',         label: 'Acquisition Pipeline',roles: ['owner', 'superadmin'] },
  { path: '/reporting/follow-ups',       label: 'Follow-up Tracker',   roles: ['owner', 'superadmin'] },
];
