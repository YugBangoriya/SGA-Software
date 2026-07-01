// SGA — Last updated: PAYMENT_METHODS: PARTIAL renamed to DEBIT (auto-zero amount on select); PAYMENT_METHOD_LABELS map added for display; requiresPartialFields updated for backward compat
// of truth for logo resolution. It imports LOGO_BASE64 directly and guarantees it
// always returns a valid base64 logo string (either the fetched/converted Firebase
// Storage URL, or the embedded LOGO_BASE64 fallback). InvoicePDF.jsx and
// ReturnInvoicePDF.jsx retain their || LOGO_BASE64 safety-net but it is now
// unreachable under normal operation — the fallback is handled here first.
//
// This resolves the "Bugs Found But Not Fixed" note from the previous session:
// the previous enrichSettingsWithLogo() returned null on fetch failure, which
// relied on the PDF component's || LOGO_BASE64 to recover. That indirection is
// now replaced — this function never returns null for businessLogoUrl.
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
// Must be imported here (not only in the PDF components) so enrichSettingsWithLogo()
// can use it as the guaranteed fallback without the PDF component needing to know
// whether the upstream enrichment succeeded.
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
// SUPPORTS: discount field (flat rupee amount, applied after GST calculation)
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

export const PAYMENT_METHODS = [
  { value: "CASH",   label: "Cash" },
  { value: "UPI",    label: "UPI" },
  { value: "CARD",   label: "Card" },
  { value: "LOAN",   label: "Loan" },
  { value: "EMI",    label: "EMI" },
  { value: "DEBIT",  label: "Debit" },
];

// Human-readable labels for display in InvoiceDetail, PendingPayments, etc.
// Includes backward-compat entry for legacy "PARTIAL" invoices already in Firestore.
export const PAYMENT_METHOD_LABELS = {
  CASH:    "Cash",
  UPI:     "UPI",
  CARD:    "Card",
  LOAN:    "Loan",
  EMI:     "EMI",
  DEBIT:   "Debit",
  PARTIAL: "Partial Payment", // legacy — invoices created before the Debit rename
};

// Return invoice payment methods — no loan/emi for returns
export const RETURN_PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI",  label: "UPI" },
  { value: "CARD", label: "Card" },
];

export const requiresLoanFields    = (method) => ["LOAN", "EMI"].includes(method);
// PARTIAL kept for backward compat with pre-Debit invoices already in Firestore
export const requiresPartialFields = (method) => method === "PARTIAL" || method === "DEBIT";

// ── Derive paymentStatus from method + amounts ─────────────
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
//
//  WHY THIS EXISTS
//  ───────────────
//  @react-pdf/renderer v4.x in browser environments cannot reliably fetch
//  remote Firebase Storage URLs via its internal image loader due to CORS
//  restrictions. When a Storage URL is passed directly to <Image src={url} />,
//  the PDF renderer fails silently and renders a blank white box.
//
//  THE APPROACH
//  ────────────
//  Before generating any PDF, we call enrichSettingsWithLogo() which:
//    1. Fetches the Firebase Storage URL using the browser's native fetch()
//       (which respects CORS correctly for public Storage buckets).
//    2. Converts the response to a base64 data URI via FileReader.
//    3. Returns the enriched settings object where businessLogoUrl is now
//       a "data:image/...;base64,..." string — safe to pass to any PDF renderer.
//
//  FALLBACK CHAIN
//  ──────────────
//    Remote URL fetched OK  → use fetched base64
//    Remote URL fetch fails → use embedded LOGO_BASE64 (this file)
//    No URL set in Settings → use embedded LOGO_BASE64 (this file)
//
//  This function is the SINGLE place that decides which logo to use.
//  InvoicePDF.jsx and ReturnInvoicePDF.jsx both retain a || LOGO_BASE64 guard
//  as a defence-in-depth safety net, but it is unreachable under normal
//  operation because this function always resolves to a non-null base64 string.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetches a remote image URL and returns a base64 data URI.
 * Returns null on any failure (CORS, network error, non-OK response).
 * If the URL is already a data URI, returns it unchanged.
 */
async function fetchImageAsBase64(url) {
  if (!url || typeof url !== "string") return null;
  // Already a data URI — no fetch needed
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
    // CORS / network failure — fall through to LOGO_BASE64 below
    console.warn(
      "[invoiceHelpers] Logo fetch failed (CORS / network). " +
      "Using embedded fallback logo for PDF."
    );
    return null;
  }
}

/**
 * Returns a copy of businessSettings where businessLogoUrl is guaranteed to be
 * a valid base64 data URI (never a remote URL, never null).
 *
 * Fallback order:
 *   fetched base64 → LOGO_BASE64 (embedded)
 *
 * This is the only function that should be called before PDF generation.
 * Both generateAndDownloadPDF() and getPDFBlob() call this automatically.
 */
async function enrichSettingsWithLogo(businessSettings) {
  const biz = businessSettings || {};

  // No URL configured → use embedded logo
  if (!biz.businessLogoUrl) {
    return { ...biz, businessLogoUrl: LOGO_BASE64 };
  }

  // Already a data URI (e.g. from a previous enrichment or a test) → pass through
  if (biz.businessLogoUrl.startsWith("data:")) {
    return biz;
  }

  // Remote URL → fetch and convert; fall back to embedded on failure
  const base64 = await fetchImageAsBase64(biz.businessLogoUrl);
  return { ...biz, businessLogoUrl: base64 || LOGO_BASE64 };
}

// ── PDF generation & download ──────────────────────────────
/**
 * Generates an invoice (or return invoice) PDF, triggers a browser download,
 * and returns the Blob.
 *
 * Calls enrichSettingsWithLogo() before rendering so the PDF always has a
 * valid logo source — no CORS / blank-box issues.
 */
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

/**
 * Returns the invoice PDF as a Blob (used for WhatsApp upload).
 * Also calls enrichSettingsWithLogo() for the same reason as above.
 */
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