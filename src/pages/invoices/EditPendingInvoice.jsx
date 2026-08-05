// SGA — Last updated: Fixed pre-approval edit rehydrating additionalPaymentEntries from existing paymentEntries[1...] so all recorded payment entries are visible and editable when EditPendingInvoice is opened
// ============================================================
// EditPendingInvoice.jsx — Edit a PENDING invoice (items, labour, payment)
// ============================================================
//
// SCOPE OF EDIT (PENDING invoices only)
//   - Items (add / remove / change quantity / change selling price)
//   - Labour cost
//   - Payment method, initial payment amount, loan/EMI fields, reference/note
//   - Invoice date, due date, GST toggle, discount
//
// GUARD
//   If the invoice is NOT in PENDING status this page immediately
//   redirects to the invoice detail view. Approved invoices must use
//   EditInvoice.jsx (/invoices/:id/edit) for payment-only editing.
//
// ACCESS
//   Owner and SuperAdmin only. Route protected in App.jsx.
//   Employee navigating here is redirected to /unauthorized.

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Package, Wrench, CreditCard, CheckCircle, ArrowLeft,
  ArrowRight, X, Save,
} from "lucide-react";
import useInvoiceStore from "../../store/invoiceStore";
import useAuthStore from "../../store/authStore";
import useThemeStore from "../../store/themeStore";
import InvoiceStepItems from "../../components/invoices/InvoiceStepItems";
import InvoiceStepLabour from "../../components/invoices/InvoiceStepLabour";
import InvoiceStepPayment from "../../components/invoices/InvoiceStepPayment";
import DBLockedBanner from "../../components/invoices/DBLockedBanner";
import {
  derivePaymentStatus,
  formatCurrency,
  buildPaymentEntry,
} from "../../lib/invoiceHelpers";

const STEPS = [
  { id: 1, label: "Items", icon: Package, description: "Edit line items" },
  { id: 2, label: "Labour", icon: Wrench, description: "Labour charges" },
  { id: 3, label: "Payment", icon: CreditCard, description: "Payment details" },
  { id: 4, label: "Review", icon: CheckCircle, description: "Review & save" },
];

export default function EditPendingInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { firebaseUser: currentUser, role } = useAuthStore();
  const { theme } = useThemeStore();
  const {
    currentInvoice, loadInvoice,
    updateInvoice,
    dbLocked, dbLockedBy,
    gstNumber,
    subscribeSystemConfig, loadSettings,
    loading, error, clearError,
  } = useInvoiceStore();

  const isDark = theme === "dark";
  const isOwnerOrAbove = ["owner", "superadmin"].includes(role);

  const bg = isDark ? "#1A1A1A" : "#CDCBC9";
  const cardBg = isDark ? "#2A2A2A" : "#FFFFFF";
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(null);
  const [loadDone, setLoadDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    clearError?.();
    subscribeSystemConfig();
    loadSettings();
    if (id) {
      loadInvoice(id).finally(() => setLoadDone(true));
    } else {
      setLoadDone(true);
    }
  }, [id]);

  // Pre-fill form from loaded invoice
  useEffect(() => {
    if (!currentInvoice) return;
    const inv = currentInvoice;

    if (inv.status !== "PENDING") {
      navigate(`/invoices/${id}`, { replace: true });
      return;
    }

    // ── Payment entry rehydration ────────────────────────────────
    // When a pending invoice already has a paymentEntries[] array (i.e. it was
    // created with multiple payment methods, or was previously edited and saved
    // with payment entries), we need to split those entries back into the two
    // form fields that InvoiceStepPayment understands:
    //
    //   amountPaid             ← amount from paymentEntries[0] (the primary entry)
    //   paymentMethod          ← method from paymentEntries[0]
    //   additionalPaymentEntries ← paymentEntries[1...] mapped to local shape
    //
    // Without this split, re-opening the edit form would show only the first
    // entry's amount and silently discard every subsequent entry — causing the
    // balance-due display to be wrong and losing data on save.

    const firstEntry =
      Array.isArray(inv.paymentEntries) && inv.paymentEntries.length > 0
        ? inv.paymentEntries[0]
        : null;

    // Rehydrate all entries beyond the first into additionalPaymentEntries.
    // Each stored entry has shape { id, amount, method, date, reference, recordedBy, ... }.
    // The local additionalPaymentEntries shape is { method, amount, reference }.
    const additionalPaymentEntries =
      Array.isArray(inv.paymentEntries) && inv.paymentEntries.length > 1
        ? inv.paymentEntries.slice(1).map((e) => ({
          method: e.method || "CASH",
          amount: parseFloat(e.amount || 0),
          reference: e.reference || "",
        }))
        : [];

    setForm({
      customerId: inv.customerId || null,
      customerSnapshot: inv.customerSnapshot || null,
      vehicleSnapshot: inv.vehicleSnapshot || null,
      items: (inv.items || []).map((item) => ({ ...item })),
      labourCost: inv.labourCost != null ? String(inv.labourCost) : "",
      invoiceDate: inv.invoiceDate || new Date().toISOString().split("T")[0],
      dueDate: inv.dueDate || "",
      isDateOverridden: inv.isDateOverridden || false,
      gstEnabled: inv.gstEnabled || false,
      // Use firstEntry.method when available so it is consistent with the amount
      paymentMethod: firstEntry?.method || inv.paymentMethod || "CASH",
      amountPaid: firstEntry
        ? String(firstEntry.amount)
        : (inv.amountPaid != null ? String(inv.amountPaid) : ""),
      paymentNote: inv.paymentNote || "",
      loanProvider: inv.loanProvider || "",
      emiAmount: inv.emiAmount || "",
      loanCompletionDate: inv.loanCompletionDate || "",
      discountAmount: inv.discountAmount || 0,
      subtotal: inv.subtotal || 0,
      cgst: inv.cgst || 0,
      sgst: inv.sgst || 0,
      preDiscountTotal: inv.preDiscountTotal || 0,
      totalAmount: inv.totalAmount || 0,
      paymentStatus: inv.paymentStatus || "UNPAID",
      // Rehydrated from paymentEntries[1...] — preserves all entries recorded
      // before this edit session so they are visible and editable in Step 3.
      additionalPaymentEntries,
    });
  }, [currentInvoice?.id]);

  if (loadDone && !isOwnerOrAbove) {
    navigate("/unauthorized", { replace: true });
    return null;
  }

  const updateForm = (updates) => {
    setForm((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updates };
      merged.paymentStatus = derivePaymentStatus(
        merged.paymentMethod,
        merged.amountPaid,
        merged.totalAmount
      );
      return merged;
    });
  };

  const canAdvance = () => {
    if (!form) return false;
    if (step === 1) return form.items.length > 0;
    if (step === 2) return true;
    if (step === 3) {
      if (!form.paymentMethod) return false;
      if (["LOAN", "EMI"].includes(form.paymentMethod)) return !!form.loanProvider;
      return form.amountPaid !== "" && form.amountPaid !== undefined;
    }
    return true;
  };

  const handleNext = () => { if (step < STEPS.length) setStep((s) => s + 1); };
  const handleBack = () => { if (step > 1) setStep((s) => s - 1); };

  // ── Save changes ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!currentUser || !form) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Build paymentEntries from the wizard form — same logic as CreateInvoice.
      // Primary entry comes from the main amountPaid / paymentMethod fields.
      const initialAmount = parseFloat(form.amountPaid || 0);
      const paymentEntries = [];

      if (initialAmount > 0 && !["LOAN", "EMI"].includes(form.paymentMethod)) {
        paymentEntries.push(
          buildPaymentEntry({
            amount: initialAmount,
            method: form.paymentMethod,
            date: form.invoiceDate,
            reference: form.paymentNote || "",
            currentUser,
          })
        );
      }

      // Spread in additional entries recorded via the inline form in InvoiceStepPayment
      const additionalEntries = (form.additionalPaymentEntries || []).map((e) =>
        buildPaymentEntry({
          amount: e.amount,
          method: e.method,
          date: form.invoiceDate,
          reference: e.reference || "",
          currentUser,
        })
      );
      paymentEntries.push(...additionalEntries);

      const totalPaid = paymentEntries.reduce((sum, e) => sum + e.amount, 0);
      const paymentStatus = derivePaymentStatus(
        form.paymentMethod,
        totalPaid,
        form.totalAmount
      );

      const updates = {
        items: form.items,
        labourCost: parseFloat(form.labourCost || 0),
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || "",
        isDateOverridden: form.isDateOverridden || false,
        gstEnabled: form.gstEnabled || false,
        paymentMethod: form.paymentMethod,
        // New payment model
        paymentEntries,
        totalPaid,
        paymentStatus,
        // Legacy flat fields for backward compat
        amountPaid: initialAmount,
        paymentNote: form.paymentNote || "",
        loanProvider: form.loanProvider || "",
        emiAmount: form.emiAmount ? parseFloat(form.emiAmount) : null,
        loanCompletionDate: form.loanCompletionDate || "",
        discountAmount: form.discountAmount || 0,
        subtotal: form.subtotal || 0,
        cgst: form.cgst || 0,
        sgst: form.sgst || 0,
        preDiscountTotal: form.preDiscountTotal || 0,
        totalAmount: form.totalAmount || 0,
      };

      await updateInvoice(id, updates, currentUser);
      setSaveSuccess(true);
      setTimeout(() => navigate(`/invoices/${id}`), 1200);
    } catch (err) {
      setSubmitError(err.message || "Failed to save changes. Please try again.");
      setSubmitting(false);
    }
  };

  // ── Loading / error states ────────────────────────────────────
  if (!loadDone || (loading && !currentInvoice)) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#661F1F", fontSize: 16 }}>Loading invoice…</div>
      </div>
    );
  }

  if (error && !currentInvoice) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <div style={{ color: "#CC0000", fontSize: 14 }}>{error}</div>
        <button
          onClick={() => { setLoadDone(false); loadInvoice(id).finally(() => setLoadDone(true)); }}
          style={{ background: "#661F1F", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13 }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Step renderer ─────────────────────────────────────────────
  const renderStep = () => {
    if (!form) return null;
    switch (step) {
      case 1:
        return <InvoiceStepItems data={form} onChange={updateForm} darkMode={isDark} />;
      case 2:
        return <InvoiceStepLabour data={form} onChange={updateForm} darkMode={isDark} />;
      case 3:
        return (
          <InvoiceStepPayment
            data={form}
            onChange={updateForm}
            gstNumber={gstNumber}
            darkMode={isDark}
          />
        );
      case 4:
        return (
          <div>
            {/* Mini review summary */}
            <div
              style={{
                background: isDark ? "#1A1A1A" : "#F5F0EE",
                borderRadius: 12,
                padding: "16px",
                marginBottom: 12,
                border: `1px solid ${border}`,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#661F1F",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 10,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                Review Changes
              </div>
              {[
                { label: "Items", value: `${form.items.length} item${form.items.length !== 1 ? "s" : ""}` },
                { label: "Labour", value: formatCurrency(parseFloat(form.labourCost || 0)) },
                { label: "Total", value: formatCurrency(form.totalAmount || 0) },
                { label: "Method", value: form.paymentMethod },
                { label: "Initial Payment", value: formatCurrency(parseFloat(form.amountPaid || 0)) },
                { label: "Status", value: form.paymentStatus },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: textSecondary }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>{value}</span>
                </div>
              ))}
              {/* Show additional entries — both rehydrated from existing data and newly added */}
              {(form.additionalPaymentEntries || []).length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${border}` }}>
                  <div style={{ fontSize: 11, color: textSecondary, marginBottom: 4, fontFamily: "Arial, sans-serif" }}>
                    Additional payments:
                  </div>
                  {form.additionalPaymentEntries.map((e, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: textSecondary }}>{e.method}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#1A7A1A" }}>
                        {formatCurrency(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {submitError && (
              <div
                style={{
                  background: "#FFEBEE",
                  border: "1px solid #FFCDD2",
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: "#CC0000",
                  fontSize: 13,
                }}
              >
                ⚠ {submitError}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, paddingBottom: 100 }}>
      {/* ── Header ──────────────────────────────────────────── */}
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
          onClick={() => (step === 1 ? navigate(`/invoices/${id}`) : handleBack())}
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
          {step === 1 ? <X size={18} /> : <ArrowLeft size={18} />}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFFFFF", fontSize: 15, fontWeight: 700 }}>
            Edit Pending Invoice
          </div>
          <div style={{ color: "rgba(255,220,200,0.8)", fontSize: 12, marginTop: 1 }}>
            Step {step} of {STEPS.length}: {STEPS[step - 1].description}
          </div>
        </div>
      </div>

      {/* ── Step indicator ───────────────────────────────────── */}
      <div
        style={{
          background: isDark ? "#2A2A2A" : "#F5F0EE",
          padding: "10px 18px",
          display: "flex",
          gap: 6,
          alignItems: "center",
          justifyContent: "center",
          borderBottom: `1px solid ${border}`,
        }}
      >
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = s.id === step;
          const isDone = s.id < step;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: isActive ? "#661F1F" : isDone ? "#1A7A1A" : (isDark ? "#3A3A3A" : "#E0D8D4"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={13} color={isActive || isDone ? "#FFFFFF" : textSecondary} />
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  style={{
                    width: 20,
                    height: 2,
                    background: isDone ? "#1A7A1A" : (isDark ? "#3A3A3A" : "#E0D8D4"),
                    borderRadius: 1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {dbLocked && (
        <div style={{ padding: "16px 16px 0" }}>
          <DBLockedBanner lockedBy={dbLockedBy} />
        </div>
      )}

      {saveSuccess && (
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
          <CheckCircle size={16} color="#1A7A1A" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1A7A1A" }}>
            Changes saved! Redirecting…
          </span>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────── */}
      {!dbLocked && (
        <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
          {renderStep()}
        </div>
      )}

      {/* ── Fixed bottom nav ─────────────────────────────────── */}
      {!dbLocked && (
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
          {step > 1 && (
            <button
              onClick={handleBack}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                fontFamily: "inherit",
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {step < STEPS.length ? (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              style={{
                flex: 2,
                padding: "11px 0",
                background: canAdvance() ? "#661F1F" : (isDark ? "#333" : "#CCC"),
                border: "none",
                borderRadius: 10,
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: 13,
                cursor: canAdvance() ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                fontFamily: "inherit",
              }}
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={submitting}
              style={{
                flex: 2,
                padding: "11px 0",
                background: submitting ? "#888" : "#661F1F",
                border: "none",
                borderRadius: 10,
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: 13,
                cursor: submitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontFamily: "inherit",
              }}
            >
              <Save size={15} />
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}