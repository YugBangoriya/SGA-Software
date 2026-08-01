// SGA — Last updated: Multi-method payment support — added computeTotalPaid (backward-compat shim), buildPaymentEntry factory, BANK_TRANSFER to PAYMENT_METHODS and PAYMENT_METHOD_LABELS; derivePaymentStatus signature unchanged, all callers now pass computeTotalPaid result
// ============================================================
// invoiceHelpers.jsx — Invoice utility functions
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { pdf } from "@react-pdf/renderer";
import { getFunctions, httpsCallable } from "firebase/functions";
import InvoicePDFDocument from "../components/invoices/InvoicePDF";
import ReturnInvoicePDFDocument from "../components/invoices/ReturnInvoicePDF";

// Embedded fallback logo — used when no businessLogoUrl is set in Settings,
// or when the Firebase Storage fetch fails (CORS / network error).
import LOGO_BASE64 from "../assets/logo_base64";

// ── Currency formatter ─────────────────────────────────────
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

// ── Date formatters ────────────────────────────────────────
export const formatDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateShort = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const toISODateString = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().split("T")[0];
};

export const fromDateString = (str) => {
  if (!str) return null;
  return new Date(str);
};

// ── GST calculation ────────────────────────────────────────
export const GST_RATE = 0.09; // 9% CGST + 9% SGST = 18% total

export const calculateGST = (subtotal) => {
  const cgst = parseFloat((subtotal * GST_RATE).toFixed(2));
  const sgst = parseFloat((subtotal * GST_RATE).toFixed(2));
  return { cgst, sgst, total: cgst + sgst };
};

// ── Invoice totals calculator ──────────────────────────────
export const calculateTotals = ({
  items = [],
  labourCost = 0,
  gstEnabled = false,
  discount = 0,
}) => {
  const itemsTotal = items.reduce((sum, item) => {
    return sum + parseFloat(item.sellingPrice || 0) * parseInt(item.quantity || 0, 10);
  }, 0);

  const subtotal = itemsTotal + parseFloat(labourCost || 0);
  const { cgst, sgst } = gstEnabled
    ? calculateGST(subtotal)
    : { cgst: 0, sgst: 0 };
  const preDiscountTotal = subtotal + cgst + sgst;
  const discountAmount = parseFloat(discount || 0);
  const totalAmount = Math.max(0, preDiscountTotal - discountAmount);

  return {
    itemsTotal:       parseFloat(itemsTotal.toFixed(2)),
    subtotal:         parseFloat(subtotal.toFixed(2)),
    cgst,
    sgst,
    preDiscountTotal: parseFloat(preDiscountTotal.toFixed(2)),
    discountAmount:   parseFloat(discountAmount.toFixed(2)),
    totalAmount:      parseFloat(totalAmount.toFixed(2)),
  };
};

// ── Payment status labels ──────────────────────────────────
export const PAYMENT_STATUS_LABELS = {
  PAID:           "Paid",
  PARTIALLY_PAID: "Partially Paid",
  UNPAID:         "Unpaid",
  EMI:            "EMI",
  LOAN:           "Loan",
};

// ── Payment methods ────────────────────────────────────────
// BANK_TRANSFER added for multi-method payment support.
export const PAYMENT_METHODS = [
  { value: "CASH",          label: "Cash" },
  { value: "UPI",           label: "UPI" },
  { value: "CARD",          label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "LOAN",          label: "Loan" },
  { value: "EMI",           label: "EMI" },
  { value: "DEBIT",         label: "Debit" },
];

// Payment methods valid for individual entries (excludes LOAN/EMI which are
// invoice-level financing arrangements, not individual cash transactions).
export const ENTRY_PAYMENT_METHODS = [
  { value: "CASH",          label: "Cash" },
  { value: "UPI",           label: "UPI" },
  { value: "CARD",          label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "DEBIT",         label: "Debit" },
];

// Human-readable labels for display in InvoiceDetail, PendingPayments, etc.
export const PAYMENT_METHOD_LABELS = {
  CASH:          "Cash",
  UPI:           "UPI",
  CARD:          "Card",
  BANK_TRANSFER: "Bank Transfer",
  LOAN:          "Loan",
  EMI:           "EMI",
  DEBIT:         "Debit",
  PARTIAL:       "Partial Payment", // legacy — invoices created before the Debit rename
};

// Return invoice payment methods — no loan/emi for returns
export const RETURN_PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI",  label: "UPI" },
  { value: "CARD", label: "Card" },
];

export const requiresLoanFields    = (method) => ["LOAN", "EMI"].includes(method);
export const requiresPartialFields = (method) => method === "PARTIAL" || method === "DEBIT";

// ── computeTotalPaid — backward-compat shim ────────────────
// Single source of truth for "how much has been paid on this invoice."
//
// Priority order (critical — do not change):
//
//  1. invoice.totalPaid  — the denormalised sum written atomically by
//     createInvoice, addPaymentEntry, and deletePaymentEntry. This is the
//     most reliable value because it correctly accounts for the migration
//     scenario: an old invoice (amountPaid: 10000, no paymentEntries) receives
//     its first new entry (25000). addPaymentEntry computes newTotalPaid = 35000
//     and writes paymentEntries: [25000] + totalPaid: 35000 atomically. If we
//     summed paymentEntries first we would return 25000 — wrong. totalPaid
//     always reflects the true cumulative paid amount.
//
//  2. sum of paymentEntries[] — used only when totalPaid is absent (e.g. a
//     brand-new invoice document read from the listener before the createInvoice
//     write fully propagates, which is extremely rare in practice).
//
//  3. invoice.amountPaid  — legacy scalar on pre-entries invoices that have
//     never had a payment entry recorded against them.
//
// Call this everywhere instead of `invoice.amountPaid` directly.
export const computeTotalPaid = (invoice) => {
  if (!invoice) return 0;

  // Priority 1 — denormalised totalPaid (set by every write that touches payments)
  if (invoice.totalPaid != null) return parseFloat(invoice.totalPaid || 0);

  // Priority 2 — sum entries array (new invoice not yet propagated, very rare)
  if (Array.isArray(invoice.paymentEntries) && invoice.paymentEntries.length > 0) {
    return parseFloat(
      invoice.paymentEntries
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
        .toFixed(2)
    );
  }

  // Priority 3 — legacy scalar amountPaid (pre-entries invoices with no writes yet)
  return parseFloat(invoice.amountPaid || 0);
};

// ── buildPaymentEntry — factory ────────────────────────────
// Creates a validated payment entry object ready to be appended to
// an invoice's paymentEntries[] array.
export const buildPaymentEntry = ({ amount, method, date, reference = "", currentUser = null }) => ({
  id:          crypto.randomUUID(),
  amount:      parseFloat(amount || 0),
  method:      method || "CASH",
  date:        date || new Date().toISOString().split("T")[0],
  reference:   (reference || "").trim(),
  recordedBy:  currentUser?.uid   || "",
  recordedByName: currentUser?.displayName || currentUser?.email || "",
});

// ── Derive paymentStatus from method + amounts ─────────────
// Signature is intentionally unchanged. All callers should now pass
// computeTotalPaid(invoice) as the amountPaid argument.
export const derivePaymentStatus = (method, amountPaid, totalAmount) => {
  if (method === "LOAN") return "LOAN";
  if (method === "EMI")  return "EMI";
  const paid  = parseFloat(amountPaid  || 0);
  const total = parseFloat(totalAmount || 0);
  if (paid <= 0)    return "UNPAID";
  if (paid >= total)return "PAID";
  return "PARTIALLY_PAID";
};

// ── Is a return invoice? ───────────────────────────────────
export const isReturnInvoice = (invoice) =>
  invoice?.invoiceType === "RETURN" ||
  invoice?.invoiceNo?.startsWith("RET_INV");

// ══════════════════════════════════════════════════════════════════════════════
//  LOGO PRE-FETCH — SINGLE SOURCE OF TRUTH
// ══════════════════════════════════════════════════════════════════════════════
async function fetchImageAsBase64(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("data:")) return url;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    console.warn(
      "[invoiceHelpers] Logo fetch failed (CORS / network). " +
      "Using embedded fallback logo for PDF."
    );
    return null;
  }
}

async function enrichSettingsWithLogo(businessSettings) {
  const biz = businessSettings || {};
  if (!biz.businessLogoUrl) {
    return { ...biz, businessLogoUrl: LOGO_BASE64 };
  }
  if (biz.businessLogoUrl.startsWith("data:")) {
    return biz;
  }
  const base64 = await fetchImageAsBase64(biz.businessLogoUrl);
  return { ...biz, businessLogoUrl: base64 || LOGO_BASE64 };
}

// ── PDF generation & download ──────────────────────────────
export const generateAndDownloadPDF = async (invoice, businessSettings) => {
  try {
    const enrichedSettings = await enrichSettingsWithLogo(businessSettings);
    const Component = isReturnInvoice(invoice)
      ? ReturnInvoicePDFDocument
      : InvoicePDFDocument;
    const blob = await pdf(
      <Component invoice={invoice} businessSettings={enrichedSettings} />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = `${invoice.invoiceNo || "Invoice"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return blob;
  } catch (err) {
    console.error("PDF generation error:", err);
    throw err;
  }
};

export const getPDFBlob = async (invoice, businessSettings) => {
  const enrichedSettings = await enrichSettingsWithLogo(businessSettings);
  const Component = isReturnInvoice(invoice)
    ? ReturnInvoicePDFDocument
    : InvoicePDFDocument;
  return pdf(
    <Component invoice={invoice} businessSettings={enrichedSettings} />
  ).toBlob();
};

// ── WhatsApp API trigger via Cloud Function ────────────────
export const sendInvoiceViaWhatsApp = async (invoiceId, phone) => {
  try {
    const functions = getFunctions();
    const sendFn    = httpsCallable(functions, "sendInvoiceWhatsApp");
    const result    = await sendFn({ invoiceId, phone });
    return result.data;
  } catch (err) {
    console.error("WhatsApp send error:", err);
    throw err;
  }
};

// ── Default terms & conditions ─────────────────────────────
export const DEFAULT_TERMS = `1. All goods sold are subject to warranty as per manufacturer terms.
2. Goods once sold will not be taken back.
3. Payment due within 30 days from invoice date.
4. In case of disputes, jurisdiction shall be Ahmedabad, Gujarat.
5. Thank you for choosing Shree Ganesh Automobile!`;

// ── Status badge config ────────────────────────────────────
export const STATUS_BADGE_CONFIG = {
  PENDING: {
    label: "Pending Approval",
    bg:    "#F3E5F5",
    color: "#6A1B9A",
    dot:   "#9C27B0",
  },
  APPROVED: {
    label: "Approved",
    bg:    "#E3F2FD",
    color: "#0055CC",
    dot:   "#1976D2",
  },
  PAID: {
    label: "Paid",
    bg:    "#E8F5E9",
    color: "#1A7A1A",
    dot:   "#4CAF50",
  },
  PARTIALLY_PAID: {
    label: "Partially Paid",
    bg:    "#FFF3E0",
    color: "#CC6600",
    dot:   "#FF9800",
  },
  UNPAID: {
    label: "Unpaid",
    bg:    "#FFEBEE",
    color: "#CC0000",
    dot:   "#F44336",
  },
  EMI: {
    label: "EMI",
    bg:    "#E3F2FD",
    color: "#0055CC",
    dot:   "#1976D2",
  },
  LOAN: {
    label: "Loan",
    bg:    "#E3F2FD",
    color: "#0055CC",
    dot:   "#1976D2",
  },
};

// ── Get display status (combined invoice + payment) ────────
export const getDisplayStatus = (invoice) => {
  if (invoice.status === "PENDING") return "PENDING";
  if (invoice.paymentStatus)        return invoice.paymentStatus;
  return "APPROVED";
};