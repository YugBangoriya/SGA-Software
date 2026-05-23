// ─────────────────────────────────────────────────────────
//  src/pages/DocsRepository/components/DeleteConfirmDialog.jsx
//
//  Reusable destructive-action confirmation dialog.
//  Used for both document deletion and category deletion.
// ─────────────────────────────────────────────────────────
import { useState } from "react";

export default function DeleteConfirmDialog({
  title       = "Delete",
  message     = "Are you sure? This cannot be undone.",
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  darkMode = false,
  loading  = false,
}) {
  const bg      = darkMode ? "#2A2A2A" : "#FFFFFF";
  const text    = darkMode ? "#E8E8E8" : "#222222";
  const subtext = darkMode ? "#999999" : "#555555";
  const border  = darkMode ? "#3A3A3A" : "#E8E2DF";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div
        style={{
          background: bg,
          borderRadius: 16,
          padding: "28px 28px 24px",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          border: `1px solid ${border}`,
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 52,
            height: 52,
            background: "#FFEBEE",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            marginBottom: 16,
          }}
        >
          🗑
        </div>

        <h3
          style={{
            margin: "0 0 8px",
            color: text,
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: "0 0 24px",
            color: subtext,
            fontSize: 14,
            fontFamily: "'Inter', sans-serif",
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              background: "transparent",
              border: `1.5px solid ${border}`,
              borderRadius: 10,
              padding: "11px 0",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              color: subtext,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              background: loading ? "#FFABAB" : "#CC0000",
              border: "none",
              borderRadius: 10,
              padding: "11px 0",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'Inter', sans-serif",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
