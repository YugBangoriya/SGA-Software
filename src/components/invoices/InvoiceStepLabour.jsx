// ============================================================
// InvoiceStepLabour.jsx — Step 3: Labour Cost Entry
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { Wrench, IndianRupee } from "lucide-react";
import { formatCurrency, calculateTotals } from "../../lib/invoiceHelpers";

const COMMON_LABOUR = [500, 750, 1000, 1500, 2000, 2500, 3000];

export default function InvoiceStepLabour({ data, onChange, darkMode }) {
  const labourCost = data.labourCost ?? "";
  const items = data.items || [];
  const isDark = darkMode;
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const inputBg = isDark ? "#2A2A2A" : "#FFFFFF";
  const cardBg = isDark ? "#1A1A1A" : "#F5F0EE";

  const totals = calculateTotals({ items, labourCost: parseFloat(labourCost) || 0 });

  return (
    <div>
      <div
        style={{
          background: cardBg,
          borderRadius: 12,
          padding: "20px",
          marginBottom: 20,
          border: `1px solid ${border}`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#F5E6E6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
          }}
        >
          <Wrench size={24} color="#661F1F" />
        </div>
        <div style={{ fontSize: 14, color: textSecondary, marginBottom: 16 }}>
          Enter labour / installation charges as a separate line item on the invoice.
          Set to ₹0 if no labour charges apply.
        </div>

        {/* Labour input */}
        <div style={{ position: "relative", maxWidth: 240, margin: "0 auto 16px" }}>
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 18,
              color: "#661F1F",
              fontWeight: 700,
              pointerEvents: "none",
            }}
          >
            ₹
          </span>
          <input
            type="number"
            min={0}
            step={50}
            value={labourCost}
            onChange={(e) => onChange({ labourCost: e.target.value })}
            placeholder="0"
            style={{
              width: "100%",
              padding: "14px 14px 14px 36px",
              border: `2px solid ${labourCost ? "#661F1F" : border}`,
              borderRadius: 10,
              fontSize: 22,
              fontWeight: 700,
              color: textPrimary,
              background: inputBg,
              outline: "none",
              textAlign: "right",
              fontFamily: "'Courier New', monospace",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
            onBlur={(e) =>
              (e.target.style.borderColor = labourCost ? "#661F1F" : border)
            }
          />
        </div>

        {/* Quick-pick buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 4 }}>
          <button
            onClick={() => onChange({ labourCost: "0" })}
            style={{
              padding: "5px 12px",
              borderRadius: 99,
              border: `1px solid ${labourCost == 0 ? "#661F1F" : border}`,
              background: labourCost == 0 ? "#F5E6E6" : "none",
              color: labourCost == 0 ? "#661F1F" : textSecondary,
              fontSize: 12,
              cursor: "pointer",
              fontWeight: labourCost == 0 ? 700 : 400,
            }}
          >
            No Labour
          </button>
          {COMMON_LABOUR.map((val) => (
            <button
              key={val}
              onClick={() => onChange({ labourCost: String(val) })}
              style={{
                padding: "5px 12px",
                borderRadius: 99,
                border: `1px solid ${parseFloat(labourCost) === val ? "#661F1F" : border}`,
                background: parseFloat(labourCost) === val ? "#F5E6E6" : "none",
                color: parseFloat(labourCost) === val ? "#661F1F" : textSecondary,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: parseFloat(labourCost) === val ? 700 : 400,
              }}
            >
              ₹{val.toLocaleString("en-IN")}
            </button>
          ))}
        </div>
      </div>

      {/* Running total preview */}
      <div
        style={{
          background: isDark ? "#2A2A2A" : "#FFFFFF",
          border: `1.5px solid ${border}`,
          borderRadius: 10,
          padding: "14px 16px",
        }}
      >
        <div style={{ fontSize: 12, color: textSecondary, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Running Total Preview
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: textSecondary }}>
              Items ({items.length})
            </span>
            <span style={{ fontSize: 13, color: textPrimary, fontFamily: "'Courier New', monospace" }}>
              {formatCurrency(totals.itemsTotal)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: textSecondary }}>Labour</span>
            <span style={{ fontSize: 13, color: textPrimary, fontFamily: "'Courier New', monospace" }}>
              {formatCurrency(parseFloat(labourCost) || 0)}
            </span>
          </div>
          <div
            style={{
              borderTop: `1px solid ${border}`,
              paddingTop: 8,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>
              Subtotal (before GST)
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#661F1F",
                fontFamily: "'Courier New', monospace",
              }}
            >
              {formatCurrency(totals.subtotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
