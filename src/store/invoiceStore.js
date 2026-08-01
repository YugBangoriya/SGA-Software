// SGA — Last updated: Multi-method payment support — createInvoice now initialises paymentEntries[] and totalPaid; added addPaymentEntry and deletePaymentEntry actions; existing actions and signatures unchanged for backward compatibility
// ============================================================
// invoiceStore.js — Zustand store for Invoice Module
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { create } from "zustand";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  arrayUnion,
  arrayRemove,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { logAudit, AUDIT_ACTIONS } from '../lib/auditService';
import { derivePaymentStatus, computeTotalPaid } from '../lib/invoiceHelpers';

// ── helpers ─────────────────────────────────────────────────
const INVOICE_COLLECTION = "invoices";
const INVENTORY_COLLECTION = "inventory";
const SYSTEM_CONFIG_COLLECTION = "systemConfig";
const SETTINGS_COLLECTION = "settings";

// ── Date helper: returns "DD-MM-YYYY" ──────────────────────
function getTodayDDMMYYYY() {
  const now = new Date();
  const dd   = String(now.getDate()).padStart(2, "0");
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function toDDMMYYYY(dateStr) {
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [yyyy, mm, dd] = dateStr.split("-");
    return `${dd}-${mm}-${yyyy}`;
  }
  return getTodayDDMMYYYY();
}

// Generate sequential invoice number: INV-DD-MM-YYYY-XXX
async function generateInvoiceNumber(invoiceDateStr) {
  const dateStr = toDDMMYYYY(invoiceDateStr);
  const prefix  = `INV-${dateStr}-`;

  const q = query(
    collection(db, INVOICE_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(500)
  );
  const snap = await getDocs(q);

  let maxSeq = 0;
  snap.docs.forEach((d) => {
    const no = d.data().invoiceNo || "";
    if (no.startsWith(prefix)) {
      const parts = no.split("-");
      const seq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

// Generate return invoice number: RETURN-INV-DD-MM-YYYY-XXX
async function generateReturnInvoiceNumber(returnDateStr) {
  const dateStr = toDDMMYYYY(returnDateStr);
  const prefix  = `RETURN-INV-${dateStr}-`;

  const q = query(
    collection(db, INVOICE_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(500)
  );
  const snap = await getDocs(q);

  let maxSeq = 0;
  snap.docs.forEach((d) => {
    const no = d.data().invoiceNo || "";
    if (no.startsWith(prefix)) {
      const parts = no.split("-");
      const seq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

// Payment statuses that mean "still owes money"
const PENDING_PAYMENT_STATUSES = ["PARTIALLY_PAID", "UNPAID", "EMI", "LOAN"];

// ── store ────────────────────────────────────────────────────

const useInvoiceStore = create((set, get) => ({
  // ── state ──────────────────────────────────────────────────
  invoices: [],
  pendingInvoices: [],
  pendingPaymentInvoices: [],
  currentInvoice: null,
  loading: false,
  error: null,
  dbLocked: false,
  dbLockedBy: null,
  gstNumber: "",
  businessSettings: null,
  unsubscribeInvoices: null,
  unsubscribeSystemConfig: null,

  // ── system config / DB lock ────────────────────────────────
  subscribeSystemConfig: () => {
    const unsub = onSnapshot(
      doc(db, SYSTEM_CONFIG_COLLECTION, "main"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          set({
            dbLocked: data.invoiceDbLocked || false,
            dbLockedBy: data.invoiceDbLockedBy || null,
          });
        }
      },
      (err) => console.error("SystemConfig listener error:", err)
    );
    set({ unsubscribeSystemConfig: unsub });
    return unsub;
  },

  // ── load settings (GST, business info) ─────────────────────
  loadSettings: async () => {
    try {
      const snap = await getDoc(doc(db, SETTINGS_COLLECTION, "main"));
      if (snap.exists()) {
        const data = snap.data();
        set({
          gstNumber: data.gstNumber || "",
          businessSettings: data,
        });
      }
    } catch (err) {
      console.error("Settings load error:", err);
    }
  },

  // ── real-time invoice listener ─────────────────────────────
  subscribeInvoices: (role) => {
    const { dbLocked } = get();
    if (dbLocked) {
      set({ invoices: [], error: "Database is currently locked by SuperAdmin." });
      return () => {};
    }

    const q = query(
      collection(db, INVOICE_COLLECTION),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const invoices = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const pending = invoices.filter((inv) => inv.status === "PENDING");
        const pendingPayments = invoices.filter((inv) =>
          PENDING_PAYMENT_STATUSES.includes(inv.paymentStatus)
        );
        set({ invoices, pendingInvoices: pending, pendingPaymentInvoices: pendingPayments });
      },
      (err) => {
        console.error("Invoice listener error:", err);
        set({ error: err.message });
      }
    );

    set({ unsubscribeInvoices: unsub });
    return unsub;
  },

  // ── load single invoice ────────────────────────────────────
  loadInvoice: async (id) => {
    set({ loading: true, error: null, currentInvoice: null });
    try {
      const snap = await getDoc(doc(db, INVOICE_COLLECTION, id));
      if (snap.exists()) {
        set({ currentInvoice: { id: snap.id, ...snap.data() }, loading: false });
      } else {
        set({ error: "Invoice not found.", loading: false });
      }
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ── create invoice ─────────────────────────────────────────
  // invoiceData is expected to include paymentEntries[] and totalPaid
  // (built by CreateInvoice.jsx before calling this action).
  createInvoice: async (invoiceData, currentUser) => {
    const { dbLocked } = get();
    if (dbLocked) throw new Error("Invoice database is currently locked.");
    if (!currentUser) throw new Error("Authentication error. Please log out and log in again.");

    set({ loading: true, error: null });
    try {
      const invoiceNo = await generateInvoiceNumber(invoiceData.invoiceDate);
      const createdByName =
        currentUser.displayName ||
        currentUser.email ||
        currentUser.uid ||
        "Unknown";

      // Ensure paymentEntries and totalPaid are always present in the document.
      // CreateInvoice.jsx is responsible for building these from the wizard form.
      // This guard ensures legacy callers that don't pass these fields still get
      // sensible defaults rather than undefined fields in Firestore.
      const paymentEntries = Array.isArray(invoiceData.paymentEntries)
        ? invoiceData.paymentEntries
        : [];
      const totalPaid =
        invoiceData.totalPaid != null
          ? invoiceData.totalPaid
          : parseFloat(invoiceData.amountPaid || 0);

      const payload = {
        ...invoiceData,
        paymentEntries,
        totalPaid,
        invoiceNo,
        status: "PENDING",
        createdBy: currentUser.uid,
        createdByName,
        approvedBy: null,
        approvedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, INVOICE_COLLECTION), payload);

      await logAudit({
        action:           AUDIT_ACTIONS.INVOICE_CREATED,
        userId:           currentUser.uid,
        userName:         createdByName,
        targetId:         ref.id,
        targetCollection: INVOICE_COLLECTION,
        metadata: {
          invoiceNo,
          customerName:  invoiceData.customerSnapshot?.name,
          totalAmount:   invoiceData.totalAmount,
          createdByName,
        },
      });

      set({ loading: false });
      return ref.id;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // ── approve invoice (owner/superadmin only) ────────────────
  approveInvoice: async (invoiceId, currentUser) => {
    const { dbLocked } = get();
    if (dbLocked) throw new Error("Invoice database is currently locked.");
    if (!currentUser) throw new Error("Authentication error. Please log out and log in again.");

    set({ loading: true, error: null });
    try {
      const invoiceSnap = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      if (!invoiceSnap.exists()) throw new Error("Invoice not found.");
      const invoice = invoiceSnap.data();

      if (invoice.status !== "PENDING") {
        throw new Error("Only PENDING invoices can be approved.");
      }

      const batch = writeBatch(db);

      batch.update(doc(db, INVOICE_COLLECTION, invoiceId), {
        status: "APPROVED",
        approvedBy: currentUser.uid,
        approvedByName: currentUser.displayName || currentUser.email,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (const item of invoice.items || []) {
        if (item.inventoryItemId) {
          batch.update(doc(db, INVENTORY_COLLECTION, item.inventoryItemId), {
            quantity: increment(-item.quantity),
            lastDeductedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();

      await logAudit({
        action:           AUDIT_ACTIONS.INVOICE_APPROVED,
        userId:           currentUser.uid,
        userName:         currentUser.displayName || currentUser.email || "Unknown",
        targetId:         invoiceId,
        targetCollection: INVOICE_COLLECTION,
        metadata: {
          invoiceNo:       invoice.invoiceNo,
          approvedByName:  currentUser.displayName || currentUser.email,
          totalAmount:     invoice.totalAmount,
          itemsDeducted:   invoice.items?.length || 0,
        },
      });

      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // ── reject invoice = delete ────────────────────────────────
  rejectInvoice: async (invoiceId, currentUser) => {
    if (!currentUser) throw new Error("Authentication error. Please log out and log in again.");
    set({ loading: true, error: null });
    try {
      const invoiceSnap = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      if (!invoiceSnap.exists()) throw new Error("Invoice not found.");
      const invoice = invoiceSnap.data();

      await logAudit({
        action:           "invoice.rejected",
        userId:           currentUser.uid,
        userName:         currentUser.displayName || currentUser.email || "Unknown",
        targetId:         invoiceId,
        targetCollection: INVOICE_COLLECTION,
        metadata: {
          invoiceNo:       invoice.invoiceNo,
          rejectedByName:  currentUser.displayName || currentUser.email,
        },
      });

      await deleteDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // ── delete invoice (owner/superadmin) ─────────────────────
  deleteInvoice: async (invoiceId, currentUser) => {
    if (!currentUser) throw new Error("Authentication error. Please log out and log in again.");
    set({ loading: true, error: null });
    try {
      const invoiceSnap = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      if (invoiceSnap.exists()) {
        await logAudit({
          action:           AUDIT_ACTIONS.INVOICE_DELETED,
          userId:           currentUser.uid,
          userName:         currentUser.displayName || currentUser.email || "Unknown",
          targetId:         invoiceId,
          targetCollection: INVOICE_COLLECTION,
          metadata: {
            invoiceNo:     invoiceSnap.data().invoiceNo,
            deletedByName: currentUser.displayName || currentUser.email,
          },
        });
      }
      await deleteDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // ── update payment status (legacy — kept for backward compat) ──
  // New code should prefer addPaymentEntry. This action remains valid for
  // bulk status corrections that don't require a new entry.
  updatePaymentStatus: async (invoiceId, updates, currentUser) => {
    if (!currentUser) throw new Error("Authentication error. Please log out and log in again.");
    set({ loading: true, error: null });
    try {
      await updateDoc(doc(db, INVOICE_COLLECTION, invoiceId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      const updatedByName =
        currentUser.displayName ||
        currentUser.email ||
        currentUser.uid ||
        "Unknown";

      await logAudit({
        action:           "invoice.payment_status_updated",
        userId:           currentUser.uid,
        userName:         updatedByName,
        targetId:         invoiceId,
        targetCollection: INVOICE_COLLECTION,
        metadata: {
          newPaymentStatus: updates.paymentStatus,
          updatedByName,
        },
      });

      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // ── addPaymentEntry ─────────────────────────────────────────
  // Appends a new payment entry to an invoice's paymentEntries[] array,
  // recomputes totalPaid, and re-derives paymentStatus atomically.
  //
  // entry shape: { id, amount, method, date, reference, recordedBy, recordedByName }
  // Built by buildPaymentEntry() in invoiceHelpers.jsx before calling this.
  addPaymentEntry: async (invoiceId, entry, currentUser) => {
    const { dbLocked } = get();
    if (dbLocked) throw new Error("Invoice database is currently locked.");
    if (!currentUser) throw new Error("Authentication error. Please log out and log in again.");

    set({ loading: true, error: null });
    try {
      // Read current invoice for validation and totalPaid recomputation.
      const invoiceSnap = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      if (!invoiceSnap.exists()) throw new Error("Invoice not found.");
      const invoice = invoiceSnap.data();

      if (invoice.status !== "APPROVED") {
        throw new Error("Payments can only be recorded on approved invoices.");
      }

      const entryAmount  = parseFloat(entry.amount || 0);
      const currentTotal = computeTotalPaid({ ...invoice, id: invoiceId });
      const invoiceTotal = parseFloat(invoice.totalAmount || 0);

      if (entryAmount <= 0) {
        throw new Error("Payment amount must be greater than zero.");
      }
      if (currentTotal + entryAmount > invoiceTotal + 0.01) {
        // 0.01 tolerance for floating-point rounding
        throw new Error(
          `Payment of ${entryAmount} would exceed the invoice total. Balance remaining: ₹${(invoiceTotal - currentTotal).toFixed(2)}.`
        );
      }

      const newTotalPaid = parseFloat((currentTotal + entryAmount).toFixed(2));
      const newPaymentStatus = derivePaymentStatus(
        invoice.paymentMethod,
        newTotalPaid,
        invoiceTotal
      );

      // Add the recordedAt timestamp before writing
      const entryWithTimestamp = {
        ...entry,
        recordedAt: new Date().toISOString(), // ISO string; serverTimestamp() not allowed inside arrayUnion
      };

      await updateDoc(doc(db, INVOICE_COLLECTION, invoiceId), {
        paymentEntries: arrayUnion(entryWithTimestamp),
        totalPaid:      newTotalPaid,
        paymentStatus:  newPaymentStatus,
        updatedAt:      serverTimestamp(),
      });

      const recordedByName =
        currentUser.displayName || currentUser.email || "Unknown";

      await logAudit({
        action:           "invoice.payment_entry_added",
        userId:           currentUser.uid,
        userName:         recordedByName,
        targetId:         invoiceId,
        targetCollection: INVOICE_COLLECTION,
        metadata: {
          invoiceNo:       invoice.invoiceNo,
          entryAmount,
          entryMethod:     entry.method,
          entryDate:       entry.date,
          newTotalPaid,
          newPaymentStatus,
          recordedByName,
        },
      });

      // Refresh the currentInvoice in the store so InvoiceDetail re-renders
      // immediately without waiting for the real-time listener to fire.
      const refreshed = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      if (refreshed.exists()) {
        set({ currentInvoice: { id: refreshed.id, ...refreshed.data() }, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // ── deletePaymentEntry ──────────────────────────────────────
  // Removes a payment entry by id from an invoice's paymentEntries[] array,
  // recomputes totalPaid, and re-derives paymentStatus atomically.
  deletePaymentEntry: async (invoiceId, entryId, currentUser) => {
    const { dbLocked } = get();
    if (dbLocked) throw new Error("Invoice database is currently locked.");
    if (!currentUser) throw new Error("Authentication error. Please log out and log in again.");

    set({ loading: true, error: null });
    try {
      const invoiceSnap = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      if (!invoiceSnap.exists()) throw new Error("Invoice not found.");
      const invoice = invoiceSnap.data();

      const currentEntries = Array.isArray(invoice.paymentEntries)
        ? invoice.paymentEntries
        : [];

      const entryToRemove = currentEntries.find((e) => e.id === entryId);
      if (!entryToRemove) throw new Error("Payment entry not found.");

      // Firestore arrayRemove requires the exact object to match.
      // Since entryToRemove comes directly from the document, it will match.
      const remainingEntries = currentEntries.filter((e) => e.id !== entryId);
      const newTotalPaid = parseFloat(
        remainingEntries.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0).toFixed(2)
      );
      const newPaymentStatus = derivePaymentStatus(
        invoice.paymentMethod,
        newTotalPaid,
        parseFloat(invoice.totalAmount || 0)
      );

      await updateDoc(doc(db, INVOICE_COLLECTION, invoiceId), {
        paymentEntries: arrayRemove(entryToRemove),
        totalPaid:      newTotalPaid,
        paymentStatus:  newPaymentStatus,
        updatedAt:      serverTimestamp(),
      });

      const deletedByName =
        currentUser.displayName || currentUser.email || "Unknown";

      await logAudit({
        action:           "invoice.payment_entry_deleted",
        userId:           currentUser.uid,
        userName:         deletedByName,
        targetId:         invoiceId,
        targetCollection: INVOICE_COLLECTION,
        metadata: {
          invoiceNo:       invoice.invoiceNo,
          deletedEntryId:  entryId,
          deletedAmount:   entryToRemove.amount,
          deletedMethod:   entryToRemove.method,
          newTotalPaid,
          newPaymentStatus,
          deletedByName,
        },
      });

      // Refresh currentInvoice in store
      const refreshed = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      if (refreshed.exists()) {
        set({ currentInvoice: { id: refreshed.id, ...refreshed.data() }, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // ── export invoices (SuperAdmin backup) ────────────────────
  exportInvoices: async () => {
    try {
      const snap = await getDocs(collection(db, INVOICE_COLLECTION));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("Export error:", err);
      throw err;
    }
  },

  // ── log PDF download ───────────────────────────────────────
  logPdfDownload: async (invoiceId, invoiceNo, currentUser) => {
    await logAudit({
      action:           "invoice.pdf_downloaded",
      userId:           currentUser.uid,
      userName:         currentUser.displayName || currentUser.email || "Unknown",
      targetId:         invoiceId,
      targetCollection: INVOICE_COLLECTION,
      metadata: {
        invoiceNo,
        downloadedByName: currentUser.displayName || currentUser.email,
      },
    });
  },

  // ── log WhatsApp send ──────────────────────────────────────
  logWhatsAppSent: async (invoiceId, invoiceNo, phone, currentUser) => {
    await logAudit({
      action:           "invoice.whatsapp_sent",
      userId:           currentUser.uid,
      userName:         currentUser.displayName || currentUser.email || "Unknown",
      targetId:         invoiceId,
      targetCollection: INVOICE_COLLECTION,
      metadata: {
        invoiceNo,
        sentToPhone:  phone,
        sentByName:   currentUser.displayName || currentUser.email,
      },
    });
  },

  // ── create return invoice ─────────────────────────────────────────────
  createReturnInvoice: async (invoiceData, currentUser) => {
    const { dbLocked } = get();
    if (dbLocked) throw new Error("Invoice database is currently locked.");
    if (!currentUser) throw new Error("Authentication error.");
    set({ loading: true, error: null });
    try {
      const invoiceNo = await generateReturnInvoiceNumber(invoiceData.returnDate);
      const createdByName = currentUser.displayName || currentUser.email || currentUser.uid || "Unknown";
      const returnItems = invoiceData.returnItems || [];
      const totalReturnAmount = parseFloat(
        returnItems.reduce((sum, i) => sum + parseFloat(i.returnPrice || 0) * parseInt(i.quantity || 0, 10), 0).toFixed(2)
      );
      const payload = {
        ...invoiceData,
        invoiceNo,
        invoiceType: "RETURN",
        status: "PENDING",
        paymentStatus: "UNPAID",
        totalReturnAmount,
        totalAmount: totalReturnAmount,
        paymentEntries: [],
        totalPaid: 0,
        createdBy: currentUser.uid,
        createdByName,
        approvedBy: null,
        approvedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, INVOICE_COLLECTION), payload);

      await logAudit({
        action:           "invoice.return_created",
        userId:           currentUser.uid,
        userName:         createdByName,
        targetId:         ref.id,
        targetCollection: INVOICE_COLLECTION,
        metadata: {
          invoiceNo,
          customerName:       invoiceData.customerSnapshot?.name,
          totalReturnAmount,
          createdByName,
          itemCount:          returnItems.length,
        },
      });

      set({ loading: false });
      return ref.id;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // ── approve return invoice (adds items BACK to inventory) ─────────────
  approveReturnInvoice: async (invoiceId, currentUser) => {
    const { dbLocked } = get();
    if (dbLocked) throw new Error("Invoice database is currently locked.");
    if (!currentUser) throw new Error("Authentication error.");
    set({ loading: true, error: null });
    try {
      const invoiceSnap = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      if (!invoiceSnap.exists()) throw new Error("Invoice not found.");
      const invoice = invoiceSnap.data();
      if (invoice.status !== "PENDING") throw new Error("Only PENDING return invoices can be approved.");
      const batch = writeBatch(db);
      batch.update(doc(db, INVOICE_COLLECTION, invoiceId), {
        status: "APPROVED",
        paymentStatus: "PAID",
        approvedBy: currentUser.uid,
        approvedByName: currentUser.displayName || currentUser.email,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      for (const item of invoice.returnItems || []) {
        if (item.inventoryItemId) {
          batch.update(doc(db, INVENTORY_COLLECTION, item.inventoryItemId), {
            quantity: increment(item.quantity),
            lastReturnedAt: serverTimestamp(),
            returnedQuantity: increment(item.quantity),
          });
        }
      }
      await batch.commit();

      await logAudit({
        action:           "invoice.return_approved",
        userId:           currentUser.uid,
        userName:         currentUser.displayName || currentUser.email || "Unknown",
        targetId:         invoiceId,
        targetCollection: INVOICE_COLLECTION,
        metadata: {
          invoiceNo:           invoice.invoiceNo,
          approvedByName:      currentUser.displayName || currentUser.email,
          totalReturnAmount:   invoice.totalReturnAmount,
          itemsRestocked:      invoice.returnItems?.length || 0,
        },
      });

      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // ── update invoice (owner/superadmin edit) ─────────────────
  updateInvoice: async (invoiceId, updates, currentUser) => {
    const { dbLocked } = get();
    if (dbLocked) throw new Error("Invoice database is currently locked.");
    if (!currentUser) throw new Error("Authentication error. Please log out and log in again.");

    set({ loading: true, error: null });
    try {
      const invoiceSnap = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      if (!invoiceSnap.exists()) throw new Error("Invoice not found.");

      const updatedByName =
        currentUser.displayName ||
        currentUser.email ||
        currentUser.uid ||
        "Unknown";

      await updateDoc(doc(db, INVOICE_COLLECTION, invoiceId), {
        ...updates,
        updatedAt: serverTimestamp(),
        lastEditedBy: currentUser.uid,
        lastEditedByName: updatedByName,
        lastEditedAt: serverTimestamp(),
      });

      await logAudit({
        action:           "invoice.edited",
        userId:           currentUser.uid,
        userName:         updatedByName,
        targetId:         invoiceId,
        targetCollection: INVOICE_COLLECTION,
        metadata: {
          invoiceNo:     invoiceSnap.data().invoiceNo,
          editedByName:  updatedByName,
          fieldsUpdated: Object.keys(updates),
        },
      });

      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  cleanup: () => {
    const { unsubscribeInvoices, unsubscribeSystemConfig } = get();
    if (unsubscribeInvoices) unsubscribeInvoices();
    if (unsubscribeSystemConfig) unsubscribeSystemConfig();
    set({
      invoices: [],
      pendingInvoices: [],
      pendingPaymentInvoices: [],
      currentInvoice: null,
      unsubscribeInvoices: null,
      unsubscribeSystemConfig: null,
    });
  },

  clearError: () => set({ error: null }),
}));

export default useInvoiceStore;