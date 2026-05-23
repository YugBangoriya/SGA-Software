/**
 * CustomerRoutes.jsx
 * Defines all routes under /customers.
 *
 * FIX (Phase 2 Bug): Removed the inner `RequireAuth` wrapper from
 * `CustomerRoutesWrapper`. App.jsx already wraps <CustomerRoutes /> in a
 * <ProtectedRoute> that handles authentication and role-checking. The
 * inner guard was redundant AND it used the old broken useAuth() hook
 * (which read window.__sgUser — never set by Phase 1 auth), causing the
 * entire /customers route to silently redirect to /login.
 *
 * The `RequireOwner` / `RequireSuperAdmin` helpers below are kept because
 * they are still needed for RBAC enforcement within customer sub-routes,
 * and useAuth() is now fixed to read from authStore correctly.
 *
 * ROUTES:
 *   /customers              → CustomerList
 *   /customers/new          → CustomerForm (create)
 *   /customers/:id          → CustomerDetail
 *   /customers/:id/edit     → CustomerForm (edit)
 *
 * PLACE AT: src/pages/customers/CustomerRoutes.jsx
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import CustomerList     from './CustomerList';
import CustomerForm     from './CustomerForm';
import CustomerDetail   from './CustomerDetail';
import CustomerSettings from './CustomerSettings';
import useAuth          from '../../hooks/useAuth';

// ── Owner/SuperAdmin-only guard ─────────────────────────────────────────────
function RequireOwner({ children }) {
  const { isOwnerOrAbove } = useAuth();
  if (!isOwnerOrAbove) {
    return <Navigate to="/customers" replace />;
  }
  return children;
}

// ── Owner-or-above guard (CustomerSettings is shown to owners too) ──────────
function RequireOwnerForSettings({ children }) {
  const { isOwnerOrAbove } = useAuth();
  if (!isOwnerOrAbove) {
    return <Navigate to="/customers" replace />;
  }
  return children;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES COMPONENT
// Mounted in App.jsx as:
//   <Route path="/customers/*" element={<ProtectedRoute ...><CustomerRoutes /></ProtectedRoute>} />
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerRoutesWrapper() {
  // NOTE: Auth check is already done by App.jsx's <ProtectedRoute>.
  // No inner auth guard needed here.
  return (
    <Routes>
      {/* List — all authenticated users */}
      <Route index element={<CustomerList />} />

      {/* Create — Owner + Employee */}
      <Route
        path="new"
        element={<CustomerForm mode="create" />}
      />

      {/* Detail — all authenticated users */}
      <Route path=":id" element={<CustomerDetail />} />

      {/* Edit — Owner + Employee */}
      <Route
        path=":id/edit"
        element={<CustomerForm mode="edit" />}
      />
    </Routes>
  );
}

// Settings route — used in Phase 11's settings page or as a standalone page
export function CustomerSettingsRoute() {
  return (
    <RequireOwnerForSettings>
      <CustomerSettings />
    </RequireOwnerForSettings>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLAT ROUTE DEFINITIONS (alternative for createBrowserRouter setups)
// ─────────────────────────────────────────────────────────────────────────────
export const CUSTOMER_ROUTE_DEFINITIONS = [
  { path: '/customers',         element: <CustomerList /> },
  { path: '/customers/new',     element: <CustomerForm mode="create" /> },
  { path: '/customers/:id',     element: <CustomerDetail /> },
  { path: '/customers/:id/edit',element: <CustomerForm mode="edit" /> },
  {
    path: '/settings/customers',
    element: <RequireOwner><CustomerSettings /></RequireOwner>,
  },
];