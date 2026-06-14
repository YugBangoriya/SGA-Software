// SGA — Last updated: Fixed 2 logAudit() positional-argument calls — createQuotation and
// sendQuotationWhatsApp were calling logAudit("action", id, collection, {metadata}) which
// silently passed a string as the destructured parameter object, recording nothing.
// Both calls converted to the correct object form: logAudit({ action, userId, ... }).
// src/lib/quotationService.js
// Phase 5 — Quotation Module
// All Firestore, Storage, and Cloud Function operations for quotations.
// CRITICAL: No inventory reads or writes happen here. Quotations are
// purely pricing documents that never touch the /inventory collection.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "./firebase";
import { logAudit, AUDIT_ACTIONS } from "./auditService";

const QUOTATIONS_COLLECTION = "quotations";

// ─── Quotation Number Generator ───────────────────────────────────────────────
// Format: QT-YYYY-NNN (e.g., QT-2025-001)
// Uses a Firestore transaction on /systemConfig/quotationCounter to ensure
// sequential, collision-free numbering even with concurrent users.

export async function generateQuotationNumber() {
  const currentYear = new Date().getFullYear();
  const counterRef = doc(db, "systemConfig", "quotationCounter");

  const newNumber = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);

    if (!counterSnap.exists()) {
      transaction.set(counterRef, { lastNumber: 1, year: currentYear });
      return 1;
    }

    const data = counterSnap.data();

    if (data.year !== currentYear) {
      transaction.update(counterRef, { lastNumber: 1, year: currentYear });
      return 1;
    }

    const next = (data.lastNumber || 0) + 1;
    transaction.update(counterRef, { lastNumber: next });
    return next;
  });

  const paddedNumber = String(newNumber).padStart(3, "0");
  return `QT-${currentYear}-${paddedNumber}`;
}

// ─── Create Quotation ─────────────────────────────────────────────────────────

export async function createQuotation(quotationData, userId, userDisplayName) {
  const quotationNumber = await generateQuotationNumber();

  const payload = {
    quotationNumber,
    customerName: quotationData.customerName,
    customerPhone: quotationData.customerPhone,
    customerId: quotationData.customerId || null,
    vehicleCompany: quotationData.isManualVehicle
      ? quotationData.notInListCompany
      : quotationData.vehicleCompany,
    vehicleModel: quotationData.isManualVehicle
      ? quotationData.notInListModel
      : quotationData.vehicleModel,
    vehicleYear: quotationData.vehicleYear || "",
    isManualVehicle: quotationData.isManualVehicle || false,
    carRepositoryId: quotationData.carRepositoryId || null,
    carDriveLink: quotationData.carDriveLink || "",
    carReelLinks: quotationData.carReelLinks || [],
    lineItems: quotationData.lineItems.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.quantity) * Number(item.unitPrice),
    })),
    labourCost: Number(quotationData.labourCost || 0),
    totalAmount: quotationData.lineItems.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
      Number(quotationData.labourCost || 0)
    ),
    notes: quotationData.notes || "",
    pdfUrl: null,
    status: "draft",
    createdBy: userId,
    createdByName: userDisplayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    whatsappSentAt: null,
    whatsappSentTo: null,
  };

  const docRef = await addDoc(collection(db, QUOTATIONS_COLLECTION), payload);

  // FIX: was logAudit("quotation_created", docRef.id, QUOTATIONS_COLLECTION, {...})
  // which passed a string as the destructured object — action was never recorded.
  await logAudit({
    action:           AUDIT_ACTIONS.QUOTATION_CREATED,
    userId:           userId,
    userName:         userDisplayName || "Unknown",
    targetId:         docRef.id,
    targetCollection: QUOTATIONS_COLLECTION,
    metadata: {
      quotationNumber,
      customerName: payload.customerName,
      totalAmount:  payload.totalAmount,
    },
  });

  return { id: docRef.id, ...payload };
}

// ─── Fetch All Quotations ─────────────────────────────────────────────────────

export async function fetchQuotations() {
  const q = query(
    collection(db, QUOTATIONS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(200)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Fetch Single Quotation ───────────────────────────────────────────────────

export async function fetchQuotationById(quotationId) {
  const snap = await getDoc(doc(db, QUOTATIONS_COLLECTION, quotationId));
  if (!snap.exists()) throw new Error("Quotation not found");
  return { id: snap.id, ...snap.data() };
}

// ─── Delete Quotation ─────────────────────────────────────────────────────────

/**
 * Permanently delete a single quotation document.
 * Owner / SuperAdmin only (enforced by Firestore rules).
 * @param {string} quotationId — Firestore document ID
 * @param {object} user        — Firebase Auth user object (for audit log)
 */
export async function deleteQuotation(quotationId, user) {
  await deleteDoc(doc(db, QUOTATIONS_COLLECTION, quotationId));

  await logAudit({
    action:           "quotation.deleted",
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         quotationId,
    targetCollection: QUOTATIONS_COLLECTION,
    metadata:         {},
  });
}

// ─── Update Quotation PDF URL ─────────────────────────────────────────────────

export async function updateQuotationPdfUrl(quotationId, pdfUrl) {
  await updateDoc(doc(db, QUOTATIONS_COLLECTION, quotationId), {
    pdfUrl,
    updatedAt: serverTimestamp(),
  });
}

// ─── Update Quotation WhatsApp Status ─────────────────────────────────────────

export async function markQuotationWhatsAppSent(quotationId, phone) {
  await updateDoc(doc(db, QUOTATIONS_COLLECTION, quotationId), {
    status: "sent",
    whatsappSentAt: serverTimestamp(),
    whatsappSentTo: phone,
    updatedAt: serverTimestamp(),
  });
}

// ─── Upload Quotation PDF to Firebase Storage ─────────────────────────────────

export async function uploadQuotationPdf(pdfBlob, quotationNumber) {
  const fileName = `quotations/${quotationNumber}-${Date.now()}.pdf`;
  const storageRef = ref(storage, fileName);

  await uploadBytes(storageRef, pdfBlob, {
    contentType: "application/pdf",
    customMetadata: { quotationNumber },
  });

  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}

// ─── Send Quotation via WhatsApp (Cloud Function) ─────────────────────────────

export async function sendQuotationWhatsApp(
  quotationId, pdfUrl, customerPhone, customerName, quotationNumber, userId
) {
  const sendFn = httpsCallable(functions, "sendQuotationWhatsApp");

  const result = await sendFn({
    quotationId,
    pdfUrl,
    customerPhone,
    customerName,
    quotationNumber,
  });

  if (result.data.success) {
    await markQuotationWhatsAppSent(quotationId, customerPhone);

    // FIX: was logAudit("quotation_whatsapp_sent", quotationId, QUOTATIONS_COLLECTION, {...})
    // which passed a string as the destructured object — action was never recorded.
    await logAudit({
      action:           "quotation.whatsapp_sent",
      userId:           userId,
      userName:         null,   // display name not available in this function's signature
      targetId:         quotationId,
      targetCollection: QUOTATIONS_COLLECTION,
      metadata: {
        quotationNumber,
        customerPhone,
        customerName,
      },
    });
  }

  return result.data;
}

// ─── Notify SuperAdmin: Car Not In Repository ─────────────────────────────────

export async function notifyCarNotInRepository({
  vehicleCompany, vehicleModel, quotationId, quotationNumber, createdBy, createdByName,
}) {
  await addDoc(collection(db, "notifications"), {
    type: "car_not_in_repository",
    title: "New Car Model — Add to Repository",
    message: `Owner created quotation ${quotationNumber} with unregistered model: ${vehicleCompany} ${vehicleModel}`,
    vehicleCompany,
    vehicleModel,
    quotationId,
    quotationNumber,
    createdBy,
    createdByName,
    isRead: false,
    targetRole: "superadmin",
    createdAt: serverTimestamp(),
  });
}

// ─── Fetch Car Repository Data ─────────────────────────────────────────────────

export async function fetchCarRepository() {
  const snap = await getDocs(collection(db, "carRepository"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Fetch Business Settings ───────────────────────────────────────────────────

export async function fetchBusinessSettings() {
  const snap = await getDoc(doc(db, "settings", "main"));
  if (!snap.exists()) return null;
  return snap.data();
}

// ─── Search Existing Customers ─────────────────────────────────────────────────

export async function searchCustomers(searchQuery) {
  const snap = await getDocs(collection(db, "customers"));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const q = searchQuery.toLowerCase();
  return all
    .filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.vehicleNo?.toLowerCase().includes(q)
    )
    .slice(0, 10);
}