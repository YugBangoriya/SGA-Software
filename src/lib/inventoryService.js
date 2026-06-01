// SGA — Last updated: Added isUntracked support (optional quantity), totalSold counter, Local Items auto-creation, updateTrackingMode, updateLocalItemPurchasePrice
/**
 * Inventory Service — Shree Ganesh Automobile
 * All Firestore read/write operations for the Inventory module.
 *
 * CRITICAL RULE (from PRD §3.5.3):
 *   Inventory quantity is NEVER deducted here during invoice creation.
 *   Deduction happens ONLY when an Owner approves an invoice (Phase 4).
 *
 * NEW (Request 1 — Untracked Items):
 *   Items with isUntracked: true have no stock ceiling. quantity field is
 *   absent/null. totalSold accumulates units sold on invoice approval.
 *
 * NEW (Request 2 — Local Items):
 *   Items in category 'Local Items' are auto-created by invoiceApproval.js
 *   when a line item with isLocalItem: true is approved.
 *   updateLocalItemPurchasePrice() is called by Owner from ItemDetailPage.
 *
 * Collections:
 *   /inventory                     — main item documents
 *   /inventory/{id}/restockHistory — per-item batch history
 *   /inventoryCategories           — category list
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
  writeBatch,
  deleteField,
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

/**
 * Low-stock items: only tracked items (isUntracked !== true) are considered.
 * Untracked items have no stock ceiling so they are never "low".
 */
export const getLowStockItems = async () => {
  const items = await getInventoryItems();
  return items.filter(
    (item) =>
      item.isUntracked !== true &&
      (item.quantity ?? 0) <= (item.lowStockThreshold ?? 5)
  );
};

// ─── ADD NEW ITEM (Owner / SuperAdmin only) ────────────────────────────────────

export const addInventoryItem = async ({ itemData, user }) => {
  const {
    itemName,
    categoryId,
    quantityAdded,
    purchasePrice,
    sellingPrice,
    dateOrderedOrReceived,
    vendorName,
    lowStockThreshold,
    isDateManuallySet,
    notes,
    isUntracked,   // NEW — true when stock tracking is disabled
  } = itemData;

  const orderTimestamp = dateOrderedOrReceived
    ? toTimestamp(dateOrderedOrReceived)
    : serverTimestamp();

  // Build the document — quantity and lowStockThreshold omitted for untracked
  const newItem = {
    itemName:              itemName.trim(),
    categoryId:            categoryId || '',
    purchasePrice:         purchasePrice !== '' && purchasePrice != null ? Number(purchasePrice) : null,
    sellingPrice:          sellingPrice  != null && sellingPrice  !== '' ? Number(sellingPrice)  : null,
    vendorName:            vendorName?.trim() || '',
    lastRestockedDate:     orderTimestamp,
    isLastDateManuallySet: isDateManuallySet ?? false,
    notes:                 notes?.trim() || '',
    isUntracked:           !!isUntracked,
    totalSold:             0,
    createdAt:             serverTimestamp(),
    createdBy:             user.uid,
    createdByName:         user.displayName || user.email,
    lastUpdatedAt:         serverTimestamp(),
    lastUpdatedBy:         user.uid,
  };

  if (!isUntracked) {
    // Tracked item — include quantity and low-stock threshold
    newItem.quantity          = Number(quantityAdded);
    newItem.lowStockThreshold = Number(lowStockThreshold) || 5;
  }

  const itemRef = await addDoc(collection(db, INV), newItem);

  // Only write a restockHistory entry for tracked items
  if (!isUntracked) {
    await addDoc(collection(db, INV, itemRef.id, 'restockHistory'), {
      date:              orderTimestamp,
      quantityAdded:     Number(quantityAdded),
      purchasePrice:     purchasePrice !== '' ? Number(purchasePrice) : null,
      vendorName:        vendorName?.trim() || '',
      notes:             notes?.trim() || '',
      addedBy:           user.uid,
      addedByName:       user.displayName || user.email,
      addedAt:           serverTimestamp(),
      isDateManuallySet: isDateManuallySet ?? false,
      entryType:         'INITIAL',
    });
  }

  await logAudit({
    action:           'inventory.added',
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         itemRef.id,
    targetCollection: INV,
    metadata: {
      itemName,
      quantityAdded: isUntracked ? null : Number(quantityAdded),
      purchasePrice: purchasePrice !== '' ? Number(purchasePrice) : null,
      isUntracked:   !!isUntracked,
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
    sellingPrice,
    dateOrderedOrReceived,
    vendorName,
    isDateManuallySet,
    notes,
  } = replenishData;

  const orderTimestamp = dateOrderedOrReceived
    ? toTimestamp(dateOrderedOrReceived)
    : serverTimestamp();

  await runTransaction(db, async (transaction) => {
    const itemRef  = doc(db, INV, itemId);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) throw new Error('Inventory item not found');

    const sellingPriceUpdate = sellingPrice != null
      ? { sellingPrice: Number(sellingPrice) }
      : {};

    const update = {
      purchasePrice:         Number(purchasePrice),
      ...sellingPriceUpdate,
      vendorName:            vendorName?.trim() || itemSnap.data().vendorName || '',
      lastRestockedDate:     orderTimestamp,
      isLastDateManuallySet: isDateManuallySet ?? false,
      lastUpdatedAt:         serverTimestamp(),
      lastUpdatedBy:         user.uid,
    };

    // Only increment quantity for tracked items
    if (!itemSnap.data().isUntracked) {
      update.quantity = increment(Number(quantityAdded));
    }

    transaction.update(itemRef, update);
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
    metadata:         { quantityAdded: Number(quantityAdded), purchasePrice: Number(purchasePrice), vendorName },
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

// ─── TOGGLE TRACKING MODE (Owner / SuperAdmin) ─────────────────────────────────
/**
 * Convert a tracked item to untracked (discards stock count) or vice-versa.
 * Called from ItemDetailPage when the owner flips the "Track stock quantity" toggle.
 *
 * toUntracked: true  → tracked → untracked (quantity field removed)
 * toUntracked: false → untracked → tracked (startingQty required)
 */
export const updateTrackingMode = async ({ itemId, toUntracked, startingQty = 0, user }) => {
  const itemRef = doc(db, INV, itemId);

  if (toUntracked) {
    // Remove quantity and lowStockThreshold, set isUntracked = true
    await updateDoc(itemRef, {
      isUntracked:       true,
      quantity:          deleteField(),
      lowStockThreshold: deleteField(),
      lastUpdatedAt:     serverTimestamp(),
      lastUpdatedBy:     user.uid,
    });
  } else {
    // Re-enable tracking with a provided starting quantity
    await updateDoc(itemRef, {
      isUntracked:       false,
      quantity:          Number(startingQty),
      lowStockThreshold: 5,
      lastUpdatedAt:     serverTimestamp(),
      lastUpdatedBy:     user.uid,
    });
  }

  await logAudit({
    action:           toUntracked ? 'inventory.tracking_disabled' : 'inventory.tracking_enabled',
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         itemId,
    targetCollection: INV,
    metadata:         { toUntracked, startingQty: toUntracked ? null : Number(startingQty) },
  });
};

// ─── UPDATE PURCHASE PRICE FOR LOCAL ITEMS ─────────────────────────────────────
/**
 * Called by Owner/SuperAdmin from ItemDetailPage on a Local Item to
 * enter the cost after the fact. Once set, profit/loss calculations
 * for all past invoices referencing this item become accurate.
 */
export const updateLocalItemPurchasePrice = async ({ itemId, purchasePrice, user }) => {
  const itemRef = doc(db, INV, itemId);
  await updateDoc(itemRef, {
    purchasePrice:  Number(purchasePrice),
    lastUpdatedAt:  serverTimestamp(),
    lastUpdatedBy:  user.uid,
  });

  await logAudit({
    action:           'inventory.local_item_purchase_price_set',
    userId:           user.uid,
    userName:         user.displayName || user.email,
    targetId:         itemId,
    targetCollection: INV,
    metadata:         { purchasePrice: Number(purchasePrice) },
  });
};

// ─── DELETE INVENTORY ITEM (Owner / SuperAdmin only) ──────────────────────────

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
  for (const { itemId, quantity, isUntracked: itemIsUntracked } of lineItems) {
    const itemRef = doc(db, INV, itemId);
    const update = {
      totalSold:     increment(Number(quantity)),
      lastUpdatedAt: serverTimestamp(),
      lastUpdatedBy: user.uid,
    };
    // Only decrement quantity for tracked items
    if (!itemIsUntracked) {
      update.quantity = increment(-Number(quantity));
    }
    if (txn) {
      txn.update(itemRef, update);
    } else {
      await updateDoc(itemRef, update);
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
  const usedBy  = query(collection(db, INV), where('categoryId', '==', categoryId));
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