// SGA — Last updated: Fixed 9 logAudit() positional-argument calls — all calls in
// createInvoice, approveInvoice, rejectInvoice, deleteInvoice, updatePaymentStatus,
// logPdfDownload, logWhatsAppSent, createReturnInvoice, and approveReturnInvoice were
// calling logAudit("action", id, collection, {metadata}) which silently passed a string
// as the destructured parameter object, so action/userId/userName were all recorded as
// undefined. All 9 calls converted to the correct object form: logAudit({ action, userId, ... }).
// AUDIT_ACTIONS import added alongside existing logAudit import.
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
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { logAudit, AUDIT_ACTIONS } from '../lib/auditService';

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

// ── Date helper: converts a "YYYY-MM-DD" date string (as produced by
// <input type="date">) to "DD-MM-YYYY". Falls back to today's date if
// the value is missing or not in the expected format. Used so invoice
// numbering is based on the invoice's own (possibly back-dated) date,
// not the date the record was created. ──────────────────────────────
function toDDMMYYYY(dateStr) {
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [yyyy, mm, dd] = dateStr.split("-");
    return `${dd}-${mm}-${yyyy}`;
  }
  return getTodayDDMMYYYY();
}

// Generate sequential invoice number: INV-DD-MM-YYYY-XXX
// Date used is the invoice's own (possibly back-dated/overridden) invoiceDate,
// NOT the date the record is created. Serial number resets per that date.
async function generateInvoiceNumber(invoiceDateStr) {
  const dateStr = toDDMMYYYY(invoiceDateStr); // e.g. "02-04-2026"
  const prefix  = `INV-${dateStr}-`;

  // Query all invoices to find those from today with our prefix
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

// ── Payment statuses that mean "fully settled" ─────────────
// An invoice is eligible for export+delete if its payment is complete.
// Invoices with these statuses are EXCLUDED from bulk delete (still pending money).
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
    set({ loading: true, error: null });
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
      const payload = {
        ...invoiceData,
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

      // FIX: was logAudit("invoice_created", ref.id, INVOICE_COLLECTION, {...})
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

      // FIX: was logAudit("invoice_approved", invoiceId, INVOICE_COLLECTION, {...})
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

      // FIX: was logAudit("invoice_rejected", invoiceId, INVOICE_COLLECTION, {...})
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
        // FIX: was logAudit("invoice_deleted", invoiceId, INVOICE_COLLECTION, {...})
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

  // ── update payment status ──────────────────────────────────
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

      // FIX: was logAudit("invoice_status_updated", invoiceId, INVOICE_COLLECTION, {...})
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

  // ── log PDF download ───────────────────────────────────────
  logPdfDownload: async (invoiceId, invoiceNo, currentUser) => {
    // FIX: was logAudit("invoice_pdf_downloaded", invoiceId, INVOICE_COLLECTION, {...})
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
    // FIX: was logAudit("invoice_whatsapp_sent", invoiceId, INVOICE_COLLECTION, {...})
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
        createdBy: currentUser.uid,
        createdByName,
        approvedBy: null,
        approvedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, INVOICE_COLLECTION), payload);

      // FIX: was logAudit("return_invoice_created", ref.id, INVOICE_COLLECTION, {...})
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

      // FIX: was logAudit("return_invoice_approved", invoiceId, INVOICE_COLLECTION, {...})
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