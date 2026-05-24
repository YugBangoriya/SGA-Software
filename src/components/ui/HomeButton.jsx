// SGA — Last updated: New component — HomeButton for all module initial screens
// src/components/ui/HomeButton.jsx
//
// Reusable "Back to Home" button placed in module initial screen headers.
// Renders a small house icon button in the top-left corner of any page header.
//
// Usage:
//   import HomeButton from '../../components/ui/HomeButton';
//   <HomeButton />                  — dark variant (white icon, for burgundy headers)
//   <HomeButton variant="light" />  — light variant (burgundy icon, for light headers)
//
// The button uses useNavigate() internally so no props are needed.

import { useNavigate } from 'react-router-dom';

// Inline Home SVG icon — avoids any lucide import issues on this component
function HomeIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export default function HomeButton({ variant = 'dark' }) {
  const navigate = useNavigate();

  const isDark = variant === 'dark';

  return (
    <button
      onClick={() => navigate('/')}
      title="Go to Home"
      aria-label="Go to Home"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 12px',
        borderRadius: 8,
        border: isDark
          ? '1.5px solid rgba(255,255,255,0.3)'
          : '1.5px solid #E8E2DF',
        background: isDark
          ? 'rgba(255,255,255,0.12)'
          : '#F5F0EE',
        color: isDark ? '#FFFFFF' : '#661F1F',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'system-ui, sans-serif',
        transition: 'background 0.15s',
        flexShrink: 0,
        minHeight: 34,
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isDark
          ? 'rgba(255,255,255,0.22)'
          : '#EDE7E3';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isDark
          ? 'rgba(255,255,255,0.12)'
          : '#F5F0EE';
      }}
    >
      <HomeIcon size={14} color={isDark ? '#FFFFFF' : '#661F1F'} />
      <span>Home</span>
    </button>
  );
}