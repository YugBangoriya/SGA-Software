/**
 * CarRepository/index.jsx
 * Shree Ganesh Automobile — Phase 6: Car Repository
 *
 * Entry point for the Car Repository section.
 * Routes to SuperAdmin management view or Owner read-only browser
 * based on the authenticated user's role.
 *
 * Assumes Phase 1 provides:
 *   - useAuthStore() → { user: { role, displayName } }
 *   - useDarkMode hook or store
 */

import useAuthStore from '../../store/authStore';
import { useDarkMode } from '../../hooks/useTheme';
import CarRepositoryAdmin from './CarRepositoryAdmin';
import CarRepositoryBrowser from './CarRepositoryBrowser';

export default function CarRepositoryPage() {
  const { user } = useAuthStore();
  const { isDark } = useDarkMode();

  if (!user) return null;

  if (user.role === 'superadmin') {
    return <CarRepositoryAdmin isDark={isDark} />;
  }

  if (user.role === 'owner') {
    return <CarRepositoryBrowser isDark={isDark} />;
  }

  // Employees have no access — this route should be protected at the router level,
  // but we render a fallback just in case.
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