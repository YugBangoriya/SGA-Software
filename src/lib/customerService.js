/**
 * customerService.js
 * All Firestore operations for the Customer Records module.
 * Also handles /settings reads for dropdown options and custom fields.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './firebase';

const CUSTOMERS_COL = 'customers';
const SETTINGS_DOC = 'settings/main';
const CUSTOM_FIELDS_DOC = 'settings/customFields';

// ─── CUSTOMER CRUD ────────────────────────────────────────────────────────────

/**
 * Fetch all customers ordered by createdAt desc.
 * Returns array of { id, ...data } objects.
 */
export const fetchAllCustomers = async () => {
  const q = query(collection(db, CUSTOMERS_COL), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Fetch a single customer by Firestore document ID.
 */
export const fetchCustomerById = async (id) => {
  const snap = await getDoc(doc(db, CUSTOMERS_COL, id));
  if (!snap.exists()) throw new Error('Customer not found');
  return { id: snap.id, ...snap.data() };
};

/**
 * Create a new customer document.
 * Returns the new document ID.
 */
export const createCustomer = async (data) => {
  const payload = {
    ...data,
    retestDates: [],       // Array of { retestDate, recordedAt, recordedBy, notes }
    reminderLog: [],       // Filled by Phase 9 (CNG Reminder System)
    customFields: data.customFields || {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, CUSTOMERS_COL), payload);
  return ref.id;
};

/**
 * Update an existing customer document.
 */
export const updateCustomer = async (id, data) => {
  await updateDoc(doc(db, CUSTOMERS_COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Append a re-test date entry to a customer's retestDates array.
 * Each entry: { retestDate: 'YYYY-MM-DD', recordedAt: Timestamp, recordedBy: uid, notes: string }
 */
export const addRetestDate = async (customerId, entry) => {
  await updateDoc(doc(db, CUSTOMERS_COL, customerId), {
    retestDates: arrayUnion({
      ...entry,
      recordedAt: new Date().toISOString(),
    }),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Replace the entire retestDates array (needed when editing a specific entry).
 */
export const updateRetestDates = async (customerId, retestDates) => {
  await updateDoc(doc(db, CUSTOMERS_COL, customerId), {
    retestDates,
    updatedAt: serverTimestamp(),
  });
};

// ─── SETTINGS — DROPDOWN OPTIONS ─────────────────────────────────────────────

/**
 * Fetch the settings/main document which holds Owner-managed dropdown values.
 * Returns the document data or null.
 *
 * Structure:
 * {
 *   cngKitBrands: string[],
 *   cngKitModels: { [brand]: string[] },
 *   tankCapacities: string[],
 *   advancers: string[],
 *   addOns: string[],
 *   technicians: string[],
 *   emissionCategories: string[],
 *   gstNumber: string,
 *   businessName: string,
 *   ... (other settings added in Phase 11)
 * }
 */
export const fetchSettings = async () => {
  const snap = await getDoc(doc(db, 'settings', 'main'));
  return snap.exists() ? snap.data() : null;
};

/**
 * Update the settings/main document (partial update).
 */
export const updateSettings = async (data) => {
  const ref = doc(db, 'settings', 'main');
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  } else {
    // First time — create it
    const { setDoc } = await import('firebase/firestore');
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() });
  }
};

// ─── SETTINGS — CUSTOM FIELDS ─────────────────────────────────────────────────

/**
 * Fetch SuperAdmin-defined custom fields schema.
 * Returns array of field definitions:
 * [{ id, label, type: 'text'|'number'|'date'|'select', options?: string[] }]
 */
export const fetchCustomFields = async () => {
  const snap = await getDoc(doc(db, 'settings', 'customFields'));
  if (!snap.exists()) return [];
  return snap.data().fields || [];
};

/**
 * Save the entire custom fields schema (SuperAdmin only).
 */
export const saveCustomFields = async (fields) => {
  const { setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'settings', 'customFields'), {
    fields,
    updatedAt: serverTimestamp(),
  });
};

// ─── DEFAULT DROPDOWN VALUES ──────────────────────────────────────────────────
// These are used when settings/main doesn't exist yet (fresh install).
// Owner can edit these from Settings after first login.

export const DEFAULT_DROPDOWN_OPTIONS = {
  cngKitBrands: ['Lovato', 'Tomasetto', 'BRC', 'LANDI RENZO', 'Romano', 'other'],
  cngKitModels: {
    Lovato: ['Easy Fast', 'Smart', 'Matrix'],
    Tomasetto: ['Arctic', 'AT09'],
    BRC: ['Sequent', 'Plug & Drive'],
    'LANDI RENZO': ['EVO OBD', 'OMEGAS'],
    Romano: ['CNG ECU Standard'],
    other: [],
  },
  tankCapacities: ['40', '50', '60', '65', '70', '80', '90', '100'],
  advancers: ['Single Point', 'Multi Point', 'Sequential'],
  addOns: ['Fuel Level Display', 'Remote Kit', 'Extra Pipe', 'Extended Warranty', 'Tank Cover'],
  technicians: ['Ravi', 'Suresh', 'Mehul', 'Kiran'],
  emissionCategories: ['BS3', 'BS4', 'BS6', 'BS6 Phase 2'],
};
