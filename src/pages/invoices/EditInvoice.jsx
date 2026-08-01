// SGA — Last updated: Restored original 4-section structure; form init reads amountPaid from paymentEntries[0] or computeTotalPaid; handleSave writes paymentEntries + totalPaid; Payment Breakdown section added below Payment Note; AddPaymentEntryModal for overlay add
// ============================================================
// EditInvoice.jsx — Edit an existing invoice (Owner / SuperAdmin only)
// ============================================================
//
// SCOPE OF EDIT
//   - Invoice date (with the same "M" override indicator as in CreateInvoice)
//   - Due date
//   - Payment method (Cash, UPI, Card, Loan, EMI, Bank Transfer)
//   - Amount paid (primary / first entry)
//   - Loan / EMI fields (provider, EMI amount, completion date)
//   - Payment note
//   - Discount amount
//   - Payment Breakdown: view / delete existing entries; add new entries
//
// OUT OF SCOPE
//   Items, labour cost, customer, and vehicle details are intentionally NOT
//   editable here. Those affect inventory deduction which already ran at
//   approval time. Changing them post-approval requires a return invoice.
//
// ACCESS
//   Owner and SuperAdmin only. Route protected in App.jsx.
//   Employee navigating to /invoices/:id/edit is redirected to /unauthorized.

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Save, Calendar, CreditCard, Tag, Info, Check, Trash2,
} from "lucide-react";
import useInvoiceStore  from "../../store/invoiceStore";
import useAuthStore     from "../../store/authStore";
import useThemeStore    from "../../store/themeStore";
import DBLockedBanner   from "../../components/invoices/DBLockedBanner";
import AddPaymentEntryModal from "../../components/invoices/AddPaymentEntryModal";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  requiresLoanFields,
  derivePaymentStatus,
  formatCurrency,
  calculateTotals,
  computeTotalPaid,
  buildPaymentEntry,
} from "../../lib/invoiceHelpers";

const GST_RATE = 0.09;

export default function EditInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { firebaseUser: currentUser, role } = useAuthStore();
  const { theme } = useThemeStore();
  const {
    currentInvoice, loadInvoice,
    updateInvoice,
    deletePaymentEntry,
    dbLocked, dbLockedBy,
    subscribeSystemConfig, loadSettings,
    gstNumber,
    loading, error, clearError,
  } = useInvoiceStore();

  const isDark = theme === "dark";
  const isOwnerOrAbove = ["owner", "superadmin"].includes(role);

  // ── Colours ─────────────────────────────────────────────
  const bg           = isDark ? "#1A1A1A" : "#CDCBC9";
  const cardBg       = isDark ? "#2A2A2A" : "#FFFFFF";
  const border       = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary  = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const inputBg      = isDark ? "#2A2A2A" : "#FFFFFF";
  const sectionBg    = isDark ? "#1A1A1A" : "#F5F0EE";

  // ── Form state ───────────────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0];
  const [form, setForm]           = useState(null);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [success, setSuccess]     = useState(false);

  // Discount draft state
  const [discountDraft,     setDiscountDraft]     = useState("");
  const [discountConfirmed, setDiscountConfirmed] = useState(false);

  // Payment Breakdown modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    clearError?.();
    subscribeSystemConfig();
    loadSettings();
    if (id) loadInvoice(id);
  }, [id]);

  // Initialise form once invoice is loaded
  useEffect(() => {
    if (!currentInvoice) return;
    const inv = currentInvoice;

    const savedDiscount = parseFloat(inv.discountAmount || 0);
    setDiscountDraft(savedDiscount > 0 ? String(savedDiscount) : "");
    setDiscountConfirmed(savedDiscount > 0);

    // For amountPaid: if the invoice has paymentEntries, read from first entry.
    // This is the "primary" payment the user manages from this form.
    // For legacy invoices without entries, fall back to computeTotalPaid.
    const firstEntry =
      Array.isArray(inv.paymentEntries) && inv.paymentEntries.length > 0
        ? inv.paymentEntries[0]
        : null;
    const initAmountPaid = firstEntry ? firstEntry.amount : computeTotalPaid(inv);

    setForm({
      invoiceDate:        inv.invoiceDate        || todayStr,
      dueDate:            inv.dueDate            || "",
      isDateOverridden:   inv.isDateOverridden   || false,
      gstEnabled:         inv.gstEnabled         || false,
      paymentMethod:      inv.paymentMethod      || "CASH",
      amountPaid:         initAmountPaid > 0 ? String(initAmountPaid) : "",
      paymentNote:        inv.paymentNote        || "",
      loanProvider:       inv.loanProvider       || "",
      emiAmount:          inv.emiAmount          || "",
      loanCompletionDate: inv.loanCompletionDate || "",
      discountAmount:     savedDiscount,
    });
  }, [currentInvoice?.id]);

  // Guard — redirect non-owners away
  if (!isOwnerOrAbove) {
    navigate("/unauthorized");
    return null;
  }

  const inv = currentInvoice;

  // ── Derived totals (read-only — items & labour cannot change) ──
  const items      = inv?.items     || [];
  const labourCost = parseFloat(inv?.labourCost || 0);
  const gstOn      = form?.gstEnabled || false;

  const baseTotals       = calculateTotals({ items, labourCost });
  const subtotal         = baseTotals.subtotal;
  const cgst             = gstOn ? parseFloat((subtotal * GST_RATE).toFixed(2)) : 0;
  const sgst             = gstOn ? parseFloat((subtotal * GST_RATE).toFixed(2)) : 0;
  const preDiscountTotal = parseFloat((subtotal + cgst + sgst).toFixed(2));

  const confirmedDiscount = discountConfirmed ? parseFloat(discountDraft || 0) : 0;
  const totalAmount       = parseFloat(Math.max(0, preDiscountTotal - confirmedDiscount).toFixed(2));
  const amountPaidNum     = parseFloat(form?.amountPaid || 0);
  const balanceDue        = Math.max(0, totalAmount - amountPaidNum);

  const paymentStatus = form
    ? derivePaymentStatus(form.paymentMethod, form.amountPaid, totalAmount)
    : null;

  // ── Field change handler ────────────────────────────────
  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "invoiceDate") {
        next.isDateOverridden = value !== todayStr;
      }
      if (field === "paymentMethod") {
        next.amountPaid         = value === "DEBIT" ? "0" : prev.amountPaid;
        next.loanProvider       = "";
        next.emiAmount          = "";
        next.loanCompletionDate = "";
      }
      return next;
    });
  };

  // ── Discount handlers ────────────────────────────────────
  const handleConfirmDiscount = () => {
    const disc = parseFloat(discountDraft || 0);
    if (isNaN(disc) || disc < 0) return;
    if (disc > preDiscountTotal) {
      alert("Discount cannot exceed the invoice total.");
      return;
    }
    setDiscountConfirmed(true);
    setForm((prev) => ({ ...prev, discountAmount: disc }));
  };

  const handleRemoveDiscount = () => {
    setDiscountDraft("");
    setDiscountConfirmed(false);
    setForm((prev) => ({ ...prev, discountAmount: 0 }));
  };

  // ── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!currentUser || !form) return;
    setSaving(true);
    setSaveError(null);

    try {
      // Build new payment entries:
      // - First slot (primary) is replaced from the form's amountPaid field.
      // - Entries at index 1+ (additional, managed via AddPaymentEntryModal /
      //   deletePaymentEntry) are preserved from the current Firestore state.
      const existingEntries = Array.isArray(inv.paymentEntries)
        ? inv.paymentEntries
        : [];
      const additionalEntries = existingEntries.slice(1);

      const primaryEntry =
        amountPaidNum > 0 && !["LOAN", "EMI"].includes(form.paymentMethod)
          ? buildPaymentEntry({
              amount:    amountPaidNum,
              method:    form.paymentMethod,
              date:      form.invoiceDate,
              reference: form.paymentNote || "",
              currentUser,
            })
          : null;

      const newPaymentEntries = [
        ...(primaryEntry ? [primaryEntry] : []),
        ...additionalEntries,
      ];

      const newTotalPaid = newPaymentEntries.reduce(
        (s, e) => s + parseFloat(e.amount || 0),
        0
      );

      // Re-derive paymentStatus using the updated totalPaid + new totalAmount
      const newPaymentStatus = derivePaymentStatus(
        form.paymentMethod,
        newTotalPaid,
        totalAmount
      );

      const updates = {
        invoiceDate:        form.invoiceDate,
        isDateOverridden:   form.isDateOverridden,
        dueDate:            form.dueDate || null,
        gstEnabled:         form.gstEnabled,
        // Recalculated totals
        subtotal,
        cgst,
        sgst,
        preDiscountTotal,
        discountAmount:     confirmedDiscount,
        totalAmount,
        // Payment — new entries model
        paymentEntries:     newPaymentEntries,
        totalPaid:          newTotalPaid,
        paymentStatus:      newPaymentStatus,
        // Legacy flat fields kept for backward compat
        paymentMethod:      form.paymentMethod,
        amountPaid:         amountPaidNum,
        paymentNote:        form.paymentNote        || "",
        loanProvider:       form.loanProvider       || "",
        emiAmount:          form.emiAmount ? parseFloat(form.emiAmount) : null,
        loanCompletionDate: form.loanCompletionDate || "",
      };

      await updateInvoice(id, updates, currentUser);
      setSuccess(true);
      setTimeout(() => navigate(`/invoices/${id}`), 1800);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
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

  const SectionHeader = ({ icon: Icon, title }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 14,
        paddingBottom: 8,
        borderBottom: `1px solid ${border}`,
      }}
    >
      <Icon size={15} color="#661F1F" />
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#661F1F",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {title}
      </span>
    </div>
  );

  // ── Loading / error states ────────────────────────────────
  if (loading && !inv) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#661F1F", fontSize: 16 }}>Loading invoice…</div>
      </div>
    );
  }

  if ((error && !inv) || (inv && !form)) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#CC0000", fontSize: 14 }}>{error || "Loading…"}</div>
      </div>
    );
  }

  // Balance due for AddPaymentEntryModal — uses computeTotalPaid to account
  // for all existing entries (not just the primary one being edited)
  const entryBalanceDue = inv ? Math.max(0, totalAmount - computeTotalPaid(inv)) : 0;

  return (
    <div style={{ minHeight: "100vh", background: bg, paddingBottom: 100 }}>

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
          onClick={() => navigate(`/invoices/${id}`)}
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
          <div
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Courier New', monospace",
            }}
          >
            Edit Invoice
          </div>
          {inv && (
            <div style={{ color: "rgba(255,220,200,0.8)", fontSize: 12, marginTop: 1 }}>
              {inv.invoiceNo}
            </div>
          )}
        </div>
      </div>

      {/* ── Success banner ─────────────────────────────────── */}
      {success && (
        <div
          style={{
            background: "#E8F5E9",
            borderBottom: "1px solid #C8E6C9",
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Check size={16} color="#1A7A1A" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1A7A1A" }}>
            Invoice updated successfully! Redirecting…
          </span>
        </div>
      )}

      <div style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
        {dbLocked && <DBLockedBanner lockedBy={dbLockedBy} />}

        {!dbLocked && form && inv && (
          <>
            {/* ── Readonly summary ─────────────────────────── */}
            <div
              style={{
                background: sectionBg,
                border: `1px solid ${border}`,
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#661F1F",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 8,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                Invoice Summary (read-only)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { label: "Customer", value: inv.customerSnapshot?.name || "—" },
                  { label: "Items",    value: `${items.length} item${items.length !== 1 ? "s" : ""}` },
                  { label: "Labour",   value: formatCurrency(labourCost) },
                  { label: "Subtotal", value: formatCurrency(subtotal) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: textSecondary }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>{value}</span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: textSecondary,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Info size={12} />
                Items and labour cannot be changed after approval. Use a Return Invoice to reverse items.
              </div>
            </div>

            {/* ── Invoice Dates ─────────────────────────────── */}
            <div
              style={{
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: 12,
                padding: "16px",
                marginBottom: 12,
              }}
            >
              <SectionHeader icon={Calendar} title="Invoice Dates" />

              <div style={fieldGroup}>
                <label style={labelStyle}>
                  Invoice Date
                  {form.isDateOverridden && (
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
                    color={form.isDateOverridden ? "#CC6600" : "#888"}
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="date"
                    value={form.invoiceDate}
                    onChange={(e) => handleChange("invoiceDate", e.target.value)}
                    style={{
                      ...inputStyle,
                      paddingLeft: 34,
                      borderColor: form.isDateOverridden ? "#CC6600" : border,
                      color: form.isDateOverridden ? "#CC6600" : textPrimary,
                      fontWeight: form.isDateOverridden ? 600 : 400,
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                    onBlur={(e) => (e.target.style.borderColor = form.isDateOverridden ? "#CC6600" : border)}
                  />
                </div>
                {form.isDateOverridden && (
                  <div style={{ fontSize: 11, color: "#CC6600", marginTop: 4 }}>
                    ⚠ Date differs from today — will be highlighted in list views.
                  </div>
                )}
              </div>

              <div style={fieldGroup}>
                <label style={labelStyle}>Due Date (optional)</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => handleChange("dueDate", e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                  onBlur={(e) => (e.target.style.borderColor = border)}
                />
              </div>
            </div>

            {/* ── GST & Discount ────────────────────────────── */}
            <div
              style={{
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: 12,
                padding: "16px",
                marginBottom: 12,
              }}
            >
              <SectionHeader icon={Tag} title="GST & Discount" />

              {gstNumber ? (
                <div
                  style={{
                    background: form.gstEnabled ? "#F0FAF0" : sectionBg,
                    border: `1.5px solid ${form.gstEnabled ? "#4CAF50" : border}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 14,
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
                    <div
                      onClick={() => handleChange("gstEnabled", !form.gstEnabled)}
                      style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: form.gstEnabled ? "#1A7A1A" : (isDark ? "#555" : "#CCC"),
                        position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 18, height: 18, borderRadius: "50%",
                          background: "#FFFFFF", position: "absolute", top: 3,
                          left: form.gstEnabled ? 23 : 3, transition: "left 0.2s",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                        }}
                      />
                    </div>
                  </div>
                  {form.gstEnabled && (
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: "1px solid #C8E6C9",
                        display: "flex",
                        gap: 16,
                      }}
                    >
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
                    background: sectionBg,
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 14,
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

              {/* Invoice total */}
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
                <span style={{ fontSize: 14, fontWeight: 700, color: "#661F1F" }}>Invoice Total</span>
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

              {/* Discount */}
              <div
                style={{
                  background: discountConfirmed ? (isDark ? "#1A1A2A" : "#F0F4FF") : sectionBg,
                  border: `1.5px solid ${discountConfirmed ? "#8B3A3A" : border}`,
                  borderRadius: 10,
                  padding: "14px 16px",
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
                      Enter a discount amount (flat ₹). Leave blank for no discount.
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
                          onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDiscount(); }}
                        />
                      </div>
                      <button
                        onClick={handleConfirmDiscount}
                        disabled={!discountDraft || parseFloat(discountDraft) <= 0}
                        style={{
                          padding: "0 16px",
                          background:
                            discountDraft && parseFloat(discountDraft) > 0
                              ? "#661F1F"
                              : (isDark ? "#333" : "#E0D8D4"),
                          border: "none",
                          borderRadius: 8,
                          color:
                            discountDraft && parseFloat(discountDraft) > 0
                              ? "#FFFFFF"
                              : textSecondary,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor:
                            discountDraft && parseFloat(discountDraft) > 0
                              ? "pointer"
                              : "not-allowed",
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: isDark ? "#2A2A2A" : "#FFFFFF",
                      borderRadius: 8,
                      border: "1px solid #E8C8C8",
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
                        border: "1px solid #E8C8C8",
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
                )}
              </div>

              {/* Revised total when discount applied */}
              {discountConfirmed && confirmedDiscount > 0 && (
                <div
                  style={{
                    background: isDark ? "#1A2A1A" : "#E8F5E9",
                    borderRadius: 10,
                    padding: "12px 16px",
                    marginTop: 12,
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
            </div>

            {/* ── Payment Details ───────────────────────────── */}
            <div
              style={{
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: 12,
                padding: "16px",
                marginBottom: 12,
              }}
            >
              <SectionHeader icon={CreditCard} title="Payment Details" />

              {/* Payment method chips */}
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
                        border: `1.5px solid ${form.paymentMethod === m.value ? "#661F1F" : border}`,
                        background: form.paymentMethod === m.value ? "#661F1F" : inputBg,
                        color: form.paymentMethod === m.value ? "#FFFFFF" : textPrimary,
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

              {/* Amount paid */}
              {form.paymentMethod !== "LOAN" && form.paymentMethod !== "EMI" && (
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
                      value={form.amountPaid}
                      onChange={(e) => handleChange("amountPaid", e.target.value)}
                      placeholder={`0 – ${totalAmount}`}
                      style={{
                        ...inputStyle,
                        paddingLeft: 28,
                        fontFamily: "'Courier New', monospace",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                      onBlur={(e) => (e.target.style.borderColor = border)}
                    />
                  </div>
                  {/* Quick-fill buttons */}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleChange("amountPaid", "0")}
                      style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer" }}
                    >
                      ₹0
                    </button>
                    <button
                      onClick={() => handleChange("amountPaid", String(Math.round(totalAmount / 2)))}
                      style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer" }}
                    >
                      50% ({formatCurrency(totalAmount / 2)})
                    </button>
                    <button
                      onClick={() => handleChange("amountPaid", String(totalAmount))}
                      style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 11, cursor: "pointer" }}
                    >
                      Full ({formatCurrency(totalAmount)})
                    </button>
                  </div>
                </div>
              )}

              {/* Loan/EMI fields */}
              {requiresLoanFields(form.paymentMethod) && (
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
                    {form.paymentMethod === "EMI" ? "EMI Details" : "Loan Details"}
                  </div>
                  <div style={fieldGroup}>
                    <label style={{ ...labelStyle, color: "#0055CC" }}>Loan / Finance Provider *</label>
                    <input
                      placeholder="e.g. HDFC Bank, Bajaj Finance…"
                      value={form.loanProvider}
                      onChange={(e) => handleChange("loanProvider", e.target.value)}
                      style={{ ...inputStyle, borderColor: "#90CAF9" }}
                      onFocus={(e) => (e.target.style.borderColor = "#0055CC")}
                      onBlur={(e) => (e.target.style.borderColor = "#90CAF9")}
                    />
                  </div>
                  {form.paymentMethod === "EMI" && (
                    <div style={fieldGroup}>
                      <label style={{ ...labelStyle, color: "#0055CC" }}>EMI Amount / Month *</label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#0055CC", fontWeight: 700, pointerEvents: "none" }}>₹</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          placeholder="Monthly EMI"
                          value={form.emiAmount}
                          onChange={(e) => handleChange("emiAmount", e.target.value)}
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
                      value={form.loanCompletionDate}
                      onChange={(e) => handleChange("loanCompletionDate", e.target.value)}
                      style={{ ...inputStyle, borderColor: "#90CAF9" }}
                      onFocus={(e) => (e.target.style.borderColor = "#0055CC")}
                      onBlur={(e) => (e.target.style.borderColor = "#90CAF9")}
                    />
                  </div>
                </div>
              )}

              {/* Balance due summary */}
              {form.paymentMethod !== "LOAN" && form.paymentMethod !== "EMI" && (
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
                    marginBottom: 14,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: balanceDue > 0 ? "#CC0000" : "#1A7A1A" }}>
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

              {/* Payment note */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Payment Note (optional)</label>
                <input
                  placeholder="e.g. Cash received, UPI ref: XXXX…"
                  value={form.paymentNote}
                  onChange={(e) => handleChange("paymentNote", e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                  onBlur={(e) => (e.target.style.borderColor = border)}
                />
              </div>

              {/* ── Payment Breakdown (only when entries exist) ── */}
              {Array.isArray(inv.paymentEntries) && inv.paymentEntries.length > 0 && (
                <>
                  <div style={{ height: 1, background: border, margin: "4px 0 14px" }} />
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: textSecondary,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      fontFamily: "Arial, sans-serif",
                      marginBottom: 10,
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
                        padding: "8px 0",
                        borderBottom: idx < inv.paymentEntries.length - 1
                          ? `1px solid ${border}`
                          : "none",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 13, color: textPrimary, fontWeight: 600 }}>
                          {PAYMENT_METHOD_LABELS[entry.method] || entry.method}
                        </span>
                        {entry.date && (
                          <span style={{ fontSize: 11, color: textSecondary, marginLeft: 6 }}>
                            ·{" "}
                            {new Date(entry.date + "T00:00:00").toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        {entry.reference && (
                          <div style={{ fontSize: 11, color: textSecondary }}>{entry.reference}</div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                        {entry.id && (
                          <button
                            onClick={async () => {
                              if (!window.confirm("Delete this payment entry? This cannot be undone.")) return;
                              await deletePaymentEntry(id, entry.id, currentUser);
                              await loadInvoice(id);
                            }}
                            title="Delete entry"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 3,
                              display: "flex",
                              alignItems: "center",
                              color: "#CC0000",
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => setShowPaymentModal(true)}
                    style={{
                      marginTop: 12,
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
                </>
              )}
            </div>

            {/* ── Error message ─────────────────────────────── */}
            {saveError && (
              <div
                style={{
                  background: "#FFEBEE",
                  border: "1px solid #FFCDD2",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 12,
                  color: "#CC0000",
                  fontSize: 13,
                }}
              >
                ⚠ {saveError}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── AddPaymentEntryModal (overlay) ─────────────────── */}
      {showPaymentModal && inv && (
        <AddPaymentEntryModal
          invoice={inv}
          balanceDue={entryBalanceDue}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            loadInvoice(id);
          }}
          darkMode={isDark}
        />
      )}

      {/* ── Fixed save bar ─────────────────────────────────── */}
      {inv && !dbLocked && form && !success && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: isDark ? "#1A1A1A" : "#FFFFFF",
            borderTop: `1px solid ${border}`,
            padding: "12px 16px",
            display: "flex",
            gap: 10,
            maxWidth: 640,
            margin: "0 auto",
            zIndex: 50,
            boxSizing: "border-box",
          }}
        >
          <button
            onClick={() => navigate(`/invoices/${id}`)}
            style={{
              flex: 1,
              padding: "11px 0",
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
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2,
              padding: "11px 0",
              background: saving ? "#888" : "#661F1F",
              border: "none",
              borderRadius: 10,
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 13,
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "inherit",
            }}
          >
            <Save size={15} />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}