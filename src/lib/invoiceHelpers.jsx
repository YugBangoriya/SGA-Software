// SGA — Last updated: Added discount support to calculateTotals; added return invoice helpers (RET_INV prefix, returnInvoice type)
// ============================================================
// invoiceHelpers.js — Invoice utility functions
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { pdf } from "@react-pdf/renderer";
import { getFunctions, httpsCallable } from "firebase/functions";
import InvoicePDFDocument from "../components/invoices/InvoicePDF";
import ReturnInvoicePDFDocument from "../components/invoices/ReturnInvoicePDF";

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
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
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
// NOW SUPPORTS: discount field (flat rupee amount, applied after GST calculation)
export const calculateTotals = ({ items = [], labourCost = 0, gstEnabled = false, discount = 0 }) => {
  const itemsTotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.sellingPrice || 0) * parseInt(item.quantity || 0, 10));
  }, 0);

  const subtotal = itemsTotal + parseFloat(labourCost || 0);
  const { cgst, sgst } = gstEnabled ? calculateGST(subtotal) : { cgst: 0, sgst: 0 };
  const preDiscountTotal = subtotal + cgst + sgst;
  const discountAmount = parseFloat(discount || 0);
  const totalAmount = Math.max(0, preDiscountTotal - discountAmount);

  return {
    itemsTotal: parseFloat(itemsTotal.toFixed(2)),
    subtotal: parseFloat(subtotal.toFixed(2)),
    cgst,
    sgst,
    preDiscountTotal: parseFloat(preDiscountTotal.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
  };
};

// ── Payment status label ───────────────────────────────────
export const PAYMENT_STATUS_LABELS = {
  PAID: "Paid",
  PARTIALLY_PAID: "Partially Paid",
  UNPAID: "Unpaid",
  EMI: "EMI",
  LOAN: "Loan",
};

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "LOAN", label: "Loan" },
  { value: "EMI", label: "EMI" },
  { value: "PARTIAL", label: "Partial Payment" },
];

// Return invoice payment methods (only cash/upi/card — no loan/emi for returns)
export const RETURN_PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
];

export const requiresLoanFields = (method) =>
  ["LOAN", "EMI"].includes(method);

export const requiresPartialFields = (method) =>
  method === "PARTIAL";

// ── Derive paymentStatus from method + amounts ─────────────
export const derivePaymentStatus = (method, amountPaid, totalAmount) => {
  if (method === "LOAN") return "LOAN";
  if (method === "EMI") return "EMI";
  const paid = parseFloat(amountPaid || 0);
  const total = parseFloat(totalAmount || 0);
  if (paid <= 0) return "UNPAID";
  if (paid >= total) return "PAID";
  return "PARTIALLY_PAID";
};

// ── Is a return invoice? ───────────────────────────────────
export const isReturnInvoice = (invoice) =>
  invoice?.invoiceType === "RETURN" ||
  invoice?.invoiceNo?.startsWith("RET_INV");

// ── PDF generation & download ──────────────────────────────
export const generateAndDownloadPDF = async (invoice, businessSettings) => {
  try {
    // Use return invoice PDF for return invoices
    const Component = isReturnInvoice(invoice) ? ReturnInvoicePDFDocument : InvoicePDFDocument;
    const blob = await pdf(
      <Component invoice={invoice} businessSettings={businessSettings} />
    ).toBlob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
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

// ── Get PDF blob (for WhatsApp upload) ────────────────────
export const getPDFBlob = async (invoice, businessSettings) => {
  const Component = isReturnInvoice(invoice) ? ReturnInvoicePDFDocument : InvoicePDFDocument;
  return pdf(
    <Component invoice={invoice} businessSettings={businessSettings} />
  ).toBlob();
};

// ── WhatsApp API trigger via Cloud Function ────────────────
export const sendInvoiceViaWhatsApp = async (invoiceId, phone) => {
  try {
    const functions = getFunctions();
    const sendFn = httpsCallable(functions, "sendInvoiceWhatsApp");
    const result = await sendFn({ invoiceId, phone });
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
    bg: "#F3E5F5",
    color: "#6A1B9A",
    dot: "#9C27B0",
  },
  APPROVED: {
    label: "Approved",
    bg: "#E3F2FD",
    color: "#0055CC",
    dot: "#1976D2",
  },
  PAID: {
    label: "Paid",
    bg: "#E8F5E9",
    color: "#1A7A1A",
    dot: "#4CAF50",
  },
  PARTIALLY_PAID: {
    label: "Partially Paid",
    bg: "#FFF3E0",
    color: "#CC6600",
    dot: "#FF9800",
  },
  UNPAID: {
    label: "Unpaid",
    bg: "#FFEBEE",
    color: "#CC0000",
    dot: "#F44336",
  },
  EMI: {
    label: "EMI",
    bg: "#E3F2FD",
    color: "#0055CC",
    dot: "#1976D2",
  },
  LOAN: {
    label: "Loan",
    bg: "#E3F2FD",
    color: "#0055CC",
    dot: "#1976D2",
  },
};

// ── Get display status (combined invoice + payment) ────────
export const getDisplayStatus = (invoice) => {
  if (invoice.status === "PENDING") return "PENDING";
  if (invoice.paymentStatus) return invoice.paymentStatus;
  return "APPROVED";
};
