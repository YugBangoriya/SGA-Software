/**
 * useAuth.js
 * Thin wrapper that exposes the current user and role helpers.
 *
 * FIX (Phase 2 Bug): Previously this hook read from window.__sgUser which is
 * never set by Phase 1's Firebase auth system. Phase 1 uses Zustand's
 * authStore. This hook now reads directly from authStore, making it consistent
 * with ProtectedRoute and the rest of the app.
 *
 * PLACE AT: src/hooks/useAuth.js
 */

import { useMemo } from 'react';
import useAuthStore from '../store/authStore';

const useAuth = () => {
  const { firebaseUser, userDoc, role } = useAuthStore();

  const helpers = useMemo(
    () => ({
      // `user` keeps the same shape that Phase 2 components expect:
      // they check `if (!user)` — so we expose firebaseUser as `user`.
      user: firebaseUser,
      role: role || null,
      uid: firebaseUser?.uid || null,
      displayName: userDoc?.name || firebaseUser?.displayName || 'User',

      // Boolean helpers used throughout Phase 2 components
      isSuperAdmin: role === 'superadmin',
      isOwner: role === 'owner',
      isEmployee: role === 'employee',
      isOwnerOrAbove: role === 'owner' || role === 'superadmin',
      isEmployeeOrAbove:
        role === 'employee' || role === 'owner' || role === 'superadmin',
    }),
    [firebaseUser, userDoc, role]
  );

  return helpers;
};

export default useAuth;
export { useAuth }; // named alias for components that import { useAuth }