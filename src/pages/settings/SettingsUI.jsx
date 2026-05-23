// src/pages/Settings/components/SettingsUI.jsx
// Shared low-level UI primitives for all Settings panels.
// Every section card, save button, confirm dialog, and input uses these.
//
// ⚠️  SCOPE WARNING: Components exported here (Button, Input, Badge, etc.) are
// Settings-specific styled variants. Do NOT import them outside of pages/settings/.
// For global UI components, import from components/ui/ui.jsx instead.

import React, { useState } from "react";

// ─── Design tokens (mirrors Design Document) ──────────────────────────────────
export const T = {
  primary: "#661F1F",
  primaryHover: "#8B3A3A",
  bg: "var(--color-bg, #CDCBC9)",
  card: "var(--color-card, #F5F0EE)",
  cardElevated: "var(--color-card-elevated, #FFFFFF)",
  border: "#E8E2DF",
  borderFocus: "#661F1F",
  textPrimary: "var(--color-text, #222222)",
  textSecondary: "#666666",
  textMeta: "#999999",
  statusGreen: "#1A7A1A",
  statusGreenBg: "#E8F5E9",
  statusAmber: "#CC6600",
  statusAmberBg: "#FFF3E0",
  statusRed: "#CC0000",
  statusRedBg: "#FFEBEE",
  statusBlueBg: "#E3F2FD",
  statusBlue: "#0055CC",
  danger: "#CC0000",
  dangerBg: "#FFEBEE",
};

// ─── Section Card ──────────────────────────────────────────────────────────────
export function SectionCard({ title, subtitle, icon, children, danger = false }) {
  return (
    <div
      style={{
        background: T.card,
        borderRadius: 14,
        border: `1.5px solid ${danger ? "#F0B8B8" : T.border}`,
        marginBottom: 18,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          padding: "16px 20px 14px",
          borderBottom: `1px solid ${danger ? "#F0B8B8" : T.border}`,
          background: danger ? "#FFF5F5" : T.cardElevated,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {icon && (
          <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
        )}
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: danger ? T.danger : T.primary,
              fontFamily: "inherit",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "18px 20px" }}>{children}</div>
    </div>
  );
}

// ─── Field Row ─────────────────────────────────────────────────────────────────
export function FieldRow({ label, required, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 500,
          color: T.textSecondary,
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
        {required && <span style={{ color: T.danger, marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: T.textMeta, marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

// ─── Text Input ────────────────────────────────────────────────────────────────
export function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  error,
  style = {},
}) {
  const [focused, setFocused] = useState(false);
  return (
    <>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          fontSize: 14,
          borderRadius: 8,
          border: `1.5px solid ${error ? T.danger : focused ? T.borderFocus : T.border}`,
          background: disabled ? "#F0EDED" : T.cardElevated,
          color: T.textPrimary,
          outline: "none",
          transition: "border-color 0.2s",
          fontFamily: "inherit",
          ...style,
        }}
      />
      {error && (
        <div style={{ fontSize: 11, color: T.danger, marginTop: 3 }}>{error}</div>
      )}
    </>
  );
}

// ─── Textarea ──────────────────────────────────────────────────────────────────
export function Textarea({ value, onChange, placeholder, rows = 4, disabled = false }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 12px",
        fontSize: 14,
        borderRadius: 8,
        border: `1.5px solid ${focused ? T.borderFocus : T.border}`,
        background: disabled ? "#F0EDED" : T.cardElevated,
        color: T.textPrimary,
        outline: "none",
        resize: "vertical",
        fontFamily: "inherit",
        transition: "border-color 0.2s",
        lineHeight: 1.6,
      }}
    />
  );
}

// ─── Select ────────────────────────────────────────────────────────────────────
export function Select({ value, onChange, options, placeholder, disabled = false }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "10px 12px",
        fontSize: 14,
        borderRadius: 8,
        border: `1.5px solid ${T.border}`,
        background: T.cardElevated,
        color: T.textPrimary,
        outline: "none",
        fontFamily: "inherit",
        cursor: "pointer",
        appearance: "auto",
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={typeof opt === "string" ? opt : opt.value} value={typeof opt === "string" ? opt : opt.value}>
          {typeof opt === "string" ? opt : opt.label}
        </option>
      ))}
    </select>
  );
}

// ─── Primary Button ────────────────────────────────────────────────────────────
export function Button({
  children,
  onClick,
  loading = false,
  disabled = false,
  variant = "primary",
  size = "md",
  style = {},
}) {
  const variants = {
    primary: { background: T.primary, color: "#fff", border: "none" },
    secondary: { background: "transparent", color: T.primary, border: `1.5px solid ${T.primary}` },
    danger: { background: T.danger, color: "#fff", border: "none" },
    ghost: { background: "transparent", color: T.textSecondary, border: `1px solid ${T.border}` },
  };
  const sizes = {
    sm: { padding: "6px 14px", fontSize: 12 },
    md: { padding: "10px 20px", fontSize: 14 },
    lg: { padding: "13px 28px", fontSize: 15 },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...variants[variant],
        ...sizes[size],
        borderRadius: 8,
        fontWeight: 600,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
        transition: "opacity 0.2s, transform 0.1s",
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 44,
        ...style,
      }}
    >
      {loading ? <span style={{ opacity: 0.7 }}>Saving…</span> : children}
    </button>
  );
}

// ─── Save Row (label + save button) ───────────────────────────────────────────
export function SaveRow({ onSave, loading, saved, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 18,
        paddingTop: 14,
        borderTop: `1px solid ${T.border}`,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1 }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {saved && (
          <span style={{ color: T.statusGreen, fontSize: 13, fontWeight: 500 }}>
            ✓ Saved
          </span>
        )}
        <Button onClick={onSave} loading={loading}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────────
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
  requireTyping,
}) {
  const [typed, setTyped] = useState("");

  if (!open) return null;

  const canConfirm = requireTyping ? typed === requireTyping : true;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: T.cardElevated,
          borderRadius: 16,
          padding: "28px 28px 24px",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.6, marginBottom: 18 }}>
          {message}
        </div>
        {requireTyping && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>
              Type <strong style={{ color: T.danger }}>{requireTyping}</strong> to confirm:
            </div>
            <Input
              value={typed}
              onChange={setTyped}
              placeholder={requireTyping}
              style={{ borderColor: typed === requireTyping ? T.statusGreen : T.border }}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={() => { setTyped(""); onCancel(); }}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => { setTyped(""); onConfirm(); }}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
export function Badge({ label, color = "green" }) {
  const colorMap = {
    green: { bg: T.statusGreenBg, text: T.statusGreen },
    amber: { bg: T.statusAmberBg, text: T.statusAmber },
    red: { bg: T.statusRedBg, text: T.statusRed },
    blue: { bg: T.statusBlueBg, text: T.statusBlue },
    gray: { bg: "#F0F0F0", text: "#666" },
    purple: { bg: "#F3E5F5", text: "#6A1B9A" },
  };
  const c = colorMap[color] || colorMap.gray;
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        fontSize: 10,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: 20,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        fontFamily: "inherit",
      }}
    >
      {label}
    </span>
  );
}

// ─── Skeleton loader ───────────────────────────────────────────────────────────
export function Skeleton({ height = 16, width = "100%", style = {} }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: 6,
        background: "linear-gradient(90deg, #E8E2DF 25%, #D8D2CF 50%, #E8E2DF 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
        ...style,
      }}
    />
  );
}