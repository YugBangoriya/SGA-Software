// ============================================================
// functions/src/invoiceApproval.js
// Cloud Function: approveInvoice (callable)
// Phase 4 — Shree Ganesh Automobile
// NOTE: The primary approval path uses the client-side batch
// write in invoiceStore.js. This Cloud Function provides a
// server-side callable alternative for additional validation
// and is the authoritative path for automated workflows.
// ============================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

/**
 * Callable function: approveInvoice
 * Called by Owner/SuperAdmin to approve a PENDING invoice.
 * Server-side: validates role, atomically approves invoice
 * and deducts inventory quantities.
 */
exports.approveInvoice = onCall(
  { region: "asia-south1" },
  async (request) => {
    // ── Auth check ─────────────────────────────────────
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

    // ── Check DB lock ──────────────────────────────────
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

    // ── Load invoice ───────────────────────────────────
    const invoiceRef = db.collection("invoices").doc(invoiceId);
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

    // ── Validate inventory quantities ──────────────────
    const items = invoice.items || [];
    const insufficientItems = [];

    for (const item of items) {
      if (!item.inventoryItemId) continue;
      const invSnap = await db
        .collection("inventory")
        .doc(item.inventoryItemId)
        .get();

      if (!invSnap.exists) {
        insufficientItems.push(`${item.name} (not found in inventory)`);
        continue;
      }

      const currentQty = invSnap.data().quantity || 0;
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

    // ── Atomic batch: approve + deduct ─────────────────
    const batch = db.batch();

    // 1. Update invoice status
    batch.update(invoiceRef, {
      status: "APPROVED",
      approvedBy: request.auth.uid,
      approvedByName:
        request.auth.token.name ||
        request.auth.token.email ||
        "Unknown",
      approvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 2. Deduct inventory for each item
    for (const item of items) {
      if (!item.inventoryItemId) continue;
      const invRef = db
        .collection("inventory")
        .doc(item.inventoryItemId);

      batch.update(invRef, {
        quantity: FieldValue.increment(-item.quantity),
        lastDeductedAt: FieldValue.serverTimestamp(),
        lastDeductedByInvoice: invoiceId,
      });
    }

    // 3. Write audit log entry
    const auditRef = db.collection("auditLog").doc();
    batch.set(auditRef, {
      action: "invoice_approved",
      targetId: invoiceId,
      targetCollection: "invoices",
      userId: request.auth.uid,
      userName:
        request.auth.token.name ||
        request.auth.token.email ||
        "Unknown",
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        invoiceNo: invoice.invoiceNo,
        customerName: invoice.customerSnapshot?.name,
        totalAmount: invoice.totalAmount,
        itemsDeducted: items.filter((i) => i.inventoryItemId).length,
      },
    });

    await batch.commit();

    // ── Check for low stock alerts post-deduction ──────
    const lowStockAlerts = [];
    for (const item of items) {
      if (!item.inventoryItemId) continue;
      const updatedSnap = await db
        .collection("inventory")
        .doc(item.inventoryItemId)
        .get();

      if (!updatedSnap.exists) continue;
      const data = updatedSnap.data();
      const newQty = data.quantity || 0;
      const threshold = data.lowStockThreshold || 5;

      if (newQty <= threshold) {
        lowStockAlerts.push({
          itemName: data.itemName,
          currentQty: newQty,
          threshold,
        });
      }
    }

    return {
      success: true,
      invoiceId,
      invoiceNo: invoice.invoiceNo,
      itemsDeducted: items.filter((i) => i.inventoryItemId).length,
      lowStockAlerts,
    };
  }
);

/**
 * Callable function: rejectInvoice
 * Called by Owner/SuperAdmin to reject (delete) a PENDING invoice.
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

    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();

    if (!invoiceSnap.exists) {
      throw new HttpsError("not-found", "Invoice not found.");
    }

    const invoice = invoiceSnap.data();

    // Write audit log before deletion
    await db.collection("auditLog").add({
      action: "invoice_rejected",
      targetId: invoiceId,
      targetCollection: "invoices",
      userId: request.auth.uid,
      userName:
        request.auth.token.name ||
        request.auth.token.email ||
        "Unknown",
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        invoiceNo: invoice.invoiceNo,
        customerName: invoice.customerSnapshot?.name,
        totalAmount: invoice.totalAmount,
        createdBy: invoice.createdByName,
      },
    });

    // Delete the invoice
    await invoiceRef.delete();

    return {
      success: true,
      invoiceId,
      invoiceNo: invoice.invoiceNo,
    };
  }
);
