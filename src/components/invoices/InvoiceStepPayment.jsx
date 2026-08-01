// SGA — Last updated: Restored original labels (Amount Paid, Payment Note); added additionalPaymentEntries inline section below Balance Due row; updated balanceDue to subtract additionalTotal
// ============================================================
// InvoiceStepPayment.jsx — Step 4: Payment Details + GST + Discount + Date
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useState, useEffect } from "react";
import { Calendar, Info, Tag, Check, X } from "lucide-react";
import {
  PAYMENT_METHODS,
  ENTRY_PAYMENT_METHODS,
  requiresLoanFields,
  derivePaymentStatus,
  calculateTotals,
  formatCurrency,
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

  // Discount state — local draft + confirmed
  const [discountDraft, setDiscountDraft] = useState(
    data.discountAmount ? String(data.discountAmount) : ""
  );
  const [discountConfirmed, setDiscountConfirmed] = useState(
    !!(data.discountAmount && data.discountAmount > 0)
  );

  // Additional payment entry local state
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntryMethod, setNewEntryMethod] = useState("CASH");
  const [newEntryAmount, setNewEntryAmount] = useState("");
  const [newEntryRef, setNewEntryRef] = useState("");

  // Recompute totals with current discount
  const baseTotals = calculateTotals({ items, labourCost });
  const subtotal = baseTotals.subtotal;
  const cgst = gstEnabled ? parseFloat((subtotal * GST_RATE).toFixed(2)) : 0;
  const sgst = gstEnabled ? parseFloat((subtotal * GST_RATE).toFixed(2)) : 0;
  const preDiscountTotal = parseFloat((subtotal + cgst + sgst).toFixed(2));

  const confirmedDiscount = discountConfirmed ? parseFloat(discountDraft || 0) : 0;
  const totalAmount = parseFloat(Math.max(0, preDiscountTotal - confirmedDiscount).toFixed(2));

  // Additional entries total
  const additionalTotal = (data.additionalPaymentEntries || []).reduce(
    (s, e) => s + parseFloat(e.amount || 0), 0
  );

  // Balance due accounts for primary + additional payments
  const balanceDue = Math.max(0, totalAmount - (parseFloat(amountPaid) || 0) - additionalTotal);
  const paymentStatus = derivePaymentStatus(paymentMethod, amountPaid, totalAmount);

  // ── BUG FIX: Push computed totals to the parent form immediately on mount.
  useEffect(() => {
    const disc = discountConfirmed ? parseFloat(discountDraft || 0) : 0;
    const initialTotal = parseFloat(Math.max(0, preDiscountTotal - disc).toFixed(2));
    onChange({
      subtotal,
      cgst,
      sgst,
      preDiscountTotal,
      discountAmount: disc,
      totalAmount: initialTotal,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty — items and labourCost are frozen by the time
           // the user reaches step 4; this is a one-time push on mount only.

  // Push updated totals including discount to parent form
  const pushTotals = (newDiscount) => {
    const disc = parseFloat(newDiscount || 0);
    const newTotal = parseFloat(Math.max(0, preDiscountTotal - disc).toFixed(2));
    onChange({
      subtotal,
      cgst,
      sgst,
      preDiscountTotal,
      discountAmount: disc,
      totalAmount: newTotal,
    });
  };

  const handleChange = (field, value) => {
    const updates = { [field]: value };

    if (field === "gstEnabled") {
      const newCgst = value ? parseFloat((subtotal * GST_RATE).toFixed(2)) : 0;
      const newSgst = value ? parseFloat((subtotal * GST_RATE).toFixed(2)) : 0;
      const newPreDiscount = parseFloat((subtotal + newCgst + newSgst).toFixed(2));
      const disc = discountConfirmed ? parseFloat(discountDraft || 0) : 0;
      const newTotal = parseFloat(Math.max(0, newPreDiscount - disc).toFixed(2));
      updates.cgst = newCgst;
      updates.sgst = newSgst;
      updates.preDiscountTotal = newPreDiscount;
      updates.discountAmount = disc;
      updates.totalAmount = newTotal;
    }

    if (field === "paymentMethod") {
      // DEBIT: auto-set amount paid to 0 so the user sees the full balance due
      // immediately. They can adjust it if a partial cash payment was also made.
      updates.amountPaid = value === "DEBIT" ? "0" : "";
      updates.loanProvider = "";
      updates.emiAmount = "";
      updates.loanCompletionDate = "";
      // Clear additional entries when switching to LOAN/EMI — they don't apply
      if (value === "LOAN" || value === "EMI") {
        updates.additionalPaymentEntries = [];
      }
    }

    if (field === "invoiceDate") {
      updates.isDateOverridden = value !== todayStr;
    }

    onChange({ ...updates, totalAmount, subtotal, cgst, sgst, preDiscountTotal });
  };

  const handleConfirmDiscount = () => {
    const disc = parseFloat(discountDraft || 0);
    if (isNaN(disc) || disc < 0) return;
    if (disc > preDiscountTotal) {
      alert("Discount cannot be more than the invoice total.");
      return;
    }
    setDiscountConfirmed(true);
    pushTotals(disc);
  };

  const handleRemoveDiscount = () => {
    setDiscountDraft("");
    setDiscountConfirmed(false);
    pushTotals(0);
  };

  // ── Additional entry handlers ────────────────────────────
  const handleAddEntry = () => {
    const amt = parseFloat(newEntryAmount);
    if (!amt || amt <= 0) return;
    const existing = data.additionalPaymentEntries || [];
    onChange({
      additionalPaymentEntries: [
        ...existing,
        { method: newEntryMethod, amount: amt, reference: newEntryRef },
      ],
    });
    setNewEntryAmount("");
    setNewEntryRef("");
    setNewEntryMethod("CASH");
    setShowAddEntry(false);
  };

  const handleRemoveEntry = (idx) => {
    const existing = data.additionalPaymentEntries || [];
    onChange({ additionalPaymentEntries: existing.filter((_, i) => i !== idx) });
  };

  const entryLabel = (method) =>
    ENTRY_PAYMENT_METHODS.find((m) => m.value === method)?.label || method;

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

      {/* ── Invoice Total (before discount) ─────────── */}
      <div
        style={{
          background: "#F5E6E6",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 12,
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
          {formatCurrency(preDiscountTotal)}
        </span>
      </div>

      {/* ── Discount Section ────────────────────────── */}
      <div
        style={{
          background: discountConfirmed
            ? (isDark ? "#1A1A2A" : "#F0F4FF")
            : cardBg,
          border: `1.5px solid ${discountConfirmed ? "#8B3A3A" : border}`,
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Tag size={15} color="#661F1F" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#661F1F" }}>
            Discount (optional)
          </span>
          {discountConfirmed && confirmedDiscount > 0 && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                fontWeight: 700,
                color: "#661F1F",
                background: "#F5E6E6",
                padding: "2px 8px",
                borderRadius: 99,
                border: "1px solid #E8C8C8",
              }}
            >
              - {formatCurrency(confirmedDiscount)}
            </span>
          )}
        </div>

        {!discountConfirmed ? (
          <div>
            <div style={{ fontSize: 12, color: textSecondary, marginBottom: 8 }}>
              Enter the discount amount to offer to this customer. Leave empty for no discount.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
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
                  max={preDiscountTotal}
                  step={1}
                  value={discountDraft}
                  onChange={(e) => setDiscountDraft(e.target.value)}
                  placeholder="0"
                  style={{
                    ...inputStyle,
                    paddingLeft: 28,
                    fontFamily: "'Courier New', monospace",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                  onBlur={(e) => (e.target.style.borderColor = border)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmDiscount();
                  }}
                />
              </div>
              <button
                onClick={handleConfirmDiscount}
                disabled={!discountDraft || parseFloat(discountDraft) <= 0}
                style={{
                  padding: "0 16px",
                  background: discountDraft && parseFloat(discountDraft) > 0 ? "#661F1F" : (isDark ? "#333" : "#E0D8D4"),
                  border: "none",
                  borderRadius: 8,
                  color: discountDraft && parseFloat(discountDraft) > 0 ? "#FFFFFF" : textSecondary,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: discountDraft && parseFloat(discountDraft) > 0 ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  minHeight: 44,
                }}
              >
                <Check size={15} /> Confirm
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: isDark ? "#2A2A2A" : "#FFFFFF",
                borderRadius: 8,
                border: `1px solid #E8C8C8`,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#661F1F" }}>
                  Discount Applied
                </div>
                <div style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                  Customer saves {formatCurrency(confirmedDiscount)}
                </div>
              </div>
              <button
                onClick={handleRemoveDiscount}
                style={{
                  background: "none",
                  border: `1px solid #E8C8C8`,
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  color: textSecondary,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Revised Total (only shown when discount > 0) ─ */}
      {discountConfirmed && confirmedDiscount > 0 && (
        <div
          style={{
            background: isDark ? "#1A2A1A" : "#E8F5E9",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1.5px solid #A5D6A7",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1A7A1A" }}>
            Revised Total
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#1A7A1A",
              fontFamily: "'Courier New', monospace",
            }}
          >
            {formatCurrency(totalAmount)}
          </span>
        </div>
      )}

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

      {/* ── Additional Payment Entries ──────────────── */}
      {paymentMethod !== "LOAN" && paymentMethod !== "EMI" && (
        <div style={{ marginTop: 12 }}>
          {/* List of existing additional entries */}
          {(data.additionalPaymentEntries || []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {(data.additionalPaymentEntries || []).map((entry, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    marginBottom: 6,
                    background: isDark ? "#2A2A2A" : "#FFFFFF",
                    border: `1px solid ${border}`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>
                      {entryLabel(entry.method)}
                    </span>
                    {entry.reference && (
                      <span style={{ fontSize: 11, color: textSecondary }}>
                        · {entry.reference}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1A7A1A",
                        fontFamily: "'Courier New', monospace",
                      }}
                    >
                      {formatCurrency(entry.amount)}
                    </span>
                    <button
                      onClick={() => handleRemoveEntry(idx)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 3,
                        color: "#CC0000",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Toggle: show inline form or "Add Another" button */}
          {!showAddEntry ? (
            <button
              onClick={() => setShowAddEntry(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 14px",
                background: "none",
                border: `1.5px dashed ${border}`,
                borderRadius: 8,
                color: "#661F1F",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                width: "100%",
              }}
            >
              + Add Another Payment Method
            </button>
          ) : (
            <div
              style={{
                background: isDark ? "#1A1A2A" : "#F0F4FF",
                border: "1.5px solid #8B3A3A",
                borderRadius: 10,
                padding: "14px",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#661F1F",
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                Add Another Payment
              </div>

              {/* Method chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {ENTRY_PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setNewEntryMethod(m.value)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 7,
                      border: `1.5px solid ${newEntryMethod === m.value ? "#661F1F" : border}`,
                      background: newEntryMethod === m.value ? "#661F1F" : inputBg,
                      color: newEntryMethod === m.value ? "#FFFFFF" : textPrimary,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div style={{ position: "relative", marginBottom: 8 }}>
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
                  max={balanceDue}
                  step={0.01}
                  value={newEntryAmount}
                  onChange={(e) => setNewEntryAmount(e.target.value)}
                  placeholder={`0 – ${formatCurrency(balanceDue)}`}
                  style={{
                    ...inputStyle,
                    paddingLeft: 28,
                    fontFamily: "'Courier New', monospace",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                  onBlur={(e) => (e.target.style.borderColor = border)}
                />
              </div>

              {/* Reference */}
              <div style={{ marginBottom: 10 }}>
                <input
                  placeholder="Reference / note (optional)"
                  value={newEntryRef}
                  onChange={(e) => setNewEntryRef(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                  onBlur={(e) => (e.target.style.borderColor = border)}
                />
              </div>

              {/* Add / Cancel */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setShowAddEntry(false);
                    setNewEntryAmount("");
                    setNewEntryRef("");
                    setNewEntryMethod("CASH");
                  }}
                  style={{
                    flex: 1,
                    padding: "9px 0",
                    background: "none",
                    border: `1.5px solid ${border}`,
                    borderRadius: 8,
                    color: textPrimary,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEntry}
                  disabled={!newEntryAmount || parseFloat(newEntryAmount) <= 0}
                  style={{
                    flex: 2,
                    padding: "9px 0",
                    background:
                      newEntryAmount && parseFloat(newEntryAmount) > 0
                        ? "#661F1F"
                        : isDark ? "#333" : "#CCC",
                    border: "none",
                    borderRadius: 8,
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor:
                      newEntryAmount && parseFloat(newEntryAmount) > 0
                        ? "pointer"
                        : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  Add Payment
                </button>
              </div>
            </div>
          )}
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