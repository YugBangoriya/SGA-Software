// SGA — Last updated: Added shortcut/alias field support — stored on items and searched during invoice creation
/**
 * Inventory Service — Shree Ganesh Automobile
 * All Firestore read/write operations for the Inventory module.
 *
 * CRITICAL RULE (from PRD §3.5.3):
 *   Inventory quantity is NEVER deducted here during invoice creation.
 *   Deduction happens ONLY when an Owner approves an invoice (Phase 4).
 *
 * NEW (Request 1 — Untracked Items): Items with isUntracked: true have no stock ceiling.
 * NEW (Request 2 — Local Items): Items in category 'Local Items' are auto-created by invoiceApproval.js
 * NEW (Request 3 — Shortcut/Alias): Items can have a shortcut field for fast search in invoice creation.
 *
 * Collections:
 *   /inventory                     — main item documents
 *   /inventory/{id}/restockHistory — per-item batch history
 *   /inventoryCategories           — category list
 */

import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs, deleteDoc,
  query, orderBy, serverTimestamp, increment, runTransaction,
  Timestamp, writeBatch, deleteField,
} from 'firebase/firestore';
import { db } from './firebase';
import { logAudit } from './auditService';

const INV  = 'inventory';
const CATS = 'inventoryCategories';

const toTimestamp = (dateStr) => dateStr ? Timestamp.fromDate(new Date(dateStr)) : null;
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
  const q = query(collection(db, INV, itemId, 'restockHistory'), orderBy('addedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(docToItem);
};

export const getLowStockItems = async () => {
  const items = await getInventoryItems();
  return items.filter(
    (item) => item.isUntracked !== true && (item.quantity ?? 0) <= (item.lowStockThreshold ?? 5)
  );
};

// ─── ADD NEW ITEM (Owner / SuperAdmin only) ────────────────────────────────────

export const addInventoryItem = async ({ itemData, user }) => {
  const {
    itemName, shortcut, categoryId, quantityAdded, purchasePrice,
    sellingPrice, dateOrderedOrReceived, vendorName, lowStockThreshold,
    isDateManuallySet, notes, isUntracked,
  } = itemData;

  const orderTimestamp = dateOrderedOrReceived ? toTimestamp(dateOrderedOrReceived) : serverTimestamp();

  const newItem = {
    itemName:              itemName.trim(),
    shortcut:              shortcut?.trim() || '',   // NEW — alias for fast invoice search
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
    newItem.quantity          = Number(quantityAdded);
    newItem.lowStockThreshold = Number(lowStockThreshold) || 5;
  }

  const itemRef = await addDoc(collection(db, INV), newItem);

  if (!isUntracked) {
    await addDoc(collection(db, INV, itemRef.id, 'restockHistory'), {
      date: orderTimestamp, quantityAdded: Number(quantityAdded),
      purchasePrice: purchasePrice !== '' ? Number(purchasePrice) : null,
      vendorName: vendorName?.trim() || '', notes: notes?.trim() || '',
      addedBy: user.uid, addedByName: user.displayName || user.email,
      addedAt: serverTimestamp(), isDateManuallySet: isDateManuallySet ?? false,
      entryType: 'INITIAL',
    });
  }

  await logAudit({
    action: 'inventory.added', userId: user.uid, userName: user.displayName || user.email,
    targetId: itemRef.id, targetCollection: INV,
    metadata: { itemName, shortcut: shortcut?.trim() || '', quantityAdded: isUntracked ? null : Number(quantityAdded), purchasePrice: purchasePrice !== '' ? Number(purchasePrice) : null, isUntracked: !!isUntracked, categoryId },
  });

  return itemRef.id;
};

// ─── REPLENISH EXISTING ITEM ──────────────────────────────────────────────────

export const replenishInventoryItem = async ({ itemId, replenishData, user }) => {
  const { quantityAdded, purchasePrice, sellingPrice, dateOrderedOrReceived, vendorName, isDateManuallySet, notes } = replenishData;
  const orderTimestamp = dateOrderedOrReceived ? toTimestamp(dateOrderedOrReceived) : serverTimestamp();

  await runTransaction(db, async (transaction) => {
    const itemRef  = doc(db, INV, itemId);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) throw new Error('Inventory item not found');

    const sellingPriceUpdate = sellingPrice != null ? { sellingPrice: Number(sellingPrice) } : {};
    const update = {
      purchasePrice: Number(purchasePrice), ...sellingPriceUpdate,
      vendorName: vendorName?.trim() || itemSnap.data().vendorName || '',
      lastRestockedDate: orderTimestamp, isLastDateManuallySet: isDateManuallySet ?? false,
      lastUpdatedAt: serverTimestamp(), lastUpdatedBy: user.uid,
    };

    if (!itemSnap.data().isUntracked) {
      update.quantity = increment(Number(quantityAdded));
    }
    transaction.update(itemRef, update);
  });

  await addDoc(collection(db, INV, itemId, 'restockHistory'), {
    date: orderTimestamp, quantityAdded: Number(quantityAdded),
    purchasePrice: Number(purchasePrice), vendorName: vendorName?.trim() || '',
    notes: notes?.trim() || '', addedBy: user.uid, addedByName: user.displayName || user.email,
    addedAt: serverTimestamp(), isDateManuallySet: isDateManuallySet ?? false, entryType: 'REPLENISH',
  });

  await logAudit({
    action: 'inventory.replenished', userId: user.uid, userName: user.displayName || user.email,
    targetId: itemId, targetCollection: INV,
    metadata: { quantityAdded: Number(quantityAdded), purchasePrice: Number(purchasePrice), vendorName },
  });
};

// ─── UPDATE ITEM DETAILS ───────────────────────────────────────────────────────

export const updateInventoryItem = async ({ itemId, updates, user }) => {
  await updateDoc(doc(db, INV, itemId), { ...updates, lastUpdatedAt: serverTimestamp(), lastUpdatedBy: user.uid });
  await logAudit({ action: 'inventory.updated', userId: user.uid, userName: user.displayName || user.email, targetId: itemId, targetCollection: INV, metadata: updates });
};

export const updateLowStockThreshold = async ({ itemId, threshold, user }) => {
  await updateDoc(doc(db, INV, itemId), { lowStockThreshold: Number(threshold), lastUpdatedAt: serverTimestamp(), lastUpdatedBy: user.uid });
  await logAudit({ action: 'inventory.threshold_updated', userId: user.uid, userName: user.displayName || user.email, targetId: itemId, targetCollection: INV, metadata: { threshold: Number(threshold) } });
};

// ─── TOGGLE TRACKING MODE ─────────────────────────────────────────────────────

export const updateTrackingMode = async ({ itemId, toUntracked, startingQty = 0, user }) => {
  const itemRef = doc(db, INV, itemId);
  if (toUntracked) {
    await updateDoc(itemRef, { isUntracked: true, quantity: deleteField(), lowStockThreshold: deleteField(), lastUpdatedAt: serverTimestamp(), lastUpdatedBy: user.uid });
  } else {
    await updateDoc(itemRef, { isUntracked: false, quantity: Number(startingQty), lowStockThreshold: 5, lastUpdatedAt: serverTimestamp(), lastUpdatedBy: user.uid });
  }
  await logAudit({ action: toUntracked ? 'inventory.tracking_disabled' : 'inventory.tracking_enabled', userId: user.uid, userName: user.displayName || user.email, targetId: itemId, targetCollection: INV, metadata: { toUntracked, startingQty: toUntracked ? null : Number(startingQty) } });
};

// ─── UPDATE PURCHASE PRICE FOR LOCAL ITEMS ────────────────────────────────────

export const updateLocalItemPurchasePrice = async ({ itemId, purchasePrice, user }) => {
  await updateDoc(doc(db, INV, itemId), { purchasePrice: Number(purchasePrice), lastUpdatedAt: serverTimestamp(), lastUpdatedBy: user.uid });
  await logAudit({ action: 'inventory.local_item_purchase_price_set', userId: user.uid, userName: user.displayName || user.email, targetId: itemId, targetCollection: INV, metadata: { purchasePrice: Number(purchasePrice) } });
};

// ─── DELETE ────────────────────────────────────────────────────────────────────

export const deleteInventoryItem = async (itemId, user) => {
  await deleteDoc(doc(db, INV, itemId));
  await logAudit({ action: 'inventory.deleted', userId: user.uid, userName: user.displayName || user.email, targetId: itemId, targetCollection: INV, metadata: { itemId } });
};

export const deleteItems = async (itemIds, user) => {
  const batch = writeBatch(db);
  itemIds.forEach((id) => batch.delete(doc(db, INV, id)));
  await batch.commit();
  await logAudit({ action: 'inventory.bulk_deleted', userId: user.uid, userName: user.displayName || user.email, targetId: itemIds.join(','), targetCollection: INV, metadata: { count: itemIds.length } });
};

// ─── CATEGORY CRUD ─────────────────────────────────────────────────────────────

export const getInventoryCategories = async () => {
  const snap = await getDocs(collection(db, CATS));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addInventoryCategory = async (name) => {
  const ref = await addDoc(collection(db, CATS), { name: name.trim(), createdAt: serverTimestamp() });
  return { id: ref.id, name: name.trim() };
};

export const deleteInventoryCategory = async (categoryId) => {
  await deleteDoc(doc(db, CATS, categoryId));
};

export const updateInventoryCategory = async (categoryId, name) => {
  await updateDoc(doc(db, CATS, categoryId), { name: name.trim() });
};

// ─── Backward-compatible aliases ──────────────────────────────────────────────
// inventoryStore.js imports the shorter original names. These re-exports keep the
// store working without any changes to inventoryStore.js.
export const getCategories    = getInventoryCategories;
export const addCategory      = addInventoryCategory;
export const updateCategory   = updateInventoryCategory;
export const deleteCategory   = deleteInventoryCategory;