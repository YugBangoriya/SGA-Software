// SGA — Last updated: Restored original inline edit panel; computeTotalPaid replaces inv.amountPaid in totalOutstanding, balanceDue, card Paid display, and openEdit init; totalPaid added to handleSave updates; Payment Breakdown section with inline AddPaymentEntryModal added below Save button
// ============================================================
// PendingPayments.jsx — Pending Payments Dashboard (Owner / SuperAdmin)
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useEffect, useState } from "react";
import { useNavigate }         from "react-router-dom";
import {
  ArrowLeft, CreditCard, Check, AlertCircle, Calendar, ChevronDown, ChevronUp,
} from "lucide-react";
import useInvoiceStore  from "../../store/invoiceStore";
import useAuthStore     from "../../store/authStore";
import useThemeStore    from "../../store/themeStore";
import AddPaymentEntryModal from "../../components/invoices/AddPaymentEntryModal";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  requiresLoanFields,
  derivePaymentStatus,
  formatCurrency,
  computeTotalPaid,
} from "../../lib/invoiceHelpers";

export default function PendingPayments() {
  const navigate = useNavigate();

  const { firebaseUser: currentUser, role } = useAuthStore();
  const { theme } = useThemeStore();
  const {
    pendingPaymentInvoices,
    subscribeInvoices,
    updatePaymentStatus,
    dbLocked,
    subscribeSystemConfig,
  } = useInvoiceStore();

  const isDark = theme === "dark";
  const isOwnerOrAbove = ["owner", "superadmin"].includes(role);

  const bg            = isDark ? "#1A1A1A" : "#CDCBC9";
  const cardBg        = isDark ? "#2A2A2A" : "#FFFFFF";
  const border        = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary   = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const inputBg       = isDark ? "#2A2A2A" : "#FFFFFF";
  const sectionBg     = isDark ? "#1A1A1A" : "#F5F0EE";

  // ── Local state ──────────────────────────────────────────
  const [expandedId, setExpandedId]   = useState(null);
  const [editState,  setEditState]    = useState({});
  const [savingId,   setSavingId]     = useState(null);
  const [saveErrors, setSaveErrors]   = useState({});
  const [saved,      setSaved]        = useState({});

  // Which invoice's AddPaymentEntryModal is open (inline mode)
  const [showEntryModalId, setShowEntryModalId] = useState(null);

  useEffect(() => {
    subscribeSystemConfig();
    subscribeInvoices();
  }, []);

  if (!isOwnerOrAbove) {
    navigate("/unauthorized");
    return null;
  }

  // ── Summary ──────────────────────────────────────────────
  // computeTotalPaid is backward-compat: reads from paymentEntries[] if present,
  // falls back to inv.amountPaid for legacy invoices.
  const totalOutstanding = pendingPaymentInvoices.reduce((sum, inv) => {
    return sum + Math.max(0, (inv.totalAmount || 0) - computeTotalPaid(inv));
  }, 0);

  // ── Edit helpers ─────────────────────────────────────────
  const openEdit = (inv) => {
    setEditState((prev) => ({
      ...prev,
      [inv.id]: {
        paymentMethod:      inv.paymentMethod      || "CASH",
        // Use computeTotalPaid so the field shows the actual amount paid
        // (which may be higher than inv.amountPaid if additional entries exist)
        amountPaid:         computeTotalPaid(inv),
        loanProvider:       inv.loanProvider       || "",
        emiAmount:          inv.emiAmount           || "",
        loanCompletionDate: inv.loanCompletionDate  || "",
        paymentNote:        inv.paymentNote         || "",
      },
    }));
    setExpandedId(inv.id);
    // Close any open entry modal when switching invoices
    setShowEntryModalId(null);
  };

  const closeEdit = (invId) => {
    setExpandedId(null);
    setSaveErrors((prev) => { const n = { ...prev }; delete n[invId]; return n; });
    setSaved((prev) => { const n = { ...prev }; delete n[invId]; return n; });
    setShowEntryModalId(null);
  };

  const updateEdit = (invId, field, value) => {
    setEditState((prev) => ({
      ...prev,
      [invId]: { ...prev[invId], [field]: value },
    }));
  };

  // ── Save ─────────────────────────────────────────────────
  const handleSave = async (inv) => {
    setSavingId(inv.id);
    const edit = editState[inv.id];
    if (!edit) { setSavingId(null); return; }

    const newAmountPaid = parseFloat(edit.amountPaid) || 0;
    const newStatus = derivePaymentStatus(
      edit.paymentMethod,
      newAmountPaid,
      inv.totalAmount || 0
    );

    try {
      await updatePaymentStatus(
        inv.id,
        {
          paymentMethod:      edit.paymentMethod,
          amountPaid:         newAmountPaid,
          paymentStatus:      newStatus,
          loanProvider:       edit.loanProvider       || null,
          emiAmount:          edit.emiAmount ? parseFloat(edit.emiAmount) : null,
          loanCompletionDate: edit.loanCompletionDate || null,
          paymentNote:        edit.paymentNote        || null,
          // Write totalPaid for the new multi-entry schema
          totalPaid:          newAmountPaid,
        },
        currentUser
      );
      setSaved((prev) => ({ ...prev, [inv.id]: true }));
      setSaveErrors((prev) => { const n = { ...prev }; delete n[inv.id]; return n; });
      setTimeout(() => {
        setSaved((prev) => { const n = { ...prev }; delete n[inv.id]; return n; });
        closeEdit(inv.id);
      }, 1400);
    } catch (err) {
      setSaveErrors((prev) => ({ ...prev, [inv.id]: err.message || "Save failed." }));
    } finally {
      setSavingId(null);
    }
  };

  // ── Style helpers ─────────────────────────────────────────
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
    fontSize: 11,
    fontWeight: 600,
    color: textSecondary,
    display: "block",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily: "Arial, sans-serif",
  };

  const fieldGroup = { marginBottom: 12 };

  return (
    <div style={{ minHeight: "100vh", background: bg, paddingBottom: 60 }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div
        style={{
          background: "#661F1F",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: 8,
            padding: 6,
            cursor: "pointer",
            color: "#FFFFFF",
            display: "flex",
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700 }}>
            Pending Payments
          </div>
          <div style={{ color: "rgba(255,220,200,0.8)", fontSize: 11, marginTop: 1, fontFamily: "Arial, sans-serif" }}>
            {pendingPaymentInvoices.length} invoice{pendingPaymentInvoices.length !== 1 ? "s" : ""} with outstanding balance
          </div>
        </div>
      </div>

      <div style={{ padding: "16px", maxWidth: 680, margin: "0 auto" }}>

        {/* ── Summary card ──────────────────────────────────── */}
        <div
          style={{
            background: "#F5E6E6",
            border: "1.5px solid #E8C8C8",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#661F1F", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Arial, sans-serif" }}>
              Total Outstanding
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "#661F1F",
                fontFamily: "'Courier New', monospace",
                marginTop: 2,
              }}
            >
              {formatCurrency(totalOutstanding)}
            </div>
          </div>
          <AlertCircle size={32} color="#CC0000" style={{ opacity: 0.35 }} />
        </div>

        {/* ── DB locked warning ─────────────────────────────── */}
        {dbLocked && (
          <div
            style={{
              background: "#FFEBEE",
              border: "1.5px solid #FFCDD2",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 16,
              fontSize: 13,
              color: "#CC0000",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <AlertCircle size={16} />
            Invoice database is locked. Payment updates are temporarily disabled.
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────── */}
        {pendingPaymentInvoices.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              background: cardBg,
              borderRadius: 14,
              border: `1px solid ${border}`,
            }}
          >
            <Check size={40} color="#1A7A1A" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: textPrimary, marginBottom: 6 }}>
              All cleared!
            </div>
            <div style={{ fontSize: 13, color: textSecondary }}>
              No invoices with pending or partial payments.
            </div>
          </div>
        )}

        {/* ── Invoice cards ─────────────────────────────────── */}
        {pendingPaymentInvoices.map((inv) => {
          const isExpanded = expandedId === inv.id;
          const edit       = editState[inv.id] || {};
          const isSaving   = savingId === inv.id;
          const isSaved    = saved[inv.id];
          const saveError  = saveErrors[inv.id];

          // Use computeTotalPaid to get the actual total paid (from entries or legacy field)
          const actualTotalPaid = computeTotalPaid(inv);
          const balanceDue = Math.max(0, (inv.totalAmount || 0) - actualTotalPaid);

          const statusColor =
            inv.paymentStatus === "PARTIALLY PAID" ? "#CC6600"
            : inv.paymentStatus === "EMI"          ? "#0055CC"
            : inv.paymentStatus === "LOAN"         ? "#0055CC"
            : "#CC0000";

          const statusBg =
            inv.paymentStatus === "PARTIALLY PAID" ? "#FFF3E0"
            : inv.paymentStatus === "EMI"          ? "#E3F2FD"
            : inv.paymentStatus === "LOAN"         ? "#E3F2FD"
            : "#FFEBEE";

          return (
            <div
              key={inv.id}
              style={{
                background: cardBg,
                border: `1.5px solid ${isExpanded ? "#661F1F" : border}`,
                borderRadius: 14,
                marginBottom: 14,
                overflow: "hidden",
                transition: "border-color 0.2s",
                boxShadow: isExpanded ? "0 4px 16px rgba(102,31,31,0.12)" : "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              {/* ── Card header ───────────────────────── */}
              <div
                style={{ padding: "14px 16px", cursor: "pointer" }}
                onClick={() => isExpanded ? closeEdit(inv.id) : openEdit(inv)}
              >
                {/* Top row: invoice no + status badge + chevron */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#661F1F",
                        fontFamily: "'Courier New', monospace",
                      }}
                    >
                      {inv.invoiceNo || inv.id}
                    </div>
                    <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
                      {inv.customerSnapshot?.name || "Unknown Customer"}
                    </div>
                    {inv.customerSnapshot?.phone && (
                      <div style={{ fontSize: 11, color: textSecondary, marginTop: 1 }}>
                        {inv.customerSnapshot.phone}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        background: statusBg,
                        color: statusColor,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 99,
                        border: `1px solid ${statusColor}33`,
                        fontFamily: "Arial, sans-serif",
                        letterSpacing: 0.3,
                      }}
                    >
                      {inv.paymentStatus}
                    </span>
                    {isExpanded
                      ? <ChevronUp size={16} color={textSecondary} />
                      : <ChevronDown size={16} color={textSecondary} />
                    }
                  </div>
                </div>

                {/* Amount row: total / paid / due */}
                <div style={{ display: "flex", gap: 0 }}>
                  {[
                    {
                      label: "Total",
                      value: formatCurrency(inv.totalAmount || 0),
                      color: textPrimary,
                    },
                    {
                      label: "Paid",
                      value: formatCurrency(actualTotalPaid),
                      color: "#1A7A1A",
                    },
                    {
                      label: "Due",
                      value: formatCurrency(balanceDue),
                      color: "#CC0000",
                    },
                  ].map(({ label, value, color }, idx, arr) => (
                    <div
                      key={label}
                      style={{
                        flex: 1,
                        paddingRight: idx < arr.length - 1 ? 8 : 0,
                        borderRight: idx < arr.length - 1 ? `1px solid ${border}` : "none",
                        marginRight: idx < arr.length - 1 ? 8 : 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: textSecondary,
                          fontFamily: "Arial, sans-serif",
                          textTransform: "uppercase",
                          letterSpacing: 0.3,
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color,
                          fontFamily: "'Courier New', monospace",
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Date + method row */}
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={12} color={textSecondary} />
                    <span style={{ fontSize: 11, color: textSecondary }}>
                      {inv.invoiceDate
                        ? new Date(inv.invoiceDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <CreditCard size={12} color={textSecondary} />
                    <span style={{ fontSize: 11, color: textSecondary }}>
                      {inv.paymentMethod || "—"}
                    </span>
                  </div>
                  {inv.loanCompletionDate && (
                    <div style={{ fontSize: 11, color: "#CC6600" }}>
                      Due:{" "}
                      {new Date(inv.loanCompletionDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Expanded edit panel ───────────────── */}
              {isExpanded && edit && (
                <div
                  style={{
                    borderTop: `1.5px solid #661F1F`,
                    padding: "16px",
                    background: sectionBg,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#661F1F",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      marginBottom: 14,
                      fontFamily: "Arial, sans-serif",
                    }}
                  >
                    Update Payment
                  </div>

                  {/* Payment method */}
                  <div style={fieldGroup}>
                    <label style={labelStyle}>Payment Method</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => updateEdit(inv.id, "paymentMethod", m.value)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: 7,
                            border: `1.5px solid ${edit.paymentMethod === m.value ? "#661F1F" : border}`,
                            background: edit.paymentMethod === m.value ? "#661F1F" : inputBg,
                            color: edit.paymentMethod === m.value ? "#FFFFFF" : textPrimary,
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
                  </div>

                  {/* Amount paid */}
                  {edit.paymentMethod !== "LOAN" && edit.paymentMethod !== "EMI" && (
                    <div style={fieldGroup}>
                      <label style={labelStyle}>Amount Paid</label>
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
                          max={inv.totalAmount || 0}
                          step={0.01}
                          value={edit.amountPaid}
                          onChange={(e) => updateEdit(inv.id, "amountPaid", e.target.value)}
                          placeholder={`0 – ${inv.totalAmount || 0}`}
                          style={{
                            ...inputStyle,
                            paddingLeft: 28,
                            fontFamily: "'Courier New', monospace",
                          }}
                          onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                          onBlur={(e) => (e.target.style.borderColor = border)}
                        />
                      </div>
                      {/* Quick fill buttons */}
                      <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                        <button
                          onClick={() => updateEdit(inv.id, "amountPaid", 0)}
                          style={{ padding: "3px 9px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer" }}
                        >
                          ₹0
                        </button>
                        <button
                          onClick={() => updateEdit(inv.id, "amountPaid", inv.totalAmount)}
                          style={{ padding: "3px 9px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer" }}
                        >
                          Full ({formatCurrency(inv.totalAmount)})
                        </button>
                        <button
                          onClick={() => updateEdit(inv.id, "amountPaid", balanceDue)}
                          style={{ padding: "3px 9px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer" }}
                        >
                          Balance ({formatCurrency(balanceDue)})
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Loan/EMI fields */}
                  {requiresLoanFields(edit.paymentMethod) && (
                    <div
                      style={{
                        background: "#E3F2FD",
                        border: "1.5px solid #90CAF9",
                        borderRadius: 10,
                        padding: "12px",
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0055CC", marginBottom: 10 }}>
                        {edit.paymentMethod === "EMI" ? "EMI Details" : "Loan Details"}
                      </div>
                      <div style={fieldGroup}>
                        <label style={{ ...labelStyle, color: "#0055CC" }}>Provider</label>
                        <input
                          placeholder="e.g. HDFC Bank, Bajaj Finance…"
                          value={edit.loanProvider || ""}
                          onChange={(e) => updateEdit(inv.id, "loanProvider", e.target.value)}
                          style={{ ...inputStyle, borderColor: "#90CAF9" }}
                          onFocus={(e) => (e.target.style.borderColor = "#0055CC")}
                          onBlur={(e) => (e.target.style.borderColor = "#90CAF9")}
                        />
                      </div>
                      {edit.paymentMethod === "EMI" && (
                        <div style={fieldGroup}>
                          <label style={{ ...labelStyle, color: "#0055CC" }}>EMI Amount / Month</label>
                          <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#0055CC", fontWeight: 700, pointerEvents: "none" }}>₹</span>
                            <input
                              type="number"
                              min={0}
                              step={100}
                              value={edit.emiAmount || ""}
                              onChange={(e) => updateEdit(inv.id, "emiAmount", e.target.value)}
                              style={{ ...inputStyle, paddingLeft: 28, borderColor: "#90CAF9", fontFamily: "'Courier New', monospace" }}
                              onFocus={(e) => (e.target.style.borderColor = "#0055CC")}
                              onBlur={(e) => (e.target.style.borderColor = "#90CAF9")}
                            />
                          </div>
                        </div>
                      )}
                      <div style={fieldGroup}>
                        <label style={{ ...labelStyle, color: "#0055CC" }}>Expected Completion</label>
                        <input
                          type="date"
                          value={edit.loanCompletionDate || ""}
                          onChange={(e) => updateEdit(inv.id, "loanCompletionDate", e.target.value)}
                          style={{ ...inputStyle, borderColor: "#90CAF9" }}
                          onFocus={(e) => (e.target.style.borderColor = "#0055CC")}
                          onBlur={(e) => (e.target.style.borderColor = "#90CAF9")}
                        />
                      </div>
                    </div>
                  )}

                  {/* Balance due (live) */}
                  {edit.paymentMethod !== "LOAN" && edit.paymentMethod !== "EMI" && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "9px 12px",
                        background:
                          Math.max(0, (inv.totalAmount || 0) - (parseFloat(edit.amountPaid) || 0)) > 0
                            ? (isDark ? "#2A1A1A" : "#FFEBEE")
                            : (isDark ? "#1A2A1A" : "#E8F5E9"),
                        borderRadius: 8,
                        marginBottom: 12,
                        border: `1px solid ${
                          Math.max(0, (inv.totalAmount || 0) - (parseFloat(edit.amountPaid) || 0)) > 0
                            ? "#FFCDD2"
                            : "#C8E6C9"
                        }`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color:
                            Math.max(0, (inv.totalAmount || 0) - (parseFloat(edit.amountPaid) || 0)) > 0
                              ? "#CC0000"
                              : "#1A7A1A",
                        }}
                      >
                        Updated Balance Due
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color:
                            Math.max(0, (inv.totalAmount || 0) - (parseFloat(edit.amountPaid) || 0)) > 0
                              ? "#CC0000"
                              : "#1A7A1A",
                          fontFamily: "'Courier New', monospace",
                        }}
                      >
                        {formatCurrency(
                          Math.max(0, (inv.totalAmount || 0) - (parseFloat(edit.amountPaid) || 0))
                        )}
                      </span>
                    </div>
                  )}

                  {/* Payment note */}
                  <div style={fieldGroup}>
                    <label style={labelStyle}>Payment Note (optional)</label>
                    <input
                      placeholder="e.g. Remaining balance collected via UPI…"
                      value={edit.paymentNote || ""}
                      onChange={(e) => updateEdit(inv.id, "paymentNote", e.target.value)}
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                      onBlur={(e) => (e.target.style.borderColor = border)}
                    />
                  </div>

                  {/* Error */}
                  {saveError && (
                    <div
                      style={{
                        background: "#FFEBEE",
                        border: "1px solid #FFCDD2",
                        borderRadius: 8,
                        padding: "8px 12px",
                        marginBottom: 10,
                        fontSize: 12,
                        color: "#CC0000",
                      }}
                    >
                      ⚠ {saveError}
                    </div>
                  )}

                  {/* Save / Cancel */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => closeEdit(inv.id)}
                      style={{
                        flex: 1,
                        padding: "10px 0",
                        background: "none",
                        border: `1.5px solid ${border}`,
                        borderRadius: 10,
                        color: textPrimary,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSave(inv)}
                      disabled={isSaving || dbLocked}
                      style={{
                        flex: 2,
                        padding: "10px 0",
                        background: isSaved ? "#1A7A1A" : isSaving ? "#888" : "#661F1F",
                        border: "none",
                        borderRadius: 10,
                        color: "#FFFFFF",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: isSaving || dbLocked ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        fontFamily: "inherit",
                        transition: "background 0.2s",
                      }}
                    >
                      {isSaved ? (
                        <><Check size={15} /> Saved!</>
                      ) : isSaving ? (
                        "Saving…"
                      ) : (
                        <><Check size={15} /> Save Payment Update</>
                      )}
                    </button>
                  </div>

                  {/* ── Payment Breakdown (if entries exist) ─── */}
                  {Array.isArray(inv.paymentEntries) && inv.paymentEntries.length > 0 && (
                    <>
                      <div
                        style={{
                          height: 1,
                          background: border,
                          margin: "14px 0 12px",
                        }}
                      />
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: textSecondary,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                          fontFamily: "Arial, sans-serif",
                          marginBottom: 8,
                        }}
                      >
                        Payment Breakdown
                      </div>
                      {inv.paymentEntries.map((entry, idx) => (
                        <div
                          key={entry.id || idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "5px 0",
                            borderBottom:
                              idx < inv.paymentEntries.length - 1
                                ? `1px solid ${border}`
                                : "none",
                          }}
                        >
                          <span style={{ fontSize: 12, color: textPrimary }}>
                            {PAYMENT_METHOD_LABELS[entry.method] || entry.method}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#1A7A1A",
                              fontFamily: "'Courier New', monospace",
                            }}
                          >
                            {formatCurrency(entry.amount)}
                          </span>
                        </div>
                      ))}

                      <button
                        onClick={() => setShowEntryModalId(inv.id)}
                        style={{
                          marginTop: 10,
                          padding: "7px 14px",
                          background: "none",
                          border: `1.5px dashed ${border}`,
                          borderRadius: 8,
                          color: "#661F1F",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          width: "100%",
                        }}
                      >
                        + Add Another Payment Method
                      </button>

                      {/* Inline AddPaymentEntryModal */}
                      {showEntryModalId === inv.id && (
                        <AddPaymentEntryModal
                          invoice={inv}
                          inline={true}
                          onClose={() => setShowEntryModalId(null)}
                          onSuccess={() => setShowEntryModalId(null)}
                          darkMode={isDark}
                        />
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Quick view below card (collapsed) ─── */}
              {!isExpanded && (
                <div
                  style={{
                    borderTop: `1px solid ${border}`,
                    padding: "10px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 11, color: textSecondary }}>
                    {inv.invoiceDate
                      ? new Date(inv.invoiceDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : ""}
                    {inv.vehicleSnapshot?.registrationNo
                      ? ` · ${inv.vehicleSnapshot.registrationNo}`
                      : ""}
                  </div>
                  <button
                    onClick={() => openEdit(inv)}
                    disabled={dbLocked}
                    style={{
                      padding: "6px 14px",
                      background: dbLocked ? (isDark ? "#333" : "#E0D8D4") : "#661F1F",
                      border: "none",
                      borderRadius: 8,
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: dbLocked ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Update Payment
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}