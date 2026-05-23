/**
 * CustomerRoutes.jsx
 * Defines all routes under /customers.
 * Wrapped with a route guard — unauthenticated users are redirected to /login.
 *
 * ROUTES:
 *   /customers              → CustomerList
 *   /customers/new          → CustomerForm (create)
 *   /customers/:id          → CustomerDetail
 *   /customers/:id/edit     → CustomerForm (edit)
 *   /settings/customers     → CustomerSettings
 *
 * INTEGRATION:
 *   Add <CustomerRoutes /> inside your Phase 1 <Routes> block, or
 *   use the exported CUSTOMER_ROUTE_DEFINITIONS array if your Phase 1
 *   router uses a different pattern.
 */

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import CustomerList from './CustomerList';
import CustomerForm from './CustomerForm';
import CustomerDetail from './CustomerDetail';
import CustomerSettings from './CustomerSettings';
import useAuth from '../../hooks/useAuth';

// ── Route guard ────────────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  // In Phase 1 integration, `user` comes from Phase 1's auth state.
  // If not logged in, redirect to /login preserving intended destination.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

// ── Owner/SuperAdmin-only guard ─────────────────────────────────────────────
function RequireOwner({ children }) {
  const { isOwnerOrAbove } = useAuth();
  if (!isOwnerOrAbove) {
    return <Navigate to="/customers" replace />;
  }
  return children;
}

// ── SuperAdmin-only guard ───────────────────────────────────────────────────
function RequireSuperAdmin({ children }) {
  const { isSuperAdmin, isOwnerOrAbove } = useAuth();
  // CustomerSettings shows owner section to owners, so let owners through too
  if (!isOwnerOrAbove) {
    return <Navigate to="/customers" replace />;
  }
  return children;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES COMPONENT
// Drop this inside your Phase 1 router:
//   <Route path="/customers/*" element={<CustomerRoutesWrapper />} />
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerRoutesWrapper() {
  return (
    <RequireAuth>
      <Routes>
        {/* List — all authenticated users */}
        <Route index element={<CustomerList />} />

        {/* Create — Owner + Employee (Employee creates, Owner approves pattern) */}
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
    </RequireAuth>
  );
}

// Settings route — used in Phase 11's settings page or as a standalone page
export function CustomerSettingsRoute() {
  return (
    <RequireSuperAdmin>
      <CustomerSettings />
    </RequireSuperAdmin>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLAT ROUTE DEFINITIONS
// Alternative: if Phase 1 uses createBrowserRouter / RouterProvider,
// import and spread these into your route config array.
// ─────────────────────────────────────────────────────────────────────────────
export const CUSTOMER_ROUTE_DEFINITIONS = [
  {
    path: '/customers',
    element: <RequireAuth><CustomerList /></RequireAuth>,
  },
  {
    path: '/customers/new',
    element: <RequireAuth><CustomerForm mode="create" /></RequireAuth>,
  },
  {
    path: '/customers/:id',
    element: <RequireAuth><CustomerDetail /></RequireAuth>,
  },
  {
    path: '/customers/:id/edit',
    element: <RequireAuth><CustomerForm mode="edit" /></RequireAuth>,
  },
  {
    path: '/settings/customers',
    element: <RequireOwner><CustomerSettings /></RequireOwner>,
  },
];
