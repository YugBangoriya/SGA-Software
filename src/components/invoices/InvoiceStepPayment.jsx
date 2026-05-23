// ============================================================
// InvoiceStepPayment.jsx — Step 4: Payment Details + GST + Date
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useState } from "react";
import { Calendar, Info } from "lucide-react";
import {
  PAYMENT_METHODS,
  requiresLoanFields,
  derivePaymentStatus,
  calculateTotals,
  formatCurrency,
  toISODateString,
} from "../../lib/invoiceHelpers";

const GST_RATE = 0.09;

export default function InvoiceStepPayment({ data, onChange, gstNumber, darkMode }) {
  const isDark = darkMode;
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const inputBg = isDark ? "#2A2A2A" : "#FFFFFF";
  const cardBg = isDark ? "#1A1A1A" : "#F5F0EE";

  const items = data.items || [];
  const labourCost = parseFloat(data.labourCost || 0);
  const gstEnabled = data.gstEnabled || false;
  const paymentMethod = data.paymentMethod || "CASH";
  const amountPaid = data.amountPaid ?? "";
  const invoiceDate = data.invoiceDate || new Date().toISOString().split("T")[0];
  const dueDate = data.dueDate || "";
  const isDateOverridden = data.isDateOverridden || false;
  const todayStr = new Date().toISOString().split("T")[0];

  const baseTotals = calculateTotals({ items, labourCost });
  const subtotal = baseTotals.subtotal;
  const cgst = gstEnabled ? parseFloat((subtotal * GST_RATE).toFixed(2)) : 0;
  const sgst = gstEnabled ? parseFloat((subtotal * GST_RATE).toFixed(2)) : 0;
  const totalAmount = parseFloat((subtotal + cgst + sgst).toFixed(2));
  const balanceDue = Math.max(0, totalAmount - (parseFloat(amountPaid) || 0));
  const paymentStatus = derivePaymentStatus(paymentMethod, amountPaid, totalAmount);

  const handleChange = (field, value) => {
    const updates = { [field]: value };

    if (field === "gstEnabled") {
      const newCgst = value ? parseFloat((subtotal * GST_RATE).toFixed(2)) : 0;
      const newSgst = value ? parseFloat((subtotal * GST_RATE).toFixed(2)) : 0;
      const newTotal = parseFloat((subtotal + newCgst + newSgst).toFixed(2));
      updates.cgst = newCgst;
      updates.sgst = newSgst;
      updates.totalAmount = newTotal;
    }

    if (field === "paymentMethod") {
      updates.amountPaid = "";
      updates.loanProvider = "";
      updates.emiAmount = "";
      updates.loanCompletionDate = "";
    }

    if (field === "invoiceDate") {
      updates.isDateOverridden = value !== todayStr;
    }

    onChange({ ...updates, totalAmount, subtotal, cgst, sgst });
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: `1.5px solid ${border}`,
    borderRadius: 8,
    background: inputBg,
    color: textPrimary,
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: textSecondary,
    display: "block",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily: "Arial, sans-serif",
  };

  const fieldGroup = { marginBottom: 14 };

  return (
    <div>
      {/* ── Invoice Date ────────────────────────────── */}
      <div style={fieldGroup}>
        <label style={labelStyle}>
          Invoice Date
          {isDateOverridden && (
            <span
              style={{
                marginLeft: 8,
                background: "#FFF3E0",
                color: "#CC6600",
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 99,
                fontWeight: 700,
                border: "1px solid #FFB74D",
              }}
            >
              M — Manually Changed
            </span>
          )}
        </label>
        <div style={{ position: "relative" }}>
          <Calendar
            size={15}
            color={isDateOverridden ? "#CC6600" : "#888"}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          />
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => handleChange("invoiceDate", e.target.value)}
            style={{
              ...inputStyle,
              paddingLeft: 34,
              borderColor: isDateOverridden ? "#CC6600" : border,
              color: isDateOverridden ? "#CC6600" : textPrimary,
              fontWeight: isDateOverridden ? 600 : 400,
            }}
            onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
            onBlur={(e) =>
              (e.target.style.borderColor = isDateOverridden ? "#CC6600" : border)
            }
          />
        </div>
        {isDateOverridden && (
          <div style={{ fontSize: 11, color: "#CC6600", marginTop: 4 }}>
            ⚠ Date differs from today — will be highlighted in all list views.
          </div>
        )}
      </div>

      {/* ── Due Date ────────────────────────────────── */}
      <div style={fieldGroup}>
        <label style={labelStyle}>Due Date (optional)</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => onChange({ dueDate: e.target.value })}
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
          onBlur={(e) => (e.target.style.borderColor = border)}
        />
      </div>

      {/* ── GST Toggle (only if GSTIN is set) ──────── */}
      {gstNumber ? (
        <div
          style={{
            background: gstEnabled ? "#F0FAF0" : cardBg,
            border: `1.5px solid ${gstEnabled ? "#4CAF50" : border}`,
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
                Include GST
              </div>
              <div style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                GSTIN: {gstNumber} · CGST 9% + SGST 9% = 18%
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 8 }}>
              <div
                onClick={() => handleChange("gstEnabled", !gstEnabled)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: gstEnabled ? "#1A7A1A" : isDark ? "#555" : "#CCC",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#FFFFFF",
                    position: "absolute",
                    top: 3,
                    left: gstEnabled ? 23 : 3,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
            </label>
          </div>
          {gstEnabled && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid #C8E6C9`, display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "#666" }}>CGST (9%)</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1A7A1A", fontFamily: "'Courier New', monospace" }}>
                  {formatCurrency(cgst)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#666" }}>SGST (9%)</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1A7A1A", fontFamily: "'Courier New', monospace" }}>
                  {formatCurrency(sgst)}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            background: cardBg,
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <Info size={14} color="#888" />
          <span style={{ fontSize: 12, color: textSecondary }}>
            GST not applicable — no GSTIN configured in Settings.
          </span>
        </div>
      )}

      {/* ── Total so far ────────────────────────────── */}
      <div
        style={{
          background: "#F5E6E6",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          border: "1px solid #E8C8C8",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "#661F1F" }}>
          Invoice Total
        </span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#661F1F",
            fontFamily: "'Courier New', monospace",
          }}
        >
          {formatCurrency(totalAmount)}
        </span>
      </div>

      {/* ── Payment Method ──────────────────────────── */}
      <div style={fieldGroup}>
        <label style={labelStyle}>Payment Method *</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              onClick={() => handleChange("paymentMethod", m.value)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1.5px solid ${paymentMethod === m.value ? "#661F1F" : border}`,
                background: paymentMethod === m.value ? "#661F1F" : inputBg,
                color: paymentMethod === m.value ? "#FFFFFF" : textPrimary,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Amount Paid ─────────────────────────────── */}
      {paymentMethod !== "LOAN" && paymentMethod !== "EMI" && (
        <div style={fieldGroup}>
          <label style={labelStyle}>Amount Paid *</label>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 16,
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
              max={totalAmount}
              step={0.01}
              value={amountPaid}
              onChange={(e) => onChange({ amountPaid: e.target.value })}
              placeholder={`0 – ${totalAmount}`}
              style={{ ...inputStyle, paddingLeft: 28, fontFamily: "'Courier New', monospace" }}
              onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
              onBlur={(e) => (e.target.style.borderColor = border)}
            />
          </div>
          {/* Quick fill buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => onChange({ amountPaid: "0" })}
              style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer" }}
            >
              ₹0
            </button>
            <button
              onClick={() => onChange({ amountPaid: String(Math.round(totalAmount / 2)) })}
              style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer" }}
            >
              50% ({formatCurrency(totalAmount / 2)})
            </button>
            <button
              onClick={() => onChange({ amountPaid: String(totalAmount) })}
              style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer" }}
            >
              Full ({formatCurrency(totalAmount)})
            </button>
          </div>
        </div>
      )}

      {/* ── Loan/EMI fields ─────────────────────────── */}
      {requiresLoanFields(paymentMethod) && (
        <div
          style={{
            background: "#E3F2FD",
            border: "1.5px solid #90CAF9",
            borderRadius: 10,
            padding: "14px",
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0055CC", marginBottom: 12 }}>
            {paymentMethod === "EMI" ? "EMI Details" : "Loan Details"}
          </div>
          <div style={fieldGroup}>
            <label style={{ ...labelStyle, color: "#0055CC" }}>Loan / Finance Provider *</label>
            <input
              placeholder="e.g. HDFC Bank, Bajaj Finance..."
              value={data.loanProvider || ""}
              onChange={(e) => onChange({ loanProvider: e.target.value })}
              style={{ ...inputStyle, borderColor: "#90CAF9" }}
              onFocus={(e) => (e.target.style.borderColor = "#0055CC")}
              onBlur={(e) => (e.target.style.borderColor = "#90CAF9")}
            />
          </div>
          {paymentMethod === "EMI" && (
            <div style={fieldGroup}>
              <label style={{ ...labelStyle, color: "#0055CC" }}>EMI Amount / Month *</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#0055CC", fontWeight: 700, pointerEvents: "none" }}>₹</span>
                <input
                  type="number" min={0} step={100}
                  placeholder="Monthly EMI"
                  value={data.emiAmount || ""}
                  onChange={(e) => onChange({ emiAmount: e.target.value })}
                  style={{ ...inputStyle, paddingLeft: 28, borderColor: "#90CAF9", fontFamily: "'Courier New', monospace" }}
                  onFocus={(e) => (e.target.style.borderColor = "#0055CC")}
                  onBlur={(e) => (e.target.style.borderColor = "#90CAF9")}
                />
              </div>
            </div>
          )}
          <div style={fieldGroup}>
            <label style={{ ...labelStyle, color: "#0055CC" }}>Expected Completion Date</label>
            <input
              type="date"
              value={data.loanCompletionDate || ""}
              onChange={(e) => onChange({ loanCompletionDate: e.target.value })}
              style={{ ...inputStyle, borderColor: "#90CAF9" }}
              onFocus={(e) => (e.target.style.borderColor = "#0055CC")}
              onBlur={(e) => (e.target.style.borderColor = "#90CAF9")}
            />
          </div>
        </div>
      )}

      {/* ── Balance due summary ─────────────────────── */}
      {paymentMethod !== "LOAN" && paymentMethod !== "EMI" && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: balanceDue > 0
              ? (isDark ? "#2A1A1A" : "#FFEBEE")
              : (isDark ? "#1A2A1A" : "#E8F5E9"),
            borderRadius: 8,
            border: `1px solid ${balanceDue > 0 ? "#FFCDD2" : "#C8E6C9"}`,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: balanceDue > 0 ? "#CC0000" : "#1A7A1A",
            }}
          >
            Balance Due
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: balanceDue > 0 ? "#CC0000" : "#1A7A1A",
              fontFamily: "'Courier New', monospace",
            }}
          >
            {formatCurrency(balanceDue)}
          </span>
        </div>
      )}

      {/* ── Payment note ─────────────────────────────── */}
      <div style={{ ...fieldGroup, marginTop: 14 }}>
        <label style={labelStyle}>Payment Note (optional)</label>
        <input
          placeholder="e.g. Cash received, UPI ref: XXXX..."
          value={data.paymentNote || ""}
          onChange={(e) => onChange({ paymentNote: e.target.value })}
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
          onBlur={(e) => (e.target.style.borderColor = border)}
        />
      </div>
    </div>
  );
}
