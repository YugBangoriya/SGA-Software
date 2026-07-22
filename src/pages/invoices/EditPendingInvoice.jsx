// SGA — Last updated: New file — Edit Pending Invoice page (Owner/SuperAdmin only); allows full edit of items, labour, payment on PENDING invoices before approval
// ============================================================
// EditPendingInvoice.jsx — Edit a PENDING invoice (items, labour, payment)
// ============================================================
//
// SCOPE OF EDIT (PENDING invoices only)
//   - Items (add / remove / change quantity / change selling price)
//   - Labour cost
//   - Payment method, amount paid, loan/EMI fields, payment note
//   - Invoice date, due date, GST toggle, discount
//
// GUARD
//   If the invoice is NOT in PENDING status this page immediately
//   redirects to the invoice detail view.  Approved invoices must use
//   EditInvoice.jsx (/invoices/:id/edit) for payment-only editing.
//
// ACCESS
//   Owner and SuperAdmin only.  Route protected in App.jsx.
//   Employee navigating here is redirected to /unauthorized.

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Package, Wrench, CreditCard, CheckCircle, ArrowLeft,
  ArrowRight, X, AlertTriangle, Save,
} from "lucide-react";
import useInvoiceStore  from "../../store/invoiceStore";
import useAuthStore     from "../../store/authStore";
import useThemeStore    from "../../store/themeStore";
import InvoiceStepItems   from "../../components/invoices/InvoiceStepItems";
import InvoiceStepLabour  from "../../components/invoices/InvoiceStepLabour";
import InvoiceStepPayment from "../../components/invoices/InvoiceStepPayment";
import DBLockedBanner     from "../../components/invoices/DBLockedBanner";
import { derivePaymentStatus, formatCurrency } from "../../lib/invoiceHelpers";

// ── Step definitions (4 steps: Items → Labour → Payment → Review) ────────────
const STEPS = [
  { id: 1, label: "Items",   icon: Package,      description: "Edit line items"     },
  { id: 2, label: "Labour",  icon: Wrench,        description: "Labour charges"      },
  { id: 3, label: "Payment", icon: CreditCard,    description: "Payment details"     },
  { id: 4, label: "Review",  icon: CheckCircle,   description: "Review & save"       },
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

  const isDark        = theme === "dark";
  const isOwnerOrAbove = ["owner", "superadmin"].includes(role);

  // ── Colours ─────────────────────────────────────────────────
  const bg           = isDark ? "#1A1A1A" : "#CDCBC9";
  const cardBg       = isDark ? "#2A2A2A" : "#FFFFFF";
  const border       = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary  = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";

  // ── Component state ──────────────────────────────────────────
  const [step,        setStep]       = useState(1);
  const [form,        setForm]       = useState(null); // null until invoice loads
  const [loadDone,    setLoadDone]   = useState(false);
  const [submitting,  setSubmitting] = useState(false);
  const [submitError, setSubmitError]= useState(null);
  const [saveSuccess, setSaveSuccess]= useState(false);

  // ── Bootstrap ────────────────────────────────────────────────
  useEffect(() => {
    clearError?.();
    subscribeSystemConfig();
    loadSettings();
    if (id) {
      loadInvoice(id).finally(() => setLoadDone(true));
    } else {
      setLoadDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Pre-fill form from loaded invoice ───────────────────────
  useEffect(() => {
    if (!currentInvoice) return;
    const inv = currentInvoice;

    // Guard: only PENDING invoices can be fully edited
    if (inv.status !== "PENDING") {
      navigate(`/invoices/${id}`, { replace: true });
      return;
    }

    setForm({
      customerId:         inv.customerId || null,
      customerSnapshot:   inv.customerSnapshot || null,
      vehicleSnapshot:    inv.vehicleSnapshot || null,
      items:              (inv.items || []).map((item) => ({ ...item })),
      labourCost:         inv.labourCost != null ? String(inv.labourCost) : "",
      invoiceDate:        inv.invoiceDate || new Date().toISOString().split("T")[0],
      dueDate:            inv.dueDate     || "",
      isDateOverridden:   inv.isDateOverridden || false,
      gstEnabled:         inv.gstEnabled  || false,
      paymentMethod:      inv.paymentMethod || "CASH",
      amountPaid:         inv.amountPaid  != null ? String(inv.amountPaid) : "",
      paymentNote:        inv.paymentNote || "",
      loanProvider:       inv.loanProvider || "",
      emiAmount:          inv.emiAmount   || "",
      loanCompletionDate: inv.loanCompletionDate || "",
      discountAmount:     inv.discountAmount || 0,
      subtotal:           inv.subtotal    || 0,
      cgst:               inv.cgst        || 0,
      sgst:               inv.sgst        || 0,
      preDiscountTotal:   inv.preDiscountTotal || 0,
      totalAmount:        inv.totalAmount || 0,
      paymentStatus:      inv.paymentStatus || "UNPAID",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentInvoice?.id]);

  // ── Access guard ─────────────────────────────────────────────
  if (loadDone && !isOwnerOrAbove) {
    navigate("/unauthorized", { replace: true });
    return null;
  }

  // ── Form update helper ───────────────────────────────────────
  const updateForm = (updates) => {
    setForm((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updates };
      // Re-derive paymentStatus whenever payment fields change
      merged.paymentStatus = derivePaymentStatus(
        merged.paymentMethod,
        merged.amountPaid,
        merged.totalAmount
      );
      return merged;
    });
  };

  // ── Step advancement guard ───────────────────────────────────
  const canAdvance = () => {
    if (!form) return false;
    if (step === 1) return form.items.length > 0;
    if (step === 2) return true; // Labour is optional
    if (step === 3) {
      if (!form.paymentMethod) return false;
      if (["LOAN", "EMI"].includes(form.paymentMethod)) {
        return !!form.loanProvider;
      }
      return form.amountPaid !== "" && form.amountPaid !== undefined;
    }
    return true;
  };

  const handleNext = () => { if (step < STEPS.length) setStep((s) => s + 1); };
  const handleBack = () => { if (step > 1) setStep((s) => s - 1); };

  // ── Save changes ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!currentUser || !form) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const updates = {
        items:              form.items,
        labourCost:         parseFloat(form.labourCost || 0),
        invoiceDate:        form.invoiceDate,
        dueDate:            form.dueDate || "",
        isDateOverridden:   form.isDateOverridden || false,
        gstEnabled:         form.gstEnabled || false,
        paymentMethod:      form.paymentMethod,
        amountPaid:         parseFloat(form.amountPaid || 0),
        paymentNote:        form.paymentNote || "",
        loanProvider:       form.loanProvider || "",
        emiAmount:          form.emiAmount ? parseFloat(form.emiAmount) : null,
        loanCompletionDate: form.loanCompletionDate || "",
        discountAmount:     form.discountAmount || 0,
        subtotal:           form.subtotal    || 0,
        cgst:               form.cgst        || 0,
        sgst:               form.sgst        || 0,
        preDiscountTotal:   form.preDiscountTotal || 0,
        totalAmount:        form.totalAmount  || 0,
        paymentStatus:      form.paymentStatus || "UNPAID",
      };

      await updateInvoice(id, updates, currentUser);
      setSaveSuccess(true);
      setTimeout(() => navigate(`/invoices/${id}`), 1200);
    } catch (err) {
      setSubmitError(err.message || "Failed to save changes. Please try again.");
      setSubmitting(false);
    }
  };

  // ── Loading / error states ───────────────────────────────────
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

  const inv = currentInvoice;

  // ── Step content renderer ────────────────────────────────────
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
        // Review & Save
        return (
          <ReviewStep
            form={form}
            inv={inv}
            isDark={isDark}
            border={border}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            cardBg={cardBg}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div
        style={{
          background: "#661F1F",
          padding: "14px 18px",
          display: "flex", alignItems: "center", gap: 12,
          position: "sticky", top: 0, zIndex: 50,
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}
      >
        <button
          onClick={() => navigate(`/invoices/${id}`)}
          style={{
            background: "rgba(255,255,255,0.15)", border: "none",
            borderRadius: 8, padding: 6, cursor: "pointer",
            display: "flex", color: "#FFFFFF",
          }}
        >
          <X size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFFFFF", fontSize: 15, fontWeight: 700, fontFamily: "'Courier New', monospace" }}>
            Edit — {inv?.invoiceNo || "Invoice"}
          </div>
          <div style={{ color: "#F0BABA", fontSize: 11, fontFamily: "Arial, sans-serif" }}>
            Step {step} of {STEPS.length} — {STEPS[step - 1].description}
          </div>
        </div>
        {/* Pending status indicator */}
        <div style={{ background: "rgba(255,200,100,0.25)", border: "1px solid #FFD888", borderRadius: 6, padding: "4px 10px" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#FFE080", letterSpacing: 0.5, fontFamily: "Arial, sans-serif" }}>
            PENDING
          </span>
        </div>
      </div>

      {/* ── DB locked banner ─────────────────────────────────── */}
      {dbLocked && (
        <div style={{ padding: "0 16px", maxWidth: 640, margin: "12px auto 0", width: "100%" }}>
          <DBLockedBanner lockedBy={dbLockedBy} />
        </div>
      )}

      {/* ── Info banner: editing context ─────────────────────── */}
      {!dbLocked && (
        <div style={{
          background: isDark ? "#1A2028" : "#EFF6FF",
          borderBottom: `1px solid ${isDark ? "#2A3A50" : "#BFDBFE"}`,
          padding: "10px 18px",
          display: "flex", gap: 8, alignItems: "center",
        }}>
          <AlertTriangle size={14} color="#0055CC" />
          <span style={{ fontSize: 12, color: isDark ? "#93C5FD" : "#1D4ED8", lineHeight: 1.4 }}>
            You are editing a pending invoice. Items, labour, and payment details can all be changed before approval. Inventory will not be deducted until the invoice is approved.
          </span>
        </div>
      )}

      {/* ── Step indicator ───────────────────────────────────── */}
      <div
        style={{
          background: cardBg,
          borderBottom: `1px solid ${border}`,
          padding: "12px 18px",
          overflowX: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "max-content" }}>
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isDone   = s.id < step;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                <div
                  onClick={() => isDone && setStep(s.id)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    cursor: isDone ? "pointer" : "default",
                    opacity: !isActive && !isDone ? 0.45 : 1,
                    minWidth: 54,
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: isDone ? "#1A7A1A" : isActive ? "#661F1F" : (isDark ? "#333" : "#E8E2DF"),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}>
                    {isDone
                      ? <span style={{ color: "#FFF", fontSize: 14 }}>✓</span>
                      : <Icon size={14} color={isActive ? "#FFF" : (isDark ? "#888" : "#666")} />
                    }
                  </div>
                  <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, color: isActive ? "#661F1F" : textSecondary, fontFamily: "Arial, sans-serif" }}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div style={{ width: 28, height: 2, background: s.id < step ? "#1A7A1A" : border, margin: "0 4px 16px" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Step content ─────────────────────────────────────── */}
      {!dbLocked && (
        <div style={{ flex: 1, padding: "16px", maxWidth: 640, margin: "0 auto", width: "100%", paddingBottom: 100, boxSizing: "border-box" }}>
          {saveSuccess ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle size={28} color="#1A7A1A" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#1A7A1A", margin: 0 }}>Changes saved!</p>
              <p style={{ fontSize: 13, color: textSecondary, margin: 0 }}>Returning to invoice…</p>
            </div>
          ) : (
            renderStep()
          )}
        </div>
      )}

      {/* ── Fixed bottom nav bar ─────────────────────────────── */}
      {!dbLocked && !saveSuccess && (
        <div
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: isDark ? "#1A1A1A" : "#FFFFFF",
            borderTop: `1px solid ${border}`,
            padding: "12px 16px",
            display: "flex", gap: 10,
            maxWidth: 640, margin: "0 auto",
            zIndex: 50, boxSizing: "border-box",
          }}
        >
          {/* Back / Cancel */}
          <button
            onClick={step === 1 ? () => navigate(`/invoices/${id}`) : handleBack}
            style={{
              flex: 1, padding: "11px 0", background: "none",
              border: `1.5px solid ${border}`, borderRadius: 10,
              color: textPrimary, fontWeight: 600, fontSize: 13,
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 5, fontFamily: "inherit",
            }}
          >
            <ArrowLeft size={14} />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {/* Next / Save */}
          {step < STEPS.length ? (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              style={{
                flex: 2, padding: "11px 0",
                background: canAdvance() ? "#661F1F" : (isDark ? "#333" : "#CCC"),
                border: "none", borderRadius: 10,
                color: "#FFFFFF", fontWeight: 700, fontSize: 13,
                cursor: canAdvance() ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 5, fontFamily: "inherit",
              }}
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={submitting}
              style={{
                flex: 2, padding: "11px 0",
                background: submitting ? "#888" : "#1A7A1A",
                border: "none", borderRadius: 10,
                color: "#FFFFFF", fontWeight: 700, fontSize: 13,
                cursor: submitting ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, fontFamily: "inherit",
              }}
            >
              <Save size={14} />
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          )}
        </div>
      )}

      {/* ── Submit error ──────────────────────────────────────── */}
      {submitError && (
        <div style={{
          position: "fixed", bottom: 76, left: 0, right: 0,
          maxWidth: 640, margin: "0 auto",
          padding: "0 16px",
          zIndex: 60,
        }}>
          <div style={{
            background: "#FFEBEE", border: "1px solid #FFCDD2",
            borderRadius: 8, padding: "10px 14px",
            color: "#CC0000", fontSize: 13,
          }}>
            ⚠ {submitError}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline Review Step ────────────────────────────────────────────────────────
function ReviewStep({ form, inv, isDark, border, textPrimary, textSecondary, cardBg }) {
  const items        = form.items || [];
  const labourCost   = parseFloat(form.labourCost || 0);
  const totalAmount  = parseFloat(form.totalAmount || 0);
  const amountPaid   = parseFloat(form.amountPaid || 0);
  const balanceDue   = Math.max(0, totalAmount - amountPaid);
  const discountAmt  = parseFloat(form.discountAmount || 0);

  const SectionCard = ({ title, children }) => (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#661F1F", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${border}`, fontFamily: "Arial, sans-serif" }}>
        {title}
      </div>
      {children}
    </div>
  );

  const Row = ({ label, value, mono, bold, amber, green, red }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
      <span style={{ fontSize: 12, color: textSecondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: amber ? "#CC6600" : green ? "#1A7A1A" : red ? "#CC0000" : textPrimary, fontFamily: mono ? "'Courier New', monospace" : "inherit" }}>
        {value}
      </span>
    </div>
  );

  return (
    <div>
      {/* Context banner */}
      <div style={{ background: isDark ? "#1A2A1A" : "#F0FFF0", border: "1.5px solid #A8D8A8", borderRadius: 10, padding: "11px 14px", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <CheckCircle size={15} color="#1A7A1A" style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: isDark ? "#A8D8A8" : "#1A5A1A", lineHeight: 1.5 }}>
          <strong>Review your changes.</strong> The invoice will stay in PENDING status. Approve it from the invoice detail screen when ready.
        </div>
      </div>

      {/* Customer (read-only, unchanged) */}
      <SectionCard title="Customer (unchanged)">
        <Row label="Name"  value={inv?.customerSnapshot?.name  || "—"} bold />
        <Row label="Phone" value={inv?.customerSnapshot?.phone || "—"} />
        {inv?.vehicleSnapshot?.registrationNo && (
          <Row label="Vehicle" value={inv.vehicleSnapshot.registrationNo} mono />
        )}
      </SectionCard>

      {/* Items */}
      <SectionCard title={`Items (${items.length})`}>
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: textSecondary, margin: 0 }}>No items added.</p>
        ) : (
          items.map((item, idx) => (
            <div
              key={idx}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, marginBottom: 8, borderBottom: idx < items.length - 1 ? `1px solid ${border}` : "none" }}
            >
              <div>
                <div style={{ fontSize: 13, color: textPrimary, fontWeight: 500 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: textSecondary }}>{item.quantity} × {formatCurrency(item.sellingPrice)}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#661F1F", fontFamily: "'Courier New', monospace" }}>
                {formatCurrency(item.sellingPrice * item.quantity)}
              </span>
            </div>
          ))
        )}
        {labourCost > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
            <span style={{ fontSize: 13, color: textPrimary }}>Labour</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#661F1F", fontFamily: "'Courier New', monospace" }}>
              {formatCurrency(labourCost)}
            </span>
          </div>
        )}
      </SectionCard>

      {/* Totals */}
      <SectionCard title="Totals & Payment">
        <Row label="Subtotal" value={formatCurrency(form.subtotal || 0)} mono />
        {form.gstEnabled && (
          <>
            <Row label="CGST (9%)" value={formatCurrency(form.cgst || 0)} mono />
            <Row label="SGST (9%)" value={formatCurrency(form.sgst || 0)} mono />
          </>
        )}
        {discountAmt > 0 && (
          <Row label="Discount" value={`- ${formatCurrency(discountAmt)}`} mono amber />
        )}
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 6, marginTop: 4 }}>
          <Row label="Total Amount" value={formatCurrency(totalAmount)} mono bold />
        </div>
        <Row label="Amount Paid"  value={formatCurrency(amountPaid)}  mono green />
        <Row label="Balance Due"  value={formatCurrency(balanceDue)}  mono red={balanceDue > 0} green={balanceDue === 0} bold />
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${border}` }}>
          <Row label="Payment Method" value={form.paymentMethod || "—"} />
          {form.paymentNote && <Row label="Payment Note" value={form.paymentNote} />}
          {form.loanProvider && <Row label="Loan / Finance Provider" value={form.loanProvider} />}
        </div>
      </SectionCard>
    </div>
  );
}
