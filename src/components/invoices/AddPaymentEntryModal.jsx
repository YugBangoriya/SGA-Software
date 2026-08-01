// SGA — Last updated: New file — AddPaymentEntryModal for multi-method payment support; records a discrete payment entry against an approved invoice
// ============================================================
// AddPaymentEntryModal.jsx — Record a payment entry on an approved invoice
// Phase 4 — Shree Ganesh Automobile
// ============================================================
//
// Used from:
//   - InvoiceDetail.jsx  (primary surface — "Record Payment" button)
//   - PendingPayments.jsx (inline payment recording in the expandable card)
//
// On save: calls invoiceStore.addPaymentEntry() which appends to
// paymentEntries[], recomputes totalPaid, and re-derives paymentStatus
// atomically in Firestore.

import { useState } from "react";
import { X, Check, Calendar } from "lucide-react";
import useInvoiceStore from "../../store/invoiceStore";
import useAuthStore    from "../../store/authStore";
import {
  ENTRY_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  formatCurrency,
  buildPaymentEntry,
} from "../../lib/invoiceHelpers";

export default function AddPaymentEntryModal({
  invoice,
  balanceDue,
  onClose,
  onSuccess,
  darkMode = false,
  inline = false,   // true = render as an inline card (PendingPayments), false = modal overlay
}) {
  const { firebaseUser: currentUser } = useAuthStore();
  const { addPaymentEntry } = useInvoiceStore();

  const isDark = darkMode;
  const border      = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const inputBg     = isDark ? "#2A2A2A" : "#FFFFFF";
  const cardBg      = isDark ? "#2A2A2A" : "#FFFFFF";

  const todayStr = new Date().toISOString().split("T")[0];

  const [amount,    setAmount]    = useState("");
  const [method,    setMethod]    = useState("CASH");
  const [date,      setDate]      = useState(todayStr);
  const [reference, setReference] = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState(null);

  const amountNum  = parseFloat(amount || 0);
  const remaining  = parseFloat(balanceDue || 0);
  const isOverpay  = amountNum > remaining + 0.01;
  const canSave    = amountNum > 0 && !isOverpay && !saving;

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

  const handleSave = async () => {
    if (!canSave || !currentUser) return;
    setSaving(true);
    setError(null);

    try {
      const entry = buildPaymentEntry({
        amount:      amountNum,
        method,
        date,
        reference,
        currentUser,
      });
      await addPaymentEntry(invoice.id, entry, currentUser);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to record payment. Please try again.");
      setSaving(false);
    }
  };

  const body = (
    <div style={{ padding: inline ? "0" : "24px 22px" }}>
      {!inline && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: 0 }}>
              Record Payment
            </h3>
            <div style={{ fontSize: 12, color: textSecondary, marginTop: 3 }}>
              {invoice.invoiceNo} · Balance: {formatCurrency(remaining)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, padding: 4, display: "flex" }}
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Amount */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>
          Amount *
          {remaining > 0 && (
            <span style={{ marginLeft: 6, fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#888" }}>
              (max {formatCurrency(remaining)})
            </span>
          )}
        </label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#661F1F", fontWeight: 700, pointerEvents: "none" }}>
            ₹
          </span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`0.00 – ${remaining.toFixed(2)}`}
            style={{ ...inputStyle, paddingLeft: 28, fontFamily: "'Courier New', monospace", borderColor: isOverpay ? "#CC0000" : border }}
            onFocus={(e) => { if (!isOverpay) e.target.style.borderColor = "#661F1F"; }}
            onBlur={(e)  => { e.target.style.borderColor = isOverpay ? "#CC0000" : border; }}
          />
        </div>
        {isOverpay && (
          <div style={{ fontSize: 11, color: "#CC0000", marginTop: 4 }}>
            ⚠ Amount exceeds remaining balance of {formatCurrency(remaining)}.
          </div>
        )}
        {/* Quick-fill buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setAmount(String(remaining))}
            style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: "#661F1F", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
          >
            Full ({formatCurrency(remaining)})
          </button>
          {remaining > 0 && (
            <button
              onClick={() => setAmount(String(Math.round(remaining / 2)))}
              style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
            >
              50% ({formatCurrency(remaining / 2)})
            </button>
          )}
        </div>
      </div>

      {/* Payment Method */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Payment Method *</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ENTRY_PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMethod(m.value)}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: `1.5px solid ${method === m.value ? "#661F1F" : border}`,
                background: method === m.value ? "#661F1F" : inputBg,
                color: method === m.value ? "#FFFFFF" : textPrimary,
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

      {/* Payment Date */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Payment Date *</label>
        <div style={{ position: "relative" }}>
          <Calendar size={14} color="#888" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 32 }}
            onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
            onBlur={(e)  => (e.target.style.borderColor = border)}
          />
        </div>
        {date !== todayStr && (
          <div style={{ fontSize: 11, color: "#CC6600", marginTop: 4 }}>
            ⚠ Back-dated payment — date differs from today.
          </div>
        )}
      </div>

      {/* Reference / Note */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Reference / Note (optional)</label>
        <input
          placeholder={
            method === "UPI"  ? "e.g. UPI ref: 1234567890" :
            method === "CARD" ? "e.g. Card last 4 digits" :
            method === "BANK_TRANSFER" ? "e.g. NEFT ref or account no." :
            "e.g. Cash received in hand"
          }
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
          onBlur={(e)  => (e.target.style.borderColor = border)}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#FFEBEE", border: "1px solid #FFCDD2", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#CC0000", fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* Preview */}
      {amountNum > 0 && !isOverpay && (
        <div style={{ background: isDark ? "#1A2A1A" : "#E8F5E9", border: "1px solid #C8E6C9", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#1A7A1A", fontWeight: 700 }}>Payment Summary</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
              {PAYMENT_METHOD_LABELS[method]} · {date}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1A7A1A", fontFamily: "'Courier New', monospace" }}>
              {formatCurrency(amountNum)}
            </div>
            <div style={{ fontSize: 11, color: "#888" }}>
              Remaining after: {formatCurrency(Math.max(0, remaining - amountNum))}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: "11px 0", background: "none",
            border: `1.5px solid ${border}`, borderRadius: 10,
            color: textPrimary, fontWeight: 600, fontSize: 13,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            flex: 2, padding: "11px 0",
            background: canSave ? "#1A7A1A" : (isDark ? "#333" : "#CCC"),
            border: "none", borderRadius: 10,
            color: "#FFFFFF", fontWeight: 700, fontSize: 13,
            cursor: canSave ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, fontFamily: "inherit",
          }}
        >
          <Check size={15} />
          {saving ? "Recording…" : "Record Payment"}
        </button>
      </div>
    </div>
  );

  if (inline) return body;

  // Full modal overlay
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, padding: "0 0 0 0" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: cardBg,
          borderRadius: "16px 16px 0 0",
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: isDark ? "#555" : "#CCC" }} />
        </div>
        {body}
      </div>
    </div>
  );
}
