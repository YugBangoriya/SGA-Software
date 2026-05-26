// SGA — Last updated: Added deleteInventoryItem function for individual item deletion feature
/**
 * Inventory Service — Shree Ganesh Automobile
 * All Firestore read/write operations for the Inventory module.
 *
 * CRITICAL RULE (from PRD §3.5.3):
 *   Inventory quantity is NEVER deducted here during invoice creation.
 *   Deduction happens ONLY when an Owner approves an invoice (Phase 4).
 *
 * Collections:
 *   /inventory                  — main item documents
 *   /inventory/{id}/restockHistory — per-item batch history (subcollection)
 *   /inventoryCategories        — category list
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  increment,
  runTransaction,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { logAudit } from './auditService';

const INV  = 'inventory';
const CATS = 'inventoryCategories';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const toTimestamp = (dateStr) =>
  dateStr ? Timestamp.fromDate(new Date(dateStr)) : null;

const docToItem = (snap) => ({ id: snap.id, ...snap.data() });

// ─── READ ──────────────────────────────────────────────────────────────────────

export const getInventoryItems = async () => {
  const q = query(collection(db, INV), orderBy('itemName', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToItem);
};

export const getInventoryItem = async (itemId) => {
  const snap = await getDoc(doc(db, INV, itemId));
  if (!snap.exists()) throw new Error('Item not found');
  return docToItem(snap);
};

export const getRestockHistory = async (itemId) => {
  const q = query(
    collection(db, INV, itemId, 'restockHistory'),
    orderBy('addedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToItem);
};

export const getLowStockItems = async () => {
  const items = await getInventoryItems();
  return items.filter((item) => item.quantity <= (item.lowStockThreshold ?? 5));
};

// ─── ADD NEW ITEM (Owner / SuperAdmin only) ────────────────────────────────────

export const addInventoryItem = async ({ itemData, user }) => {
  const {
    itemName,
    categoryId,
    quantityAdded,
    purchasePrice,
    dateOrderedOrReceived,
    vendorName,
    lowStockThreshold,
    isDateManuallySet,
    notes,
  } = itemData;

  const orderTimestamp = dateOrderedOrReceived
    ? toTimestamp(dateOrderedOrReceived)
    : serverTimestamp();

  const newItem = {
    itemName:              itemName.trim(),
    categoryId:            categoryId || '',
    quantity:              Number(quantityAdded),
    purchasePrice:         Number(purchasePrice),
    lowStockThreshold:     Number(lowStockThreshold) || 5,
    vendorName:            vendorName?.trim() || '',
    lastRestockedDate:     orderTimestamp,
    isLastDateManuallySet: isDateManuallySet ?? false,
    notes:                 notes?.trim() || '',
    createdAt:             serverTimestamp(),
    createdBy:             user.uid,
    createdByName:         user.displayName || user.email,
    lastUpdatedAt:         serverTimestamp(),
    lastUpdatedBy:         user.uid,
  };

  const itemRef = await addDoc(collection(db, INV), newItem);

  await addDoc(collection(db, INV, itemRef.id, 'restockHistory'), {
    date:             orderTimestamp,
    quantityAdded:    Number(quantityAdded),
    purchasePrice:    Number(purchasePrice),
    vendorName:       vendorName?.trim() || '',
    notes:            notes?.trim() || '',
    addedBy:          user.uid,
    addedByName:      user.displayName || user.email,
    addedAt:          serverTimestamp(),
    isDateManuallySet: isDateManuallySet ?? false,
    entryType:        'INITIAL',
  });

  await logAudit({
    action:            'inventory.added',
    userId:            user.uid,
    userName:          user.displayName || user.email,
    targetId:          itemRef.id,
    targetCollection:  INV,
    metadata: {
      itemName,
      quantityAdded: Number(quantityAdded),
      purchasePrice: Number(purchasePrice),
      categoryId,
    },
  });

  return itemRef.id;
};

// ─── REPLENISH EXISTING ITEM ──────────────────────────────────────────────────

export const replenishInventoryItem = async ({ itemId, replenishData, user }) => {
  const {
    quantityAdded,
    purchasePrice,
    dateOrderedOrReceived,
    vendorName,
    isDateManuallySet,
    notes,
  } = replenishData;

  const orderTimestamp = dateOrderedOrReceived
    ? toTimestamp(dateOrderedOrReceived)
    : serverTimestamp();

  await runTransaction(db, async (transaction) => {
    const itemRef = doc(db, INV, itemId);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) throw new Error('Inventory item not found');

    transaction.update(itemRef, {
      quantity:              increment(Number(quantityAdded)),
      purchasePrice:         Number(purchasePrice),
      vendorName:            vendorName?.trim() || itemSnap.data().vendorName || '',
      lastRestockedDate:     orderTimestamp,
      isLastDateManuallySet: isDateManuallySet ?? false,
      lastUpdatedAt:         serverTimestamp(),
      lastUpdatedBy:         user.uid,
    });
  });

  await addDoc(collection(db, INV, itemId, 'restockHistory'), {
    date:              orderTimestamp,
    quantityAdded:     Number(quantityAdded),
    purchasePrice:     Number(purchasePrice),
    vendorName:        vendorName?.trim() || '',
    notes:             notes?.trim() || '',
    addedBy:           user.uid,
    addedByName:       user.displayName || user.email,
    addedAt:           serverTimestamp(),
    isDateManuallySet: isDateManuallySet ?? false,
    entryType:         'REPLENISH',
  });

  await logAudit({
    action:           'inventory.replenished',
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         itemId,
    targetCollection: INV,
    metadata: {
      quantityAdded: Number(quantityAdded),
      purchasePrice: Number(purchasePrice),
      vendorName,
    },
  });
};

// ─── UPDATE ITEM DETAILS ───────────────────────────────────────────────────────

export const updateInventoryItem = async ({ itemId, updates, user }) => {
  const itemRef = doc(db, INV, itemId);
  await updateDoc(itemRef, {
    ...updates,
    lastUpdatedAt: serverTimestamp(),
    lastUpdatedBy: user.uid,
  });

  await logAudit({
    action:           'inventory.updated',
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         itemId,
    targetCollection: INV,
    metadata:         updates,
  });
};

export const updateLowStockThreshold = async ({ itemId, threshold, user }) => {
  const itemRef = doc(db, INV, itemId);
  await updateDoc(itemRef, {
    lowStockThreshold: Number(threshold),
    lastUpdatedAt:     serverTimestamp(),
    lastUpdatedBy:     user.uid,
  });

  await logAudit({
    action:           'inventory.threshold_updated',
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         itemId,
    targetCollection: INV,
    metadata:         { threshold: Number(threshold) },
  });
};

// ─── DELETE INVENTORY ITEM (Owner / SuperAdmin only) ──────────────────────────

/**
 * Permanently delete an inventory item document.
 * Note: Firestore does NOT auto-delete subcollections (restockHistory).
 * For a small number of history entries this is acceptable — orphaned
 * subcollection docs don't cause any functional issues and are invisible
 * to the app. A full recursive delete would require a Cloud Function.
 *
 * @param {string} itemId — Firestore document ID
 * @param {object} user   — Firebase Auth user object
 */
export const deleteInventoryItem = async (itemId, user) => {
  await deleteDoc(doc(db, INV, itemId));

  await logAudit({
    action:           'inventory.deleted',
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         itemId,
    targetCollection: INV,
    metadata:         {},
  });
};

// ─── DEDUCTION — called by Invoice Approval ONLY ───────────────────────────────

export const deductInventoryForInvoice = async ({
  lineItems,
  invoiceId,
  user,
  transaction: txn = null,
}) => {
  for (const { itemId, quantity } of lineItems) {
    const itemRef = doc(db, INV, itemId);
    if (txn) {
      txn.update(itemRef, {
        quantity:      increment(-Number(quantity)),
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: user.uid,
      });
    } else {
      await updateDoc(itemRef, {
        quantity:      increment(-Number(quantity)),
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: user.uid,
      });
    }
  }
};

// ─── CATEGORIES ────────────────────────────────────────────────────────────────

export const getCategories = async () => {
  const q = query(collection(db, CATS), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToItem);
};

export const addCategory = async ({ name, user }) => {
  const existing = await getCategories();
  const isDuplicate = existing.some(
    (c) => c.name.toLowerCase() === name.trim().toLowerCase()
  );
  if (isDuplicate) throw new Error(`Category "${name.trim()}" already exists`);

  const ref = await addDoc(collection(db, CATS), {
    name:      name.trim(),
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });

  await logAudit({
    action:           'inventory.category_added',
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         ref.id,
    targetCollection: CATS,
    metadata:         { name: name.trim() },
  });

  return ref.id;
};

export const updateCategory = async ({ categoryId, newName, user }) => {
  await updateDoc(doc(db, CATS, categoryId), {
    name:      newName.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  await logAudit({
    action:           'inventory.category_updated',
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         categoryId,
    targetCollection: CATS,
    metadata:         { newName: newName.trim() },
  });
};

export const deleteCategory = async ({ categoryId, user }) => {
  const usedBy = query(collection(db, INV), where('categoryId', '==', categoryId));
  const usedSnap = await getDocs(usedBy);
  if (!usedSnap.empty) {
    throw new Error(
      `Cannot delete — ${usedSnap.size} inventory item${usedSnap.size > 1 ? 's' : ''} still use this category. Reassign them first.`
    );
  }

  await deleteDoc(doc(db, CATS, categoryId));

  await logAudit({
    action:           'inventory.category_deleted',
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         categoryId,
    targetCollection: CATS,
    metadata:         {},
  });
};