// SGA — Last updated: NEW FILE — Global ErrorBoundary prevents blank screens on JS errors
// src/components/layout/ErrorBoundary.jsx
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
//
//   React does NOT handle render errors gracefully by default.
//   If ANY component inside the tree throws a JavaScript error during render,
//   React unmounts the ENTIRE application — resulting in a completely blank
//   gray screen. The sidebar disappears, navigation stops working, and the
//   only recovery is a full page refresh.
//
//   This is exactly what was happening on:
//   Messaging, Quotations, Reminders, Car Repo, Docs Repo, Admin Panel, Settings
//
//   This ErrorBoundary wraps the entire <Routes> in App.jsx. When any route
//   component throws during render, instead of unmounting everything, this
//   catches the error and renders a recovery UI — keeping the sidebar visible,
//   showing the error message, and providing a "Try Again" button that resets
//   the boundary and re-renders the page.
//
// ── HOW TO USE ───────────────────────────────────────────────────────────────
//
//   Wrap <Routes> in App.jsx:
//
//     <BrowserRouter>
//       <ErrorBoundary>
//         <Routes> ... </Routes>
//       </ErrorBoundary>
//       <ToastContainer />
//     </BrowserRouter>
//
// ── TECHNICAL NOTES ─────────────────────────────────────────────────────────
//
//   ErrorBoundary MUST be a class component — React does not support
//   getDerivedStateFromError / componentDidCatch in functional components.
//   This is the only class component in the entire SGA codebase; all others
//   are functional. This is intentional and necessary.

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
    this.handleReset = this.handleReset.bind(this);
    this.handleGoHome = this.handleGoHome.bind(this);
  }

  // Runs during render phase — captures the error so we can show fallback UI
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // Runs after render — lets us log the full component stack
  componentDidCatch(error, errorInfo) {
    console.error('[SGA ErrorBoundary] Caught render error:', error);
    console.error('[SGA ErrorBoundary] Component stack:', errorInfo?.componentStack);
    this.setState({ errorInfo });
  }

  // Reset the boundary so the user can try again without a full page refresh
  handleReset() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  handleGoHome() {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Use window.location to ensure a clean navigation that also resets
    // any broken Zustand state in the crashed stores.
    window.location.href = '/';
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const errorMessage = this.state.error?.message || 'An unexpected error occurred';
    const isDev = import.meta.env.DEV;

    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#CDCBC9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 16,
            padding: '36px 32px',
            maxWidth: 480,
            width: '100%',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            textAlign: 'center',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#FFEBEE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#CC0000"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#222222',
              margin: '0 0 8px',
            }}
          >
            Something went wrong
          </h2>

          {/* Description */}
          <p
            style={{
              fontSize: 14,
              color: '#666666',
              margin: '0 0 24px',
              lineHeight: 1.6,
            }}
          >
            This page ran into an unexpected error. Your data is safe. Use the
            buttons below to recover without refreshing.
          </p>

          {/* Error detail — shown only in dev mode */}
          {isDev && errorMessage && (
            <div
              style={{
                background: '#FFF5F5',
                border: '1px solid #FFCCCC',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 20,
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#CC0000',
                  margin: '0 0 4px',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontFamily: 'monospace',
                }}
              >
                Error (dev only)
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: '#AA0000',
                  margin: 0,
                  fontFamily: 'monospace',
                  wordBreak: 'break-word',
                }}
              >
                {errorMessage}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '11px 20px',
                borderRadius: 8,
                border: '1.5px solid #661F1F',
                background: '#F5F0EE',
                color: '#661F1F',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 44,
                fontFamily: 'inherit',
              }}
            >
              Try Again
            </button>

            <button
              onClick={this.handleGoHome}
              style={{
                padding: '11px 22px',
                borderRadius: 8,
                border: 'none',
                background: '#661F1F',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 44,
                fontFamily: 'inherit',
              }}
            >
              Go to Dashboard
            </button>
          </div>

          {/* Footer note */}
          <p
            style={{
              fontSize: 11,
              color: '#999',
              marginTop: 20,
              lineHeight: 1.5,
            }}
          >
            If this keeps happening on the same page, please note the page name
            and report it. Your invoices, customers, and inventory are unaffected.
          </p>
        </div>
      </div>
    );
  }
}
