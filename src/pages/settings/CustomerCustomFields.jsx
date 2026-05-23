// src/pages/Customers/components/CustomerCustomFields.jsx
// Renders custom fields on the Customer Profile page.
// Reads field definitions from settingsStore (Phase 11)
// and values from the customer document's customFields{} map.
//
// Usage:
//   import CustomerCustomFields from "./CustomerCustomFields";
//   <CustomerCustomFields customer={customer} />
//
// Add this component at the bottom of your existing CustomerProfile page,
// inside the last section card — just before the closing tag.

import React from "react";
import { useSettings } from "../../hooks/useSettings";

const T = {
  primary: "#661F1F",
  card: "var(--color-card, #F5F0EE)",
  cardElevated: "var(--color-card-elevated, #FFFFFF)",
  border: "#E8E2DF",
  textPrimary: "var(--color-text, #222222)",
  textSecondary: "#666666",
  textMeta: "#999999",
};

export default function CustomerCustomFields({ customer }) {
  const { customFields } = useSettings();

  // Nothing to show if no custom fields have been defined
  if (!customFields || customFields.length === 0) return null;

  // Get the stored values from the customer document
  const storedValues = customer?.customFields || {};

  // Filter to only show fields that have a value OR are required
  const fieldsToShow = customFields.filter(
    (f) => storedValues[f.key] !== undefined && storedValues[f.key] !== ""
  );

  if (fieldsToShow.length === 0) return null;

  return (
    <div
      style={{
        background: T.card,
        borderRadius: 14,
        border: `1.5px solid ${T.border}`,
        marginTop: 16,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 18px 12px",
          borderBottom: `1px solid ${T.border}`,
          background: T.cardElevated,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>🧩</span>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.primary }}>
          Additional Information
        </div>
      </div>

      {/* Fields Grid */}
      <div
        style={{
          padding: "16px 18px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "14px 24px",
        }}
      >
        {fieldsToShow.map((field) => {
          const value = storedValues[field.key];
          return (
            <div key={field.key}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: T.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  marginBottom: 4,
                }}
              >
                {field.label}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: T.textPrimary,
                  fontWeight: 400,
                }}
              >
                {field.type === "date" && value
                  ? new Date(value).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : value || (
                      <span style={{ color: T.textMeta, fontStyle: "italic" }}>
                        Not set
                      </span>
                    )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
