// SGA — Last updated: Three-branch inventory logic on approval — tracked (decrement qty + totalSold), untracked (totalSold only), local item (auto-create/link Local Items doc + totalSold)
// ============================================================
// functions/src/invoiceApproval.js
// Cloud Function: approveInvoice (callable)
// Phase 4 — Shree Ganesh Automobile
// ============================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

/**
 * Callable function: approveInvoice
 *
 * Three inventory branches per line item:
 *
 * A — Regular TRACKED item (inventoryItemId set, isUntracked: false/absent):
 *     decrement quantity by item.quantity AND increment totalSold.
 *
 * B — Regular UNTRACKED item (inventoryItemId set, isUntracked: true):
 *     skip quantity decrement; increment totalSold only.
 *
 * C — LOCAL ITEM (isLocalItem: true, inventoryItemId: null):
 *     1. Query /inventory for existing doc: itemName == item.name (case-insensitive)
 *        AND category == 'Local Items'
 *     2. If found → increment totalSold; write inventoryItemId back to invoice line item.
 *     3. If not found → create new /inventory doc with isUntracked: true,
 *        category: 'Local Items', totalSold = item.quantity, purchasePrice: null,
 *        sellingPrice from invoice. Write new doc ID back to invoice line item.
 */
exports.approveInvoice = onCall(
  { region: "asia-south1" },
  async (request) => {
    // ── Auth check ──────────────────────────────────────────
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }

    const role = request.auth.token.role;
    if (!["owner", "superadmin"].includes(role)) {
      throw new HttpsError(
        "permission-denied",
        "Only Owner or SuperAdmin can approve invoices."
      );
    }

    const { invoiceId } = request.data;
    if (!invoiceId) {
      throw new HttpsError("invalid-argument", "invoiceId is required.");
    }

    // ── Check DB lock ───────────────────────────────────────
    const configSnap = await db
      .collection("systemConfig")
      .doc("global")
      .get();

    if (configSnap.exists && configSnap.data().invoiceDbLocked === true) {
      throw new HttpsError(
        "failed-precondition",
        "Invoice database is currently locked by SuperAdmin."
      );
    }

    // ── Load invoice ────────────────────────────────────────
    const invoiceRef  = db.collection("invoices").doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();

    if (!invoiceSnap.exists) {
      throw new HttpsError("not-found", "Invoice not found.");
    }

    const invoice = invoiceSnap.data();

    if (invoice.status !== "PENDING") {
      throw new HttpsError(
        "failed-precondition",
        `Invoice is already ${invoice.status}. Only PENDING invoices can be approved.`
      );
    }

    const items = invoice.items || [];

    // ── Validate tracked inventory quantities ───────────────
    // Only tracked items (inventoryItemId set, isUntracked not true) are validated.
    // Untracked and local items have no stock ceiling.
    const insufficientItems = [];

    for (const item of items) {
      // Skip untracked and local items
      if (item.isLocalItem || item.isUntracked) continue;
      if (!item.inventoryItemId) continue;

      const invSnap = await db
        .collection("inventory")
        .doc(item.inventoryItemId)
        .get();

      if (!invSnap.exists) {
        // Item was deleted from inventory — flag but don't block (owner can decide)
        continue;
      }

      const invData = invSnap.data();
      // Re-check isUntracked from the inventory document itself
      if (invData.isUntracked === true) continue;

      const currentQty = invData.quantity || 0;
      if (currentQty < item.quantity) {
        insufficientItems.push(
          `${item.name} (need ${item.quantity}, have ${currentQty})`
        );
      }
    }

    if (insufficientItems.length > 0) {
      throw new HttpsError(
        "failed-precondition",
        `Insufficient stock for: ${insufficientItems.join("; ")}. ` +
          "Please replenish inventory or adjust the invoice."
      );
    }

    // ── Resolve Local Items before batch ───────────────────
    // For isLocalItem lines we need the inventory doc ID BEFORE the batch,
    // because we may need to create a new doc (which requires a server round-trip).
    // We resolve all local items first, collecting their inventory IDs.
    const localItemResolutions = {}; // lineItemIndex → inventoryItemId

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (!item.isLocalItem) continue;

      const nameLower = (item.name || "").trim().toLowerCase();

      // Search for existing Local Items doc with same name (case-insensitive)
      const existingSnap = await db
        .collection("inventory")
        .where("category", "==", "Local Items")
        .get();

      const matchingDoc = existingSnap.docs.find(
        (d) => (d.data().itemName || "").trim().toLowerCase() === nameLower
      );

      if (matchingDoc) {
        // Found existing — will increment totalSold
        localItemResolutions[idx] = matchingDoc.id;
      } else {
        // Create new inventory doc for this Local Item
        const newDocRef = await db.collection("inventory").add({
          itemName:      item.name.trim(),
          category:      "Local Items",
          isUntracked:   true,
          totalSold:     0,              // will be incremented in batch
          sellingPrice:  item.sellingPrice || null,
          purchasePrice: null,           // Owner sets this later from inventory page
          vendorName:    "",
          notes:         "",
          createdAt:     FieldValue.serverTimestamp(),
          createdBy:     request.auth.uid,
          createdByName: request.auth.token.name || request.auth.token.email || "Unknown",
          createdFrom:   "invoice_approval",
          invoiceId:     invoiceId,
          lastUpdatedAt: FieldValue.serverTimestamp(),
          lastUpdatedBy: request.auth.uid,
        });
        localItemResolutions[idx] = newDocRef.id;
      }
    }

    // ── Atomic batch: approve + inventory updates ──────────
    const batch = db.batch();

    // 1. Update invoice status
    batch.update(invoiceRef, {
      status:        "APPROVED",
      approvedBy:    request.auth.uid,
      approvedByName:
        request.auth.token.name ||
        request.auth.token.email ||
        "Unknown",
      approvedAt:    FieldValue.serverTimestamp(),
      updatedAt:     FieldValue.serverTimestamp(),
    });

    // 2. Process each line item — three branches
    const updatedItems = items.map((item, idx) => ({ ...item })); // clone for write-back

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];

      // ── Branch C: Local Item ─────────────────────────────
      if (item.isLocalItem) {
        const invId  = localItemResolutions[idx];
        const invRef = db.collection("inventory").doc(invId);

        batch.update(invRef, {
          totalSold:     FieldValue.increment(Number(item.quantity)),
          lastUpdatedAt: FieldValue.serverTimestamp(),
          lastUpdatedBy: request.auth.uid,
        });

        // Write inventory ID back to the invoice line item for future reporting
        updatedItems[idx] = {
          ...updatedItems[idx],
          inventoryItemId: invId,
        };
        continue;
      }

      // Skip items with no inventory reference
      if (!item.inventoryItemId) continue;

      const invRef  = db.collection("inventory").doc(item.inventoryItemId);
      const invSnap = await invRef.get();
      if (!invSnap.exists) continue;

      const isItemUntracked = invSnap.data().isUntracked === true || item.isUntracked === true;

      if (isItemUntracked) {
        // ── Branch B: Untracked item — totalSold only ─────
        batch.update(invRef, {
          totalSold:     FieldValue.increment(Number(item.quantity)),
          lastUpdatedAt: FieldValue.serverTimestamp(),
          lastUpdatedBy: request.auth.uid,
        });
      } else {
        // ── Branch A: Tracked item — decrement qty + totalSold
        batch.update(invRef, {
          quantity:              FieldValue.increment(-Number(item.quantity)),
          totalSold:             FieldValue.increment(Number(item.quantity)),
          lastDeductedAt:        FieldValue.serverTimestamp(),
          lastDeductedByInvoice: invoiceId,
          lastUpdatedAt:         FieldValue.serverTimestamp(),
          lastUpdatedBy:         request.auth.uid,
        });
      }
    }

    // 3. Write updated items array back (includes inventoryItemId links for local items)
    batch.update(invoiceRef, { items: updatedItems });

    // 4. Audit log entry
    const auditRef = db.collection("auditLog").doc();
    batch.set(auditRef, {
      action:           "invoice_approved",
      targetId:         invoiceId,
      targetCollection: "invoices",
      userId:           request.auth.uid,
      userName:
        request.auth.token.name ||
        request.auth.token.email ||
        "Unknown",
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        invoiceNo:      invoice.invoiceNo,
        customerName:   invoice.customerSnapshot?.name,
        totalAmount:    invoice.totalAmount,
        itemsProcessed: items.length,
        localItemsCreated: Object.keys(localItemResolutions).filter(
          (k) => !items[k].inventoryItemId
        ).length,
      },
    });

    await batch.commit();

    // ── Post-approval: low stock alerts for TRACKED items ──
    const lowStockAlerts = [];
    for (const item of items) {
      if (item.isLocalItem || item.isUntracked) continue;
      if (!item.inventoryItemId) continue;

      const updatedSnap = await db
        .collection("inventory")
        .doc(item.inventoryItemId)
        .get();

      if (!updatedSnap.exists) continue;
      const data = updatedSnap.data();
      if (data.isUntracked === true) continue;

      const newQty   = data.quantity || 0;
      const threshold = data.lowStockThreshold || 5;

      if (newQty <= threshold) {
        lowStockAlerts.push({
          itemName:   data.itemName,
          currentQty: newQty,
          threshold,
        });
      }
    }

    return {
      success:    true,
      invoiceId,
      invoiceNo:  invoice.invoiceNo,
      itemsProcessed: items.length,
      localItemsResolved: Object.keys(localItemResolutions).length,
      lowStockAlerts,
    };
  }
);

/**
 * Callable function: rejectInvoice
 * Rejects (deletes) a PENDING invoice. No inventory changes.
 * Local items in a rejected invoice do NOT create inventory records —
 * the records are only created on approval (per design decision).
 */
exports.rejectInvoice = onCall(
  { region: "asia-south1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }

    const role = request.auth.token.role;
    if (!["owner", "superadmin"].includes(role)) {
      throw new HttpsError(
        "permission-denied",
        "Only Owner or SuperAdmin can reject invoices."
      );
    }

    const { invoiceId } = request.data;
    if (!invoiceId) {
      throw new HttpsError("invalid-argument", "invoiceId is required.");
    }

    const invoiceRef  = db.collection("invoices").doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();

    if (!invoiceSnap.exists) {
      throw new HttpsError("not-found", "Invoice not found.");
    }

    const invoice = invoiceSnap.data();

    await db.collection("auditLog").add({
      action:           "invoice_rejected",
      targetId:         invoiceId,
      targetCollection: "invoices",
      userId:           request.auth.uid,
      userName:
        request.auth.token.name ||
        request.auth.token.email ||
        "Unknown",
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        invoiceNo:    invoice.invoiceNo,
        customerName: invoice.customerSnapshot?.name,
        totalAmount:  invoice.totalAmount,
        createdBy:    invoice.createdByName,
      },
    });

    await invoiceRef.delete();

    return {
      success:   true,
      invoiceId,
      invoiceNo: invoice.invoiceNo,
    };
  }
);