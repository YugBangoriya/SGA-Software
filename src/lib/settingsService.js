// SGA — Last updated: deleteAllInvoices now skips invoices with pending payment (PARTIALLY_PAID, UNPAID, EMI, LOAN) — only fully-paid and return invoices are deleted during monthly backup
// src/lib/settingsService.js
// Central service for all /settings and /systemConfig Firestore operations
// Used by ALL modules that depend on settings values

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase"; // your existing firebase init

// ─── Collection / Doc References ──────────────────────────────────────────────
export const SETTINGS_DOC = () => doc(db, "settings", "main");
export const SYSTEM_CONFIG_DOC = () => doc(db, "systemConfig", "main");
export const CUSTOM_FIELDS_DOC = () => doc(db, "settings", "customFields");
export const FOLLOW_UP_TEMPLATES_COL = () => collection(db, "followUpTemplates");

// ─── Default Settings Shape ────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  // Business Info
  businessName: "Shree Ganesh Automobile",
  businessAddress: "",
  businessPhone: "",
  businessLogoUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  googleMapsUrl: "",

  // GST
  gstNumber: "", // empty = GST hidden everywhere

  // Low Stock
  globalLowStockThreshold: 5,

  // Dropdowns — all managed by Owner
  dropdowns: {
    cngKitBrands: ["Lovato", "Tomasetto", "BRC", "Landi Renzo", "Tartarini"],
    cngKitModels: ["Smart", "Classic", "Premium", "Eco"],
    addOns: ["Fly Cutter", "Tank Guard", "Extra Valve", "Remote Kit"],
    advancers: ["Standard", "Digital", "Premium"],
    vehicleEmissionCategories: ["BS4", "BS6", "BS3"],
    technicianNames: [],
    paymentTerms: [
      "Payment due on delivery.",
      "50% advance required before installation.",
      "Balance payment due within 7 days of installation.",
    ],
  },

  // Terms & Conditions for invoice PDF
  invoiceTermsAndConditions:
    "1. Goods once sold will not be returned.\n2. Warranty as per manufacturer terms.\n3. This is a computer-generated invoice.",

  updatedAt: null,
};

export const DEFAULT_SYSTEM_CONFIG = {
  invoiceDbLocked: false,
  invoiceDbLockedBy: null,
  invoiceDbLockedAt: null,
};

// ─── Payment statuses that mean payment is still pending ──────────────────────
// These invoices must NEVER be deleted during monthly backup.
// They stay in the system until the client collects the full payment.
const PENDING_PAYMENT_STATUSES = ["PARTIALLY_PAID", "UNPAID", "EMI", "LOAN"];

// ─── READ ──────────────────────────────────────────────────────────────────────

export async function fetchSettings() {
  const snap = await getDoc(SETTINGS_DOC());
  if (snap.exists()) return { ...DEFAULT_SETTINGS, ...snap.data() };
  // First run — seed defaults
  await setDoc(SETTINGS_DOC(), { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() });
  return DEFAULT_SETTINGS;
}

export async function fetchSystemConfig() {
  const snap = await getDoc(SYSTEM_CONFIG_DOC());
  if (snap.exists()) return { ...DEFAULT_SYSTEM_CONFIG, ...snap.data() };
  await setDoc(SYSTEM_CONFIG_DOC(), DEFAULT_SYSTEM_CONFIG);
  return DEFAULT_SYSTEM_CONFIG;
}

export async function fetchCustomFields() {
  const snap = await getDoc(CUSTOM_FIELDS_DOC());
  if (snap.exists()) return snap.data().fields || [];
  return [];
}

export async function fetchFollowUpTemplates() {
  const snap = await getDocs(FOLLOW_UP_TEMPLATES_COL());
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── WRITE — Business Info ─────────────────────────────────────────────────────

export async function saveBusinessInfo(data) {
  await updateDoc(SETTINGS_DOC(), {
    businessName: data.businessName,
    businessAddress: data.businessAddress,
    businessPhone: data.businessPhone,
    instagramUrl: data.instagramUrl,
    facebookUrl: data.facebookUrl,
    googleMapsUrl: data.googleMapsUrl,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadBusinessLogo(file) {
  const storageRef = ref(storage, "business/logo");
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await updateDoc(SETTINGS_DOC(), { businessLogoUrl: url, updatedAt: serverTimestamp() });
  return url;
}

// ─── WRITE — GST ──────────────────────────────────────────────────────────────

export async function saveGSTNumber(gstNumber) {
  await updateDoc(SETTINGS_DOC(), {
    gstNumber: gstNumber.trim(),
    updatedAt: serverTimestamp(),
  });
}

// ─── WRITE — Low Stock Default ────────────────────────────────────────────────

export async function saveGlobalLowStockThreshold(threshold) {
  await updateDoc(SETTINGS_DOC(), {
    globalLowStockThreshold: Number(threshold),
    updatedAt: serverTimestamp(),
  });
}

// ─── WRITE — Dropdowns ────────────────────────────────────────────────────────

export async function saveDropdownValues(category, values) {
  await updateDoc(SETTINGS_DOC(), {
    [`dropdowns.${category}`]: values,
    updatedAt: serverTimestamp(),
  });
}

// ─── WRITE — Terms & Conditions ───────────────────────────────────────────────

export async function saveTermsAndConditions(text) {
  await updateDoc(SETTINGS_DOC(), {
    invoiceTermsAndConditions: text,
    updatedAt: serverTimestamp(),
  });
}

// ─── WRITE — Follow-Up Templates ─────────────────────────────────────────────

export async function saveFollowUpTemplate(template) {
  const messageEn = template.messageEn ?? template.bodyEn ?? "";
  const messageHi = template.messageHi ?? template.bodyHi ?? "";
  const messageGu = template.messageGu ?? template.bodyGu ?? "";

  if (template.id) {
    const ref = doc(db, "followUpTemplates", template.id);
    await updateDoc(ref, {
      name: template.name,
      messageEn,
      messageHi,
      messageGu,
      updatedAt: serverTimestamp(),
    });
    return template.id;
  } else {
    const docRef = await addDoc(FOLLOW_UP_TEMPLATES_COL(), {
      name: template.name,
      messageEn,
      messageHi,
      messageGu,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }
}

export async function deleteFollowUpTemplate(templateId) {
  await deleteDoc(doc(db, "followUpTemplates", templateId));
}

// ─── WRITE — Custom Fields (SuperAdmin) ───────────────────────────────────────

export async function saveCustomFields(fields) {
  await setDoc(CUSTOM_FIELDS_DOC(), { fields, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── WRITE — System Config (Invoice DB Lock) ──────────────────────────────────

export async function setInvoiceDbLock(locked, lockedByName) {
  if (locked) {
    await updateDoc(SYSTEM_CONFIG_DOC(), {
      invoiceDbLocked: true,
      invoiceDbLockedBy: lockedByName,
      invoiceDbLockedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(SYSTEM_CONFIG_DOC(), {
      invoiceDbLocked: false,
      invoiceDbLockedBy: null,
      invoiceDbLockedAt: null,
    });
  }
}

// ─── WRITE — Delete All Invoices (Monthly Backup) ─────────────────────────────
//
// IMPORTANT: Only deletes invoices whose payment is fully settled.
// Invoices with pending payment status (PARTIALLY_PAID, UNPAID, EMI, LOAN)
// are KEPT in the database so the client can continue tracking outstanding balances.
//
// Eligible for deletion:
//   - paymentStatus === "PAID"          → regular paid invoices
//   - invoiceType === "RETURN" with status === "APPROVED" → approved return invoices
//   - Any PENDING invoices (not yet approved — no inventory impact)
//
// NOT deleted (kept for tracking):
//   - paymentStatus === "PARTIALLY_PAID"
//   - paymentStatus === "UNPAID"
//   - paymentStatus === "EMI"
//   - paymentStatus === "LOAN"
//
// Returns: { deleted: number, skipped: number } so the UI can show how many were kept.
export async function deleteAllInvoices() {
  const invoicesCol = collection(db, "invoices");
  const snap = await getDocs(invoicesCol);

  const toDelete = [];
  const toSkip   = [];

  snap.docs.forEach((d) => {
    const data = d.data();
    const isPendingPayment = PENDING_PAYMENT_STATUSES.includes(data.paymentStatus);
    if (isPendingPayment) {
      toSkip.push(d.id);
    } else {
      toDelete.push(d.ref);
    }
  });

  await Promise.all(toDelete.map((ref) => deleteDoc(ref)));

  return { deleted: toDelete.length, skipped: toSkip.length };
}