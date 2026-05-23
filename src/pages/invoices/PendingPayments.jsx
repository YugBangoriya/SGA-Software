// ============================================================
// PendingPayments.jsx — Pending Payments Dashboard
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, IndianRupee, Phone, Car, Calendar,
  ChevronRight, RefreshCw, CheckCircle2, AlertTriangle,
} from "lucide-react";
import useInvoiceStore from "../../store/invoiceStore";
import useAuthStore from "../../store/authStore";
import InvoiceStatusBadge from "../../components/invoices/InvoiceStatusBadge";
import DBLockedBanner from "../../components/invoices/DBLockedBanner";
import {
  formatCurrency,
  formatDate,
  PAYMENT_METHODS,
  derivePaymentStatus,
} from "../../lib/invoiceHelpers";

const PENDING_STATUSES = ["UNPAID", "PARTIALLY_PAID", "EMI", "LOAN"];

export default function PendingPayments() {
  const navigate = useNavigate();
  const { currentUser, theme } = useAuthStore();
  const {
    pendingPaymentInvoices,
    dbLocked, dbLockedBy,
    subscribeInvoices, subscribeSystemConfig, loadSettings,
    updatePaymentStatus,
  } = useInvoiceStore();

  const isDark = theme === "dark";
  const bg = isDark ? "#1A1A1A" : "#CDCBC9";
  const cardBg = isDark ? "#2A2A2A" : "#FFFFFF";
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const inputBg = isDark ? "#1A1A1A" : "#F5F0EE";

  // Which card is expanded for editing
  const [expandedId, setExpandedId] = useState(null);
  // Per-card edit state
  const [editState, setEditState] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [successId, setSuccessId] = useState(null);

  useEffect(() => {
    const unsubConfig = subscribeSystemConfig();
    loadSettings();
    const unsubInvoices = subscribeInvoices("owner");
    return () => {
      if (unsubConfig) unsubConfig();
      if (unsubInvoices) unsubInvoices();
    };
  }, []);

  // Total outstanding balance
  const totalOutstanding = pendingPaymentInvoices.reduce((sum, inv) => {
    return sum + Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0));
  }, 0);

  // ── Open update panel ───────────────────────────────
  const openEdit = (inv) => {
    setExpandedId(inv.id);
    setEditState((prev) => ({
      ...prev,
      [inv.id]: {
        paymentMethod: inv.paymentMethod || "CASH",
        amountPaid: inv.amountPaid ?? 0,
        loanProvider: inv.loanProvider || "",
        emiAmount: inv.emiAmount || "",
        loanCompletionDate: inv.loanCompletionDate || "",
        paymentNote: inv.paymentNote || "",
      },
    }));
  };

  const updateEdit = (id, field, value) => {
    setEditState((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  // ── Save payment update ─────────────────────────────
  const handleSave = async (inv) => {
    setSavingId(inv.id);
    const edit = editState[inv.id];
    const newStatus = derivePaymentStatus(
      edit.paymentMethod,
      edit.amountPaid,
      inv.totalAmount
    );
    try {
      await updatePaymentStatus(
        inv.id,
        {
          paymentMethod: edit.paymentMethod,
          amountPaid: parseFloat(edit.amountPaid) || 0,
          paymentStatus: newStatus,
          loanProvider: edit.loanProvider || null,
          emiAmount: edit.emiAmount ? parseFloat(edit.emiAmount) : null,
          loanCompletionDate: edit.loanCompletionDate || null,
          paymentNote: edit.paymentNote || null,
        },
        currentUser
      );
      setSuccessId(inv.id);
      setTimeout(() => setSuccessId(null), 3000);
      setExpandedId(null);
    } catch (err) {
      alert("Failed to update: " + err.message);
    } finally {
      setSavingId(null);
    }
  };

  // ── Status summary chips ────────────────────────────
  const counts = PENDING_STATUSES.reduce((acc, s) => {
    acc[s] = pendingPaymentInvoices.filter((inv) => inv.paymentStatus === s).length;
    return acc;
  }, {});

  const STATUS_CHIP_COLORS = {
    UNPAID: { bg: "#FFEBEE", color: "#CC0000", border: "#FFCDD2" },
    PARTIALLY_PAID: { bg: "#FFF3E0", color: "#CC6600", border: "#FFE0B2" },
    EMI: { bg: "#E3F2FD", color: "#0055CC", border: "#BBDEFB" },
    LOAN: { bg: "#E3F2FD", color: "#0055CC", border: "#BBDEFB" },
  };

  const inputStyle = {
    width: "100%",
    padding: "9px 11px",
    border: `1.5px solid ${border}`,
    borderRadius: 7,
    background: isDark ? "#2A2A2A" : "#FFFFFF",
    color: textPrimary,
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, paddingBottom: 60 }}>
      {/* ── Header ──────────────────────────────────── */}
      <div
        style={{
          background: "#661F1F",
          padding: "16px 18px",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button
            onClick={() => navigate("/invoices")}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none", borderRadius: 8,
              padding: 7, cursor: "pointer",
              color: "#FFFFFF", display: "flex",
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 700, margin: 0 }}>
              Pending Payments
            </h1>
            <div style={{ color: "#F0BABA", fontSize: 11, marginTop: 2, fontFamily: "Arial, sans-serif" }}>
              {pendingPaymentInvoices.length} invoice{pendingPaymentInvoices.length !== 1 ? "s" : ""} outstanding
            </div>
          </div>
        </div>

        {/* Outstanding total */}
        <div
          style={{
            background: "rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding: "12px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          <div style={{ color: "#F0BABA", fontSize: 12, fontFamily: "Arial, sans-serif" }}>
            Total Outstanding Balance
          </div>
          <div
            style={{
              color: "#FFFFFF",
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "'Courier New', monospace",
            }}
          >
            {formatCurrency(totalOutstanding)}
          </div>
        </div>
      </div>

      <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
        {dbLocked && <DBLockedBanner lockedBy={dbLockedBy} />}

        {!dbLocked && (
          <>
            {/* ── Status summary chips ─────────────────── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {PENDING_STATUSES.map((s) => {
                const sc = STATUS_CHIP_COLORS[s];
                const label = s === "PARTIALLY_PAID" ? "Partial" : s;
                return (
                  <div
                    key={s}
                    style={{
                      background: sc.bg,
                      border: `1px solid ${sc.border}`,
                      borderRadius: 8,
                      padding: "7px 12px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 68,
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 700, color: sc.color }}>
                      {counts[s]}
                    </div>
                    <div style={{ fontSize: 10, color: sc.color, fontFamily: "Arial, sans-serif", fontWeight: 600, letterSpacing: 0.3 }}>
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Invoice cards ────────────────────────── */}
            {pendingPaymentInvoices.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "56px 20px",
                  background: cardBg,
                  borderRadius: 14,
                  border: `1.5px dashed ${border}`,
                  color: textSecondary,
                }}
              >
                <CheckCircle2 size={42} color="#4CAF50" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1A7A1A" }}>
                  All Caught Up!
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  No outstanding payments at the moment.
                </div>
              </div>
            ) : (
              pendingPaymentInvoices.map((inv) => {
                const balanceDue = Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0));
                const isExpanded = expandedId === inv.id;
                const edit = editState[inv.id] || {};
                const isSuccess = successId === inv.id;

                return (
                  <div
                    key={inv.id}
                    style={{
                      background: cardBg,
                      border: `1.5px solid ${isSuccess ? "#4CAF50" : isExpanded ? "#661F1F" : border}`,
                      borderRadius: 12,
                      marginBottom: 12,
                      overflow: "hidden",
                      boxShadow: isExpanded
                        ? "0 4px 18px rgba(102,31,31,0.14)"
                        : "0 2px 8px rgba(0,0,0,0.06)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {/* Card summary row */}
                    <div
                      style={{ padding: "14px 16px", cursor: "pointer" }}
                      onClick={() =>
                        isExpanded ? setExpandedId(null) : openEdit(inv)
                      }
                    >
                      {/* Top: invoice no + badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span
                          style={{
                            fontFamily: "'Courier New', monospace",
                            fontWeight: 700,
                            fontSize: 13,
                            color: "#661F1F",
                          }}
                        >
                          {inv.invoiceNo}
                          {inv.isDateOverridden && (
                            <span style={{ marginLeft: 6, background: "#FFF3E0", color: "#CC6600", fontSize: 9, padding: "1px 5px", borderRadius: 4, fontFamily: "Arial, sans-serif", fontWeight: 700, border: "1px solid #FFB74D" }}>M</span>
                          )}
                        </span>
                        <InvoiceStatusBadge invoice={inv} size="xs" />
                      </div>

                      {/* Customer name */}
                      <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>
                        {inv.customerSnapshot?.name || "—"}
                      </div>

                      {/* Vehicle + phone row */}
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
                        {inv.vehicleSnapshot?.registrationNo && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Car size={12} color={textSecondary} />
                            <span style={{ fontSize: 12, color: textSecondary }}>
                              {inv.vehicleSnapshot.registrationNo}
                            </span>
                          </div>
                        )}
                        {inv.customerSnapshot?.phone && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Phone size={12} color={textSecondary} />
                            <span style={{ fontSize: 12, color: textSecondary }}>
                              {inv.customerSnapshot.phone}
                            </span>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Calendar size={12} color={inv.isDateOverridden ? "#CC6600" : textSecondary} />
                          <span style={{ fontSize: 12, color: inv.isDateOverridden ? "#CC6600" : textSecondary }}>
                            {formatDate(inv.invoiceDate || inv.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Amount row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 16 }}>
                          <div>
                            <div style={{ fontSize: 10, color: textSecondary, fontFamily: "Arial, sans-serif", marginBottom: 1 }}>Total</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, fontFamily: "'Courier New', monospace" }}>
                              {formatCurrency(inv.totalAmount || 0)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: textSecondary, fontFamily: "Arial, sans-serif", marginBottom: 1 }}>Paid</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1A7A1A", fontFamily: "'Courier New', monospace" }}>
                              {formatCurrency(inv.amountPaid || 0)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#CC0000", fontFamily: "Arial, sans-serif", marginBottom: 1, fontWeight: 700 }}>Due</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#CC0000", fontFamily: "'Courier New', monospace" }}>
                              {formatCurrency(balanceDue)}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {isSuccess && (
                            <CheckCircle2 size={18} color="#1A7A1A" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/invoices/${inv.id}`);
                            }}
                            style={{
                              background: "none", border: `1px solid ${border}`,
                              borderRadius: 6, padding: "5px 8px", cursor: "pointer",
                              fontSize: 11, color: textSecondary, fontFamily: "inherit",
                              display: "flex", alignItems: "center", gap: 3,
                            }}
                          >
                            View <ChevronRight size={12} />
                          </button>
                          <div
                            style={{
                              background: isExpanded ? "#661F1F" : inputBg,
                              borderRadius: 6, padding: "5px 8px",
                              border: `1px solid ${isExpanded ? "#661F1F" : border}`,
                              cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 3,
                              fontSize: 11, fontWeight: 700,
                              color: isExpanded ? "#FFFFFF" : "#661F1F",
                            }}
                          >
                            <RefreshCw size={12} />
                            Update
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Expanded Edit Panel ───────────── */}
                    {isExpanded && (
                      <div
                        style={{
                          borderTop: `1px solid ${border}`,
                          padding: "16px",
                          background: isDark ? "#1A1A1A" : "#F5F0EE",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#661F1F", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Arial, sans-serif", marginBottom: 12 }}>
                          Update Payment Status
                        </div>

                        {/* Payment method */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: textSecondary, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Arial, sans-serif" }}>
                            Payment Method
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {PAYMENT_METHODS.map((m) => (
                              <button
                                key={m.value}
                                onClick={() => updateEdit(inv.id, "paymentMethod", m.value)}
                                style={{
                                  padding: "6px 12px", borderRadius: 7,
                                  border: `1.5px solid ${edit.paymentMethod === m.value ? "#661F1F" : border}`,
                                  background: edit.paymentMethod === m.value ? "#661F1F" : "none",
                                  color: edit.paymentMethod === m.value ? "#FFFFFF" : textPrimary,
                                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                }}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Amount paid */}
                        {edit.paymentMethod !== "LOAN" && edit.paymentMethod !== "EMI" && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: textSecondary, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Arial, sans-serif" }}>
                              Amount Paid
                            </div>
                            <div style={{ position: "relative" }}>
                              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#661F1F", fontWeight: 700, fontSize: 14, pointerEvents: "none" }}>₹</span>
                              <input
                                type="number" min={0} max={inv.totalAmount} step={0.01}
                                value={edit.amountPaid}
                                onChange={(e) => updateEdit(inv.id, "amountPaid", e.target.value)}
                                style={{ ...inputStyle, paddingLeft: 26, fontFamily: "'Courier New', monospace" }}
                                onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                                onBlur={(e) => (e.target.style.borderColor = border)}
                              />
                            </div>
                            {/* Quick fill */}
                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                              <button onClick={() => updateEdit(inv.id, "amountPaid", inv.totalAmount)} style={{ padding: "3px 9px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer" }}>
                                Full ({formatCurrency(inv.totalAmount)})
                              </button>
                              <button onClick={() => updateEdit(inv.id, "amountPaid", balanceDue)} style={{ padding: "3px 9px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer" }}>
                                Balance ({formatCurrency(balanceDue)})
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Loan/EMI fields */}
                        {(edit.paymentMethod === "LOAN" || edit.paymentMethod === "EMI") && (
                          <>
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 11, color: textSecondary, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Arial, sans-serif" }}>Provider</div>
                              <input
                                placeholder="Finance provider name"
                                value={edit.loanProvider}
                                onChange={(e) => updateEdit(inv.id, "loanProvider", e.target.value)}
                                style={inputStyle}
                                onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                                onBlur={(e) => (e.target.style.borderColor = border)}
                              />
                            </div>
                            {edit.paymentMethod === "EMI" && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 11, color: textSecondary, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Arial, sans-serif" }}>EMI / Month (₹)</div>
                                <input
                                  type="number" min={0}
                                  value={edit.emiAmount}
                                  onChange={(e) => updateEdit(inv.id, "emiAmount", e.target.value)}
                                  style={{ ...inputStyle, fontFamily: "'Courier New', monospace" }}
                                  onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                                  onBlur={(e) => (e.target.style.borderColor = border)}
                                />
                              </div>
                            )}
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 11, color: textSecondary, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Arial, sans-serif" }}>Est. Completion Date</div>
                              <input
                                type="date"
                                value={edit.loanCompletionDate}
                                onChange={(e) => updateEdit(inv.id, "loanCompletionDate", e.target.value)}
                                style={inputStyle}
                                onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                                onBlur={(e) => (e.target.style.borderColor = border)}
                              />
                            </div>
                          </>
                        )}

                        {/* Payment note */}
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 11, color: textSecondary, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Arial, sans-serif" }}>Note (optional)</div>
                          <input
                            placeholder="e.g. Cash received on 15th..."
                            value={edit.paymentNote}
                            onChange={(e) => updateEdit(inv.id, "paymentNote", e.target.value)}
                            style={inputStyle}
                            onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                            onBlur={(e) => (e.target.style.borderColor = border)}
                          />
                        </div>

                        {/* New status preview */}
                        {edit.paymentMethod && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                            <span style={{ fontSize: 12, color: textSecondary }}>New status:</span>
                            <InvoiceStatusBadge
                              invoice={derivePaymentStatus(
                                edit.paymentMethod,
                                edit.amountPaid,
                                inv.totalAmount
                              )}
                              size="sm"
                            />
                          </div>
                        )}

                        {/* Save / Cancel */}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => setExpandedId(null)}
                            style={{
                              flex: 1, padding: "10px 0", background: "none",
                              border: `1.5px solid ${border}`, borderRadius: 8,
                              color: textPrimary, fontSize: 13, fontWeight: 600,
                              cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(inv)}
                            disabled={savingId === inv.id}
                            style={{
                              flex: 2, padding: "10px 0",
                              background: savingId === inv.id ? "#888" : "#661F1F",
                              border: "none", borderRadius: 8,
                              color: "#FFFFFF", fontSize: 13, fontWeight: 700,
                              cursor: savingId === inv.id ? "not-allowed" : "pointer",
                              fontFamily: "inherit",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            }}
                          >
                            <CheckCircle2 size={15} />
                            {savingId === inv.id ? "Saving..." : "Save Payment Update"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}