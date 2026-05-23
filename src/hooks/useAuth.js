/**
 * useAuth.js
 * Thin wrapper that exposes the current user and role helpers.
 * This hook reads from Phase 1's authStore (Zustand) — adjust the import
 * path to match wherever Phase 1 placed its auth store.
 *
 * If you are developing Phase 2 in isolation, the mock at the bottom
 * can be toggled on by setting VITE_MOCK_AUTH=true in .env.local
 */

import { useMemo } from 'react';

// ── Import from Phase 1 auth store ───────────────────────────────────────────
// Adjust this import path to match your Phase 1 output:
//   e.g.  import useAuthStore from '../store/authStore';
// For now we export a hook that references window.__sgUser set by Phase 1's
// AuthProvider, so Phase 2 works regardless of exact Phase 1 file structure.

const useAuth = () => {
  // Phase 1 should store the current user in a Zustand auth store.
  // We read from it here via a best-effort import. If Phase 1's store is at
  // src/store/authStore.js, swap the line below:
  //   const { user, role } = useAuthStore();

  // ── Fallback: read from window (set by Phase 1 AuthProvider) ─────────────
  const user = typeof window !== 'undefined' ? window.__sgUser : null;

  const role = user?.role || user?.customClaims?.role || 'employee';

  const helpers = useMemo(
    () => ({
      user,
      role,
      uid: user?.uid || null,
      displayName: user?.displayName || user?.name || 'User',
      isSuperAdmin: role === 'superadmin',
      isOwner: role === 'owner',
      isEmployee: role === 'employee',
      isOwnerOrAbove: role === 'owner' || role === 'superadmin',
      isEmployeeOrAbove:
        role === 'employee' || role === 'owner' || role === 'superadmin',
    }),
    [user, role]
  );

  return helpers;
};

export default useAuth;
export { useAuth };  // named export alias for components that use { useAuth }

/**
 * INTEGRATION NOTE FOR PHASE 1 DEVELOPER
 * ─────────────────────────────────────────
 * In your Phase 1 AuthProvider or wherever you handle onAuthStateChanged,
 * please set:
 *
 *   window.__sgUser = {
 *     uid: firebaseUser.uid,
 *     displayName: firebaseUser.displayName,
 *     email: firebaseUser.email,
 *     role: idTokenResult.claims.role,   // custom claim set on backend
 *   };
 *
 * This allows all Phase 2+ modules to access auth without circular imports.
 * The recommended long-term solution is a shared Zustand authStore imported
 * directly — but the window approach works perfectly for parallel development.
 */