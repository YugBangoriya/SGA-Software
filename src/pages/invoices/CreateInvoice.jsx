// SGA — Last updated: Restored original step-indicator UI and card wrapper; updated handleSubmit to build paymentEntries[] + totalPaid; added additionalPaymentEntries to DEFAULT_FORM
// ============================================================
// CreateInvoice.jsx — 5-Step Invoice Creation Wizard
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Package, Wrench, CreditCard, CheckCircle, ArrowLeft, ArrowRight, X,
} from "lucide-react";
import useInvoiceStore from "../../store/invoiceStore";
import useAuthStore from "../../store/authStore";
import useThemeStore from "../../store/themeStore";
import InvoiceStepCustomer from "../../components/invoices/InvoiceStepCustomer";
import InvoiceStepItems from "../../components/invoices/InvoiceStepItems";
import InvoiceStepLabour from "../../components/invoices/InvoiceStepLabour";
import InvoiceStepPayment from "../../components/invoices/InvoiceStepPayment";
import InvoiceStepReview from "../../components/invoices/InvoiceStepReview";
import DBLockedBanner from "../../components/invoices/DBLockedBanner";
import { derivePaymentStatus, buildPaymentEntry } from "../../lib/invoiceHelpers";
import { createCustomer } from "../../lib/customerService";

// Default placeholder values — must match InvoiceStepCustomer.jsx + InvoiceStepReview.jsx
const UNNAMED_NAME_DEFAULT = "Cash Memo - Unnamed Customer";
const UNNAMED_PHONE_DEFAULT = "XXXXX-XXXXX";

const STEPS = [
  { id: 1, label: "Customer", icon: User,         description: "Select customer"   },
  { id: 2, label: "Items",    icon: Package,      description: "Add line items"    },
  { id: 3, label: "Labour",   icon: Wrench,       description: "Labour charges"    },
  { id: 4, label: "Payment",  icon: CreditCard,   description: "Payment details"   },
  { id: 5, label: "Review",   icon: CheckCircle,  description: "Review & submit"   },
];

const DEFAULT_FORM = {
  customerId: null,
  customerSnapshot: null,
  vehicleSnapshot: null,
  isUnnamed: false,
  items: [],
  labourCost: "",
  invoiceDate: new Date().toISOString().split("T")[0],
  dueDate: "",
  isDateOverridden: false,
  gstEnabled: false,
  paymentMethod: "CASH",
  amountPaid: "",
  paymentNote: "",
  loanProvider: "",
  emiAmount: "",
  loanCompletionDate: "",
  subtotal: 0,
  cgst: 0,
  sgst: 0,
  preDiscountTotal: 0,
  discountAmount: 0,
  totalAmount: 0,
  // Additional payment entries from the inline form in InvoiceStepPayment
  additionalPaymentEntries: [],
};

export default function CreateInvoice() {
  const navigate = useNavigate();
  const { firebaseUser: currentUser } = useAuthStore();
  const { theme } = useThemeStore();
  const { createInvoice, dbLocked, dbLockedBy, gstNumber, loading, error, clearError } = useInvoiceStore();
  const isDark = theme === "dark";

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Clear any stale invoice error (e.g. from a previous bad navigation)
  useEffect(() => {
    clearError();
  }, []);

  const bg = isDark ? "#1A1A1A" : "#CDCBC9";
  const cardBg = isDark ? "#2A2A2A" : "#FFFFFF";
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";

  // Merge partial form updates
  const updateForm = (updates) => {
    setForm((prev) => {
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

  // ── Step validation ──────────────────────────────────────
  const canAdvance = () => {
    if (step === 1) {
      // Allow advance if a named customer is selected OR unnamed option was chosen
      return !!form.customerId || !!form.isUnnamed;
    }
    if (step === 2) return form.items.length > 0;
    if (step === 3) return true; // Labour is optional
    if (step === 4) {
      if (!form.paymentMethod) return false;
      if (form.paymentMethod === "LOAN" || form.paymentMethod === "EMI") {
        return !!form.loanProvider;
      }
      return form.amountPaid !== "" && form.amountPaid !== undefined;
    }
    return true;
  };

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!currentUser) {
      setSubmitError("Authentication error. Please log out and log in again.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      // ── Unnamed customer: check if name/phone was changed ──
      let customerId = form.customerId;
      let customerSnapshot = { ...(form.customerSnapshot || {}) };
      let isUnnamed = form.isUnnamed;

      if (isUnnamed) {
        const snap = form.customerSnapshot || {};
        const nameChanged = snap.name && snap.name !== UNNAMED_NAME_DEFAULT;
        const phoneChanged = snap.phone && snap.phone !== UNNAMED_PHONE_DEFAULT;

        if (nameChanged || phoneChanged) {
          // Create a minimal customer record from the entered details
          const newCustomerId = await createCustomer({
            name: nameChanged ? snap.name : "",
            phone: phoneChanged ? snap.phone : "",
            altPhone: "",
            vehicleNo: form.vehicleSnapshot?.registrationNo || "",
            vehicleMake: form.vehicleSnapshot?.make || "",
            vehicleModel: form.vehicleSnapshot?.model || "",
            vehicleYear: form.vehicleSnapshot?.year || "",
            emissionCategory: form.vehicleSnapshot?.emissionCategory || "",
            cngKitBrand: "",
            cngKitModel: "",
            tankCapacity: "",
            advancers: [],
            addOns: [],
            installationDate: "",
            technicianName: "",
            notes: "Created automatically from unnamed invoice.",
            customFields: {},
            createdBy: currentUser.uid,
          });
          customerId = newCustomerId;
          customerSnapshot = { ...customerSnapshot, id: newCustomerId };
          isUnnamed = false;
        }
      }

      // ── Build paymentEntries from wizard form ─────────────
      // The wizard collects an initial payment via the flat fields
      // (paymentMethod + amountPaid). We convert this to the first entry in
      // paymentEntries[]. Additional entries come from the inline form in
      // InvoiceStepPayment (form.additionalPaymentEntries).
      const initialAmount = parseFloat(form.amountPaid || 0);
      const paymentEntries = [];

      // Only create an entry when there is actual money paid upfront.
      // LOAN and EMI invoices have no upfront cash — leave entries empty.
      if (
        initialAmount > 0 &&
        !["LOAN", "EMI"].includes(form.paymentMethod)
      ) {
        paymentEntries.push(
          buildPaymentEntry({
            amount:    initialAmount,
            method:    form.paymentMethod,
            date:      form.invoiceDate,
            reference: form.paymentNote || "",
            currentUser,
          })
        );
      }

      // Spread in any additional entries recorded via the inline form
      const additionalEntries = (form.additionalPaymentEntries || []).map((e) =>
        buildPaymentEntry({
          amount:    e.amount,
          method:    e.method,
          date:      form.invoiceDate,
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

      const invoiceData = {
        customerId,
        customerSnapshot,
        vehicleSnapshot:    form.vehicleSnapshot,
        isUnnamed,
        items:              form.items,
        labourCost:         parseFloat(form.labourCost || 0),
        invoiceDate:        form.invoiceDate,
        dueDate:            form.dueDate || "",
        isDateOverridden:   form.isDateOverridden || false,
        gstEnabled:         form.gstEnabled || false,
        subtotal:           form.subtotal    || 0,
        cgst:               form.cgst        || 0,
        sgst:               form.sgst        || 0,
        preDiscountTotal:   form.preDiscountTotal || 0,
        discountAmount:     form.discountAmount   || 0,
        totalAmount:        form.totalAmount      || 0,
        // New payment model
        paymentEntries,
        totalPaid,
        paymentStatus,
        // Legacy flat fields — kept for backward compat with PDF / reporting
        paymentMethod:      form.paymentMethod,
        amountPaid:         initialAmount,
        paymentNote:        form.paymentNote || "",
        loanProvider:       form.loanProvider || "",
        emiAmount:          form.emiAmount ? parseFloat(form.emiAmount) : null,
        loanCompletionDate: form.loanCompletionDate || "",
      };

      const invoiceId = await createInvoice(invoiceData, currentUser);
      navigate(`/invoices/${invoiceId}?created=true`);
    } catch (err) {
      setSubmitError(err.message || "Failed to create invoice. Please try again.");
      setSubmitting(false);
    }
  };

  // ── Step content ─────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 1:
        return <InvoiceStepCustomer data={form} onChange={updateForm} darkMode={isDark} />;
      case 2:
        return <InvoiceStepItems data={form} onChange={updateForm} darkMode={isDark} />;
      case 3:
        return <InvoiceStepLabour data={form} onChange={updateForm} darkMode={isDark} />;
      case 4:
        return (
          <InvoiceStepPayment
            data={form}
            onChange={updateForm}
            gstNumber={gstNumber}
            darkMode={isDark}
          />
        );
      case 5:
        // Pass onChange so the review step can propagate unnamed customer edits back up
        return <InvoiceStepReview data={form} onChange={updateForm} darkMode={isDark} />;
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Top bar ──────────────────────────────────────── */}
      <div
        style={{
          background: "#661F1F",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}
      >
        <button
          onClick={() => navigate("/invoices")}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: 8,
            padding: 6,
            cursor: "pointer",
            display: "flex",
            color: "#FFFFFF",
          }}
        >
          <X size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700 }}>
            New Invoice
          </div>
          <div style={{ color: "#F0BABA", fontSize: 11, fontFamily: "Arial, sans-serif" }}>
            Step {step} of {STEPS.length} — {STEPS[step - 1].description}
          </div>
        </div>
      </div>

      {/* ── Stepper ───────────────────────────────────────── */}
      <div
        style={{
          background: isDark ? "#2A2A2A" : "#FFFFFF",
          borderBottom: `1px solid ${border}`,
          padding: "14px 18px",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            minWidth: "max-content",
          }}
        >
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isDone = s.id < step;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                <div
                  onClick={() => isDone && setStep(s.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    cursor: isDone ? "pointer" : "default",
                    opacity: !isActive && !isDone ? 0.45 : 1,
                    minWidth: 54,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: isDone ? "#1A7A1A" : isActive ? "#661F1F" : (isDark ? "#333" : "#E8E2DF"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s",
                      boxShadow: isActive ? "0 2px 8px rgba(102,31,31,0.35)" : "none",
                    }}
                  >
                    {isDone ? (
                      <CheckCircle size={16} color="#FFFFFF" />
                    ) : (
                      <Icon size={15} color={isActive ? "#FFFFFF" : (isDark ? "#888" : "#999")} />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: isActive ? 700 : 500,
                      color: isDone ? "#1A7A1A" : isActive ? "#661F1F" : textSecondary,
                      fontFamily: "Arial, sans-serif",
                      letterSpacing: 0.3,
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    style={{
                      width: 24,
                      height: 2,
                      background: idx < step - 1 ? "#1A7A1A" : (isDark ? "#333" : "#E8E2DF"),
                      marginBottom: 14,
                      transition: "background 0.3s",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          padding: "18px 16px",
          maxWidth: 640,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {dbLocked && <DBLockedBanner lockedBy={dbLockedBy} />}

        {!dbLocked && (
          <div
            style={{
              background: cardBg,
              borderRadius: 14,
              padding: "18px 16px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
              border: `1px solid ${border}`,
            }}
          >
            {/* Step heading */}
            <div style={{ marginBottom: 18 }}>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#661F1F",
                  margin: 0,
                  marginBottom: 4,
                }}
              >
                {step === 1 && "Select Customer"}
                {step === 2 && "Add Line Items"}
                {step === 3 && "Labour Charges"}
                {step === 4 && "Payment Details"}
                {step === 5 && "Review & Submit"}
              </h2>
              <p style={{ fontSize: 13, color: textSecondary, margin: 0 }}>
                {step === 1 && "Search and select the customer for this invoice."}
                {step === 2 && "Add parts and products from inventory."}
                {step === 3 && "Add labour / installation charges."}
                {step === 4 && "Set payment method, amount, and invoice date."}
                {step === 5 && "Review all details before creating the invoice."}
              </p>
            </div>

            {/* Step content */}
            {renderStep()}

            {/* Error */}
            {(submitError || error) && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  background: "#FFEBEE",
                  borderRadius: 8,
                  border: "1px solid #FFCDD2",
                  color: "#CC0000",
                  fontSize: 13,
                }}
              >
                {submitError || error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom nav ─────────────────────────────────────── */}
      {!dbLocked && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: isDark ? "#1A1A1A" : "#FFFFFF",
            borderTop: `1px solid ${border}`,
            padding: "12px 18px",
            display: "flex",
            gap: 10,
            maxWidth: 640,
            width: "100%",
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          {step > 1 && (
            <button
              onClick={handleBack}
              style={{
                flex: 1,
                padding: "12px 0",
                background: "none",
                border: `1.5px solid ${border}`,
                borderRadius: 10,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontSize: 14,
                fontWeight: 600,
                color: textPrimary,
                fontFamily: "inherit",
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}

          {step < 5 ? (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              style={{
                flex: 2,
                padding: "12px 0",
                background: canAdvance() ? "#661F1F" : (isDark ? "#333" : "#E0D8D4"),
                border: "none",
                borderRadius: 10,
                cursor: canAdvance() ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontSize: 14,
                fontWeight: 700,
                color: canAdvance() ? "#FFFFFF" : textSecondary,
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || dbLocked}
              style={{
                flex: 2,
                padding: "13px 0",
                background: submitting ? "#888" : "#661F1F",
                border: "none",
                borderRadius: 10,
                cursor: submitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 15,
                fontWeight: 700,
                color: "#FFFFFF",
                fontFamily: "inherit",
                transition: "all 0.15s",
                boxShadow: submitting ? "none" : "0 3px 12px rgba(102,31,31,0.35)",
              }}
            >
              {submitting ? "Creating Invoice..." : "Create Invoice →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}