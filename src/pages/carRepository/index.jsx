/**
 * CarRepository/index.jsx
 * Shree Ganesh Automobile — Phase 6: Car Repository
 *
 * Entry point for the Car Repository section.
 * Routes to SuperAdmin management view or Owner read-only browser
 * based on the authenticated user's role.
 *
 * FIX (Phase 6 Bug): Previously used `const { user } = useAuthStore()` but
 * authStore does NOT export a `user` property — it exposes `role`, `firebaseUser`,
 * and `userDoc`. This meant `user` was always `undefined`, the `if (!user) return null`
 * guard fired on every render, and the page was permanently blank.
 * Fixed: now reads `role` and `isLoading` directly from authStore.
 */

import useAuthStore from '../../store/authStore';
import { useDarkMode } from '../../hooks/useTheme';
import CarRepositoryAdmin from './CarRepositoryAdmin';
import CarRepositoryBrowser from './CarRepositoryBrowser';

export default function CarRepositoryPage() {
  const { role, isLoading } = useAuthStore();
  const { isDark } = useDarkMode();

  // Still resolving auth — show a minimal loading state to avoid flash
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: isDark ? '#1A1A1A' : '#CDCBC9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid #661F1F33',
            borderTop: '3px solid #661F1F',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (role === 'superadmin') {
    return <CarRepositoryAdmin isDark={isDark} />;
  }

  if (role === 'owner') {
    return <CarRepositoryBrowser isDark={isDark} />;
  }

  // Employees can view via the browser (read-only)
  if (role === 'employee') {
    return <CarRepositoryBrowser isDark={isDark} />;
  }

  // Fallback — no recognised role (should not normally reach here
  // because the ProtectedRoute in App.jsx enforces access before rendering)
  return (
    <div
      style={{
        minHeight: '100vh',
        background: isDark ? '#1A1A1A' : '#CDCBC9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', color: isDark ? '#999' : '#666' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <p style={{ fontSize: 16 }}>You do not have access to the Car Repository.</p>
      </div>
    </div>
  );
}