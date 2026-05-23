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
import { logAudit } from '../lib/auditService';

// ── helpers ─────────────────────────────────────────────────
const INVOICE_COLLECTION = "invoices";
const INVENTORY_COLLECTION = "inventory";
const SYSTEM_CONFIG_COLLECTION = "systemConfig";
const SETTINGS_COLLECTION = "settings";

// Generate sequential invoice number: INV-YYYY-NNNN
async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const q = query(
    collection(db, INVOICE_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  let seq = 1;
  if (!snap.empty) {
    const last = snap.docs[0].data().invoiceNo || "";
    const match = last.match(/INV-\d{4}-(\d+)/);
    if (match) seq = parseInt(match[1], 10) + 1;
  }
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

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
      doc(db, SYSTEM_CONFIG_COLLECTION, "global"),
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

  // ── load settings (GST) ────────────────────────────────────
  loadSettings: async () => {
    try {
      const snap = await getDoc(doc(db, SETTINGS_COLLECTION, "business"));
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
          ["PARTIALLY_PAID", "UNPAID", "EMI", "LOAN"].includes(inv.paymentStatus)
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
      const invoiceNo = await generateInvoiceNumber();
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

      await logAudit("invoice_created", ref.id, INVOICE_COLLECTION, {
        invoiceNo,
        customerName: invoiceData.customerSnapshot?.name,
        totalAmount: invoiceData.totalAmount,
        createdByName: payload.createdByName,
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
      // Load invoice to get items for deduction
      const invoiceSnap = await getDoc(doc(db, INVOICE_COLLECTION, invoiceId));
      if (!invoiceSnap.exists()) throw new Error("Invoice not found.");
      const invoice = invoiceSnap.data();

      if (invoice.status !== "PENDING") {
        throw new Error("Only PENDING invoices can be approved.");
      }

      // Batch: approve invoice + deduct inventory
      const batch = writeBatch(db);

      // Update invoice status
      batch.update(doc(db, INVOICE_COLLECTION, invoiceId), {
        status: "APPROVED",
        approvedBy: currentUser.uid,
        approvedByName: currentUser.displayName || currentUser.email,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Deduct inventory for each line item
      for (const item of invoice.items || []) {
        if (item.inventoryItemId) {
          batch.update(doc(db, INVENTORY_COLLECTION, item.inventoryItemId), {
            quantity: increment(-item.quantity),
            lastDeductedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();

      await logAudit("invoice_approved", invoiceId, INVOICE_COLLECTION, {
        invoiceNo: invoice.invoiceNo,
        approvedByName: currentUser.displayName || currentUser.email,
        totalAmount: invoice.totalAmount,
        itemsDeducted: invoice.items?.length || 0,
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

      await logAudit("invoice_rejected", invoiceId, INVOICE_COLLECTION, {
        invoiceNo: invoice.invoiceNo,
        rejectedByName: currentUser.displayName || currentUser.email,
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
        await logAudit("invoice_deleted", invoiceId, INVOICE_COLLECTION, {
          invoiceNo: invoiceSnap.data().invoiceNo,
          deletedByName: currentUser.displayName || currentUser.email,
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
      await logAudit("invoice_status_updated", invoiceId, INVOICE_COLLECTION, {
        newPaymentStatus: updates.paymentStatus,
        updatedByName,
      });

      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // ── log PDF download ───────────────────────────────────────
  logPdfDownload: async (invoiceId, invoiceNo, currentUser) => {
    await logAudit("invoice_pdf_downloaded", invoiceId, INVOICE_COLLECTION, {
      invoiceNo,
      downloadedByName: currentUser.displayName || currentUser.email,
    });
  },

  // ── log WhatsApp send ──────────────────────────────────────
  logWhatsAppSent: async (invoiceId, invoiceNo, phone, currentUser) => {
    await logAudit("invoice_whatsapp_sent", invoiceId, INVOICE_COLLECTION, {
      invoiceNo,
      sentToPhone: phone,
      sentByName: currentUser.displayName || currentUser.email,
    });
  },

  // ── cleanup ────────────────────────────────────────────────
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