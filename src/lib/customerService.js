// SGA — Last updated: Added deleteCustomer function for individual record deletion feature
/**
 * customerService.js
 * All Firestore operations for the Customer Records module.
 * Also handles /settings reads for dropdown options and custom fields.
 *
 * BUG 1 FIX — fetchAllCustomers:
 *   Previously used orderBy('createdAt', 'desc') as a Firestore query constraint.
 *   Firestore silently EXCLUDES any document missing the field used in orderBy.
 *   A document added manually via Firebase Console without a createdAt field
 *   would simply disappear from the customer list with no error.
 *
 *   Fix: fetch all documents without orderBy, then sort client-side in JS.
 *   This guarantees every document is always returned regardless of whether
 *   it has createdAt. Documents missing the field are sorted to the end of
 *   the list rather than silently dropped.
 *
 *   Performance note: with the scale of this app (hundreds of customers max)
 *   a JS sort is negligible. The previous Firestore index is no longer needed
 *   for this query, though it can remain as it won't cause any harm.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './firebase';

const CUSTOMERS_COL = 'customers';

// ─── CUSTOMER CRUD ────────────────────────────────────────────────────────────

/**
 * Fetch all customers, sorted newest-first by createdAt (client-side).
 * Returns array of { id, ...data } objects.
 */
export const fetchAllCustomers = async () => {
  const snap = await getDocs(collection(db, CUSTOMERS_COL));
  const customers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  customers.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
    return tb - ta;
  });
  return customers;
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
    retestDates:  [],
    reminderLog:  [],
    customFields: data.customFields || {},
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
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
 * Permanently delete a customer record.
 * Only callable by Owner or SuperAdmin (enforced at Firestore rules level).
 * Returns the deleted customer's ID for optimistic local removal.
 *
 * @param {string} customerId — Firestore document ID to delete
 */
export const deleteCustomer = async (customerId) => {
  await deleteDoc(doc(db, CUSTOMERS_COL, customerId));
  return customerId;
};

/**
 * Append a re-test date entry to a customer's retestDates array.
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

export const fetchSettings = async () => {
  const snap = await getDoc(doc(db, 'settings', 'main'));
  return snap.exists() ? snap.data() : null;
};

export const updateSettings = async (data) => {
  const ref  = doc(db, 'settings', 'main');
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  } else {
    const { setDoc } = await import('firebase/firestore');
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() });
  }
};

// ─── SETTINGS — CUSTOM FIELDS ─────────────────────────────────────────────────

export const fetchCustomFields = async () => {
  const snap = await getDoc(doc(db, 'settings', 'customFields'));
  if (!snap.exists()) return [];
  return snap.data().fields || [];
};

export const saveCustomFields = async (fields) => {
  const { setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'settings', 'customFields'), {
    fields,
    updatedAt: serverTimestamp(),
  });
};

// ─── DEFAULT DROPDOWN VALUES ──────────────────────────────────────────────────

export const DEFAULT_DROPDOWN_OPTIONS = {
  cngKitBrands:     ['Lovato', 'Tomasetto', 'BRC', 'LANDI RENZO', 'Romano', 'other'],
  cngKitModels: {
    Lovato:         ['Easy Fast', 'Smart', 'Matrix'],
    Tomasetto:      ['Arctic', 'AT09'],
    BRC:            ['Sequent', 'Plug & Drive'],
    'LANDI RENZO':  ['EVO OBD', 'OMEGAS'],
    Romano:         ['CNG ECU Standard'],
    other:          [],
  },
  tankCapacities:   ['40', '50', '60', '65', '70', '80', '90', '100'],
  advancers:        ['Single Point', 'Multi Point', 'Sequential'],
  addOns:           ['Fuel Level Display', 'Remote Kit', 'Extra Pipe', 'Extended Warranty', 'Tank Cover'],
  technicians:      ['Ravi', 'Suresh', 'Mehul', 'Kiran'],
  emissionCategories: ['BS3', 'BS4', 'BS6', 'BS6 Phase 2'],
};