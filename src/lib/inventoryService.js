/**
 * Inventory Service — Shree Ganesh Automobile
 * All Firestore read/write operations for the Inventory module.
 *
 * CRITICAL RULE (from PRD §3.5.3):
 *   Inventory quantity is NEVER deducted here during invoice creation.
 *   Deduction happens ONLY when an Owner approves an invoice (Phase 4).
 *   This file exposes deductInventoryForInvoice() for Phase 4 to call.
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
  query,
  orderBy,
  serverTimestamp,
  increment,
  runTransaction,
  where,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { logAudit, AUDIT_ACTIONS } from './auditService';

const INV  = 'inventory';
const CATS = 'inventoryCategories';

// ─── Helpers ───────────────────────────────────────────────────────────────

const toTimestamp = (dateStr) =>
  dateStr
    ? Timestamp.fromDate(new Date(dateStr))
    : null; // null signals "use serverTimestamp()" at the call site

const docToItem = (snap) => ({ id: snap.id, ...snap.data() });

// ─── READ ──────────────────────────────────────────────────────────────────

/**
 * Fetch all inventory items ordered by name.
 * Accessible to Owner, Employee, and SuperAdmin.
 */
export const getInventoryItems = async () => {
  const q = query(collection(db, INV), orderBy('itemName', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToItem);
};

/**
 * Fetch a single inventory item by ID.
 */
export const getInventoryItem = async (itemId) => {
  const snap = await getDoc(doc(db, INV, itemId));
  if (!snap.exists()) throw new Error('Item not found');
  return docToItem(snap);
};

/**
 * Fetch all restock history entries for a given item, newest first.
 * Used by the Item Detail screen.
 */
export const getRestockHistory = async (itemId) => {
  const q = query(
    collection(db, INV, itemId, 'restockHistory'),
    orderBy('addedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToItem);
};

/**
 * Return all items currently at or below their low-stock threshold.
 * Used to generate in-app alerts for the Owner.
 */
export const getLowStockItems = async () => {
  const items = await getInventoryItems();
  return items.filter((item) => item.quantity <= (item.lowStockThreshold ?? 5));
};

// ─── ADD NEW ITEM (Owner / SuperAdmin only) ────────────────────────────────

/**
 * Add a brand-new inventory item.
 * Also creates the first entry in the restockHistory subcollection.
 *
 * @param {object} params
 * @param {object} params.itemData  — form values
 * @param {object} params.user      — Firebase Auth user object
 * @returns {string} — newly created item document ID
 */
export const addInventoryItem = async ({ itemData, user }) => {
  const {
    itemName,
    categoryId,
    quantityAdded,
    purchasePrice,
    dateOrderedOrReceived,   // ISO date string from <input type="date">
    vendorName,
    lowStockThreshold,
    isDateManuallySet,       // true if user changed from today's default
    notes,
  } = itemData;

  const orderTimestamp = dateOrderedOrReceived
    ? toTimestamp(dateOrderedOrReceived)
    : serverTimestamp();

  const newItem = {
    itemName:              itemName.trim(),
    categoryId:            categoryId || '',
    quantity:              Number(quantityAdded),
    purchasePrice:         Number(purchasePrice),       // price per unit, latest batch
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

  // Write parent document
  const itemRef = await addDoc(collection(db, INV), newItem);

  // Write first restock history entry (same data as initial stock)
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
    entryType:        'INITIAL', // distinguish from replenishments
  });

  await logAudit({
    action:            AUDIT_ACTIONS.INVENTORY_ADD,
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

// ─── REPLENISH EXISTING ITEM (Owner / SuperAdmin only) ────────────────────

/**
 * Add stock to an existing inventory item.
 * Uses a Firestore transaction so the quantity increment is atomic.
 * Updates purchasePrice to reflect the new batch's price.
 *
 * @param {object} params
 * @param {string} params.itemId
 * @param {object} params.replenishData — form values
 * @param {object} params.user
 */
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

  // Atomic quantity increment
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

  // Append restock history entry (outside transaction — non-atomic is acceptable here)
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
    action:           AUDIT_ACTIONS.INVENTORY_REPLENISH,
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

// ─── UPDATE ITEM DETAILS (Owner / SuperAdmin only) ────────────────────────

/**
 * Update non-stock fields of an inventory item
 * (e.g., category, notes, item name).
 * Does NOT change quantity or restockHistory.
 */
export const updateInventoryItem = async ({ itemId, updates, user }) => {
  const itemRef = doc(db, INV, itemId);
  await updateDoc(itemRef, {
    ...updates,
    lastUpdatedAt: serverTimestamp(),
    lastUpdatedBy: user.uid,
  });

  await logAudit({
    action:           AUDIT_ACTIONS.INVENTORY_UPDATE,
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         itemId,
    targetCollection: INV,
    metadata:         updates,
  });
};

/**
 * Set the low-stock threshold for a single item.
 * Triggers a re-evaluation of alert status in the store.
 */
export const updateLowStockThreshold = async ({ itemId, threshold, user }) => {
  const itemRef = doc(db, INV, itemId);
  await updateDoc(itemRef, {
    lowStockThreshold: Number(threshold),
    lastUpdatedAt:     serverTimestamp(),
    lastUpdatedBy:     user.uid,
  });

  await logAudit({
    action:           AUDIT_ACTIONS.INVENTORY_THRESHOLD_SET,
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         itemId,
    targetCollection: INV,
    metadata:         { threshold: Number(threshold) },
  });
};

// ─── DEDUCTION — called by Phase 4 Invoice Approval ONLY ─────────────────

/**
 * Deduct inventory quantities when an invoice is APPROVED.
 * This function is intentionally NOT called during invoice creation.
 *
 * Called from the Invoice Module (Phase 4) after Owner approves an invoice.
 * Can be called inside an existing Firestore transaction (pass `transaction`)
 * or standalone (omit `transaction`).
 *
 * @param {object} params
 * @param {Array}  params.lineItems  — [{ itemId: string, quantity: number }]
 * @param {string} params.invoiceId  — for audit trail
 * @param {object} params.user       — Firebase Auth user
 * @param {object} [params.transaction] — optional Firestore transaction object
 */
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

  // Audit is handled by the Invoice module for the overall approval action
};

// ─── CATEGORIES ────────────────────────────────────────────────────────────

export const getCategories = async () => {
  const q = query(collection(db, CATS), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToItem);
};

export const addCategory = async ({ name, user }) => {
  // Guard: prevent duplicate names (case-insensitive)
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
    action:           AUDIT_ACTIONS.CATEGORY_ADD,
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
    action:           AUDIT_ACTIONS.CATEGORY_UPDATE,
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         categoryId,
    targetCollection: CATS,
    metadata:         { newName: newName.trim() },
  });
};

export const deleteCategory = async ({ categoryId, user }) => {
  // Guard: cannot delete if items still reference this category
  const usedBy = query(
    collection(db, INV),
    where('categoryId', '==', categoryId)
  );
  const usedSnap = await getDocs(usedBy);
  if (!usedSnap.empty) {
    throw new Error(
      `Cannot delete — ${usedSnap.size} inventory item${usedSnap.size > 1 ? 's' : ''} still use this category. Reassign them first.`
    );
  }

  await deleteDoc(doc(db, CATS, categoryId));

  await logAudit({
    action:           AUDIT_ACTIONS.CATEGORY_DELETE,
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         categoryId,
    targetCollection: CATS,
    metadata:         {},
  });
};
