/**
 * ui.jsx
 * Shared, theme-aware UI primitives for the entire app.
 * Every component reads isDark from the useTheme hook and applies
 * the correct color token from tokens.js.
 *
 * Components exported:
 *   Button, IconButton, Input, Textarea, Select, MultiSelect,
 *   Badge, Card, Modal, Spinner, EmptyState, SectionDivider, Tooltip
 */

import { useState, useRef, useEffect, forwardRef } from 'react';
import useTheme from '../../hooks/useTheme';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../../lib/tokens';

// ── Theme helper ──────────────────────────────────────────────────────────────
const useC = () => {
  const { isDark } = useTheme();
  return isDark ? COLORS.dark : COLORS.light;
};

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON
// ─────────────────────────────────────────────────────────────────────────────
export const Button = ({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost'
  size = 'md',         // 'sm' | 'md' | 'lg'
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  onClick,
  type = 'button',
  style: extraStyle = {},
}) => {
  const c = useC();

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontFamily: FONTS.body,
    fontWeight: 600,
    borderRadius: RADIUS.md,
    border: '1.5px solid transparent',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'all 0.18s ease',
    outline: 'none',
    minHeight: size === 'sm' ? 36 : size === 'lg' ? 52 : 44,
    fontSize: size === 'sm' ? 13 : size === 'lg' ? 16 : 14,
    padding: size === 'sm' ? '0 12px' : size === 'lg' ? '0 24px' : '0 18px',
    width: fullWidth ? '100%' : undefined,
    whiteSpace: 'nowrap',
  };

  const variants = {
    primary: {
      background: c.primary,
      color: '#FFFFFF',
      borderColor: c.primary,
    },
    secondary: {
      background: 'transparent',
      color: c.primary,
      borderColor: c.primary,
    },
    danger: {
      background: c.statusRedText,
      color: '#FFFFFF',
      borderColor: c.statusRedText,
    },
    ghost: {
      background: 'transparent',
      color: c.textSecondary,
      borderColor: 'transparent',
    },
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={{ ...base, ...variants[variant], ...extraStyle }}
    >
      {loading ? <Spinner size={16} color="#FFFFFF" /> : icon}
      {children}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ICON BUTTON
// ─────────────────────────────────────────────────────────────────────────────
export const IconButton = ({ icon, onClick, title, color, style: ex = {} }) => {
  const c = useC();
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: color || c.textSecondary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: RADIUS.md,
        transition: 'background 0.15s',
        ...ex,
      }}
    >
      {icon}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────────────────
export const Input = forwardRef(({
  label,
  error,
  required,
  icon,
  hint,
  style: ex = {},
  containerStyle = {},
  ...props
}, ref) => {
  const c = useC();
  const [focused, setFocused] = useState(false);

  const inputStyle = {
    width: '100%',
    height: 44,
    border: `1.5px solid ${error ? c.statusRedText : focused ? c.borderFocus : c.border}`,
    borderRadius: RADIUS.md,
    padding: icon ? '0 12px 0 38px' : '0 12px',
    fontFamily: FONTS.body,
    fontSize: 14,
    color: c.textPrimary,
    background: c.cardBg,
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
    ...ex,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...containerStyle }}>
      {label && (
        <label style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 500, color: error ? c.statusRedText : c.textSecondary }}>
          {label}{required && <span style={{ color: c.statusRedText, marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: c.textSecondary, pointerEvents: 'none' }}>
            {icon}
          </span>
        )}
        <input
          ref={ref}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={inputStyle}
          {...props}
        />
      </div>
      {hint && !error && <span style={{ fontSize: 11, color: c.textSecondary, fontFamily: FONTS.body }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: c.statusRedText, fontFamily: FONTS.body }}>{error}</span>}
    </div>
  );
});
Input.displayName = 'Input';

// ─────────────────────────────────────────────────────────────────────────────
// TEXTAREA
// ─────────────────────────────────────────────────────────────────────────────
export const Textarea = forwardRef(({ label, error, required, rows = 3, style: ex = {}, ...props }, ref) => {
  const c = useC();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 500, color: c.textSecondary }}>
          {label}{required && <span style={{ color: c.statusRedText, marginLeft: 2 }}>*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          border: `1.5px solid ${error ? c.statusRedText : focused ? c.borderFocus : c.border}`,
          borderRadius: RADIUS.md,
          padding: '10px 12px',
          fontFamily: FONTS.body,
          fontSize: 14,
          color: c.textPrimary,
          background: c.cardBg,
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
          ...ex,
        }}
        {...props}
      />
      {error && <span style={{ fontSize: 11, color: c.statusRedText }}>{error}</span>}
    </div>
  );
});
Textarea.displayName = 'Textarea';

// ─────────────────────────────────────────────────────────────────────────────
// SELECT
// ─────────────────────────────────────────────────────────────────────────────
export const Select = forwardRef(({ label, error, required, options = [], placeholder, style: ex = {}, containerStyle = {}, ...props }, ref) => {
  const c = useC();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...containerStyle }}>
      {label && (
        <label style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 500, color: c.textSecondary }}>
          {label}{required && <span style={{ color: c.statusRedText, marginLeft: 2 }}>*</span>}
        </label>
      )}
      <select
        ref={ref}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          height: 44,
          border: `1.5px solid ${error ? c.statusRedText : focused ? c.borderFocus : c.border}`,
          borderRadius: RADIUS.md,
          padding: '0 12px',
          fontFamily: FONTS.body,
          fontSize: 14,
          color: props.value ? c.textPrimary : c.textSecondary,
          background: c.cardBg,
          outline: 'none',
          cursor: 'pointer',
          boxSizing: 'border-box',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: 32,
          ...ex,
        }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) =>
          typeof opt === 'string'
            ? <option key={opt} value={opt}>{opt}</option>
            : <option key={opt.value} value={opt.value}>{opt.label}</option>
        )}
      </select>
      {error && <span style={{ fontSize: 11, color: c.statusRedText }}>{error}</span>}
    </div>
  );
});
Select.displayName = 'Select';

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-SELECT
// Custom chip-based multi-select for Add-Ons, Advancers etc.
// ─────────────────────────────────────────────────────────────────────────────
export const MultiSelect = ({ label, required, options = [], value = [], onChange, error }) => {
  const c = useC();
  const toggle = (opt) => {
    const next = value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt];
    onChange(next);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 500, color: c.textSecondary }}>
          {label}{required && <span style={{ color: c.statusRedText, marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((opt) => {
          const selected = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              style={{
                padding: '6px 12px',
                borderRadius: RADIUS.full,
                border: `1.5px solid ${selected ? c.primary : c.border}`,
                background: selected ? c.primary : 'transparent',
                color: selected ? '#FFFFFF' : c.textSecondary,
                fontFamily: FONTS.body,
                fontSize: 13,
                fontWeight: selected ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {selected && '✓ '}{opt}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {value.map((v) => (
            <span key={v} style={{ background: c.statusAmberBg, color: c.statusAmberText, fontSize: 11, padding: '2px 8px', borderRadius: RADIUS.full, fontFamily: FONTS.body, fontWeight: 600 }}>
              {v}
            </span>
          ))}
        </div>
      )}
      {error && <span style={{ fontSize: 11, color: c.statusRedText }}>{error}</span>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BADGE
// ─────────────────────────────────────────────────────────────────────────────
export const Badge = ({ children, variant = 'neutral', style: ex = {} }) => {
  const c = useC();
  const variants = {
    success: { bg: c.statusGreenBg, color: c.statusGreenText },
    warning: { bg: c.statusAmberBg, color: c.statusAmberText },
    danger:  { bg: c.statusRedBg,   color: c.statusRedText   },
    info:    { bg: c.statusBlueBg,  color: c.statusBlueText  },
    purple:  { bg: c.statusPurpleBg,color: c.statusPurpleText},
    neutral: { bg: c.elevatedBg,    color: c.textSecondary   },
  };
  const v = variants[variant] || variants.neutral;
  return (
    <span style={{
      background: v.bg,
      color: v.color,
      fontSize: 10,
      fontWeight: 600,
      fontFamily: FONTS.body,
      padding: '3px 8px',
      borderRadius: RADIUS.full,
      letterSpacing: 0.3,
      display: 'inline-block',
      whiteSpace: 'nowrap',
      ...ex,
    }}>
      {children}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────────────────────
export const Card = ({ children, style: ex = {}, onClick, hoverable = false }) => {
  const c = useC();
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hoverable && setHovered(true)}
      onMouseLeave={() => hoverable && setHovered(false)}
      style={{
        background: c.cardBg,
        borderRadius: RADIUS.lg,
        boxShadow: hovered ? SHADOWS.cardHover : SHADOWS.card,
        padding: 16,
        cursor: onClick ? 'pointer' : undefined,
        transition: 'box-shadow 0.2s, transform 0.2s',
        transform: hovered && hoverable ? 'translateY(-2px)' : 'none',
        border: `1px solid ${c.border}`,
        ...ex,
      }}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, maxWidth = 560, footer }) => {
  const c = useC();
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: c.white,
          borderRadius: RADIUS.xl,
          boxShadow: SHADOWS.modal,
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontFamily: FONTS.heading, fontSize: 18, color: c.textPrimary }}>{title}</h3>
          <IconButton icon={<span style={{ fontSize: 20, lineHeight: 1 }}>×</span>} onClick={onClose} />
        </div>
        {/* Body */}
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {/* Footer */}
        {footer && (
          <div style={{ padding: '14px 22px', borderTop: `1px solid ${c.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SPINNER
// ─────────────────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 24, color }) => {
  const c = useC();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" fill="none" stroke={color || c.primary} strokeWidth="2.5" strokeDasharray="40 20" strokeLinecap="round" />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
export const EmptyState = ({ icon, title, description, action }) => {
  const c = useC();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 48, opacity: 0.35 }}>{icon || '📋'}</div>
      <h3 style={{ margin: 0, fontFamily: FONTS.heading, fontSize: 20, color: c.textPrimary }}>{title}</h3>
      {description && <p style={{ margin: 0, fontFamily: FONTS.body, fontSize: 14, color: c.textSecondary, maxWidth: 320 }}>{description}</p>}
      {action}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DIVIDER
// ─────────────────────────────────────────────────────────────────────────────
export const SectionDivider = ({ title, style: ex = {} }) => {
  const c = useC();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 8px', ...ex }}>
      <div style={{ height: 2, flex: 1, background: c.border }} />
      <span style={{ fontFamily: FONTS.body, fontSize: 11, fontWeight: 700, color: c.primary, letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      <div style={{ height: 2, flex: 1, background: c.border }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────────────────────
export const Skeleton = ({ width = '100%', height = 18, radius = RADIUS.sm, style: ex = {} }) => {
  const c = useC();
  return (
    <div style={{
      width, height,
      borderRadius: radius,
      background: `linear-gradient(90deg, ${c.elevatedBg} 25%, ${c.border} 50%, ${c.elevatedBg} 75%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      ...ex,
    }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
};
