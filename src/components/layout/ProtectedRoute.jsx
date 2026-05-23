// ─────────────────────────────────────────────────────────────────────────────
// src/components/layout/ProtectedRoute.jsx
// Wraps any route that requires:
//   1. Authentication (redirects to /login if not signed in)
//   2. Optionally: a minimum role level (redirects to /unauthorized if no access)
// ─────────────────────────────────────────────────────────────────────────────

import { Navigate, useLocation } from "react-router-dom";
import useAuthStore from "@/store/authStore";
import { canAccessRoute } from "@/lib/rbac";

/**
 * @param {React.ReactNode} children   - The protected page to render
 * @param {string[]} [allowedRoles]    - Explicit role list override; if omitted,
 *                                       uses ROUTE_ACCESS table from rbac.js
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, role } = useAuthStore();
  const location = useLocation();

  // Still resolving auth state — show nothing (prevents flash)
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-app)" }}
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
          />
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>Loading…</p>
        </div>
      </div>
    );
  }

  // Not authenticated → Login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check
  const allowed = allowedRoles
    ? allowedRoles.includes(role)
    : canAccessRoute(role, location.pathname);

  if (!allowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
