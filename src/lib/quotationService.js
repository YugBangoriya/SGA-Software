// SGA — Last updated: createQuotation now returns createdAt: new Date() in the
// local payload so the PDF renders the correct date immediately (before Firestore
// resolves the serverTimestamp() sentinel server-side). The Firestore document
// still stores createdAt: serverTimestamp() for accurate server-time recording.
// src/lib/quotationService.js

import {
  collection, doc, getDoc, setDoc, getDocs, addDoc,
  updateDoc, deleteDoc, query, orderBy, limit,
  runTransaction, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "./firebase";
import { logAudit, AUDIT_ACTIONS } from "./auditService";

const QUOTATIONS_COLLECTION   = "quotations";
const PRICE_TABLES_COLLECTION = "quotationPriceTables";

// ─── Valid emission categories ────────────────────────────────────────────────
export const EMISSION_CATEGORIES = [
  { id: "BS4",      label: "BS4",              shortLabel: "BS4"   },
  { id: "BS6_4INJ", label: "BS6 – 4 Injector", shortLabel: "BS6-4" },
  { id: "BS6_8INJ", label: "BS6 – 8 Injector", shortLabel: "BS6-8" },
];

// ─── Ensure a section has both list and grid fields ───────────────────────────
export function normSection(raw = {}) {
  return {
    tableMode:          raw.tableMode          ?? "list",
    items:              Array.isArray(raw.items)   ? raw.items   : [],
    shareFullByDefault: raw.shareFullByDefault ?? false,
    columns:            Array.isArray(raw.columns) ? raw.columns : [],
    rows:               Array.isArray(raw.rows)    ? raw.rows    : [],
  };
}

// ─── Default price table ──────────────────────────────────────────────────────
export function defaultPriceTable() {
  const blank = () => ({
    tableMode: "list", items: [], shareFullByDefault: false, columns: [], rows: [],
  });
  return { kits: blank(), advancers: blank(), extras: blank(), cylinders: blank(), note: "" };
}

// ─── Fetch a single category's price table ────────────────────────────────────
export async function fetchQuotationPriceTable(emissionCategoryId) {
  const snap = await getDoc(doc(db, PRICE_TABLES_COLLECTION, emissionCategoryId));
  if (!snap.exists()) return defaultPriceTable();
  const data = snap.data();
  return {
    kits:      normSection(data.kits),
    advancers: normSection(data.advancers),
    extras:    normSection(data.extras),
    cylinders: normSection(data.cylinders),
    note:      data.note || "",
  };
}

// ─── Fetch all three category tables ─────────────────────────────────────────
export async function fetchAllQuotationPriceTables() {
  const result = {};
  await Promise.all(EMISSION_CATEGORIES.map(async ({ id }) => {
    result[id] = await fetchQuotationPriceTable(id);
  }));
  return result;
}

// ─── Save a price table ───────────────────────────────────────────────────────
export async function saveQuotationPriceTable(emissionCategoryId, tableData) {
  await setDoc(doc(db, PRICE_TABLES_COLLECTION, emissionCategoryId), {
    ...tableData, updatedAt: serverTimestamp(),
  });
}

// ─── Quotation number generator ───────────────────────────────────────────────
export async function generateQuotationNumber() {
  const currentYear = new Date().getFullYear();
  const counterRef  = doc(db, "systemConfig", "quotationCounter");

  const newNumber = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists()) { tx.set(counterRef, { lastNumber: 1, year: currentYear }); return 1; }
    const data = snap.data();
    if (data.year !== currentYear) { tx.update(counterRef, { lastNumber: 1, year: currentYear }); return 1; }
    const next = (data.lastNumber || 0) + 1;
    tx.update(counterRef, { lastNumber: next });
    return next;
  });

  return `QT-${currentYear}-${String(newNumber).padStart(3, "0")}`;
}

// ─── Build flattened lineItems from draft sections ────────────────────────────
function buildLineItemsFromSections(sections, labourCost) {
  const TABLE_LABELS = {
    kits: "CNG Kit", advancers: "CKP Advancer", extras: "Extras", cylinders: "Cylinder",
  };
  let lineItems = [];

  Object.entries(sections).forEach(([key, section]) => {
    const sectionLabel = TABLE_LABELS[key] || key;
    const isGrid       = section.tableMode === "grid";

    if (isGrid) {
      const itemsSource = section.shareFullTable
        ? (section.gridRows || section.allItems || [])
        : (section.selectedItems || []);

      itemsSource.forEach((rowOrItem) => {
        const name  = rowOrItem.header ?? rowOrItem.name ?? "—";
        const cells = rowOrItem.cells || {};
        const firstNumeric = Object.values(cells).find((v) => v !== "" && !isNaN(parseFloat(v)));
        const price = parseFloat(firstNumeric) || Number(rowOrItem.price || 0);
        lineItems.push({ description: name, quantity: 1, unitPrice: price, total: price, sectionType: key, sectionLabel, isGrid: true });
      });
    } else {
      const itemsSource = section.shareFullTable ? (section.allItems || []) : (section.selectedItems || []);
      itemsSource.forEach((item) => {
        lineItems.push({ description: item.name || "—", quantity: 1, unitPrice: Number(item.price || 0), total: Number(item.price || 0), sectionType: key, sectionLabel, isGrid: false });
      });
    }
  });

  const totalAmount = lineItems.reduce((s, it) => s + it.total, 0) + Number(labourCost || 0);
  return { lineItems, totalAmount };
}

// ─── Create Quotation ─────────────────────────────────────────────────────────
// FIX: The returned object now uses `createdAt: localNow` (a real JS Date)
// instead of the Firestore serverTimestamp() sentinel. The Firestore document
// still stores serverTimestamp() for accurate server-time recording, but the
// locally returned payload has a real Date so QuotationPDF.jsx can render the
// date immediately without hitting "Invalid Date".
export async function createQuotation(quotationData, userId, userDisplayName) {
  const quotationNumber = await generateQuotationNumber();
  // Capture a real local timestamp BEFORE the Firestore write
  const localNow = new Date();

  let lineItems   = [];
  let totalAmount = 0;
  let sectionsSnap = null;

  if (quotationData.sections) {
    const built = buildLineItemsFromSections(quotationData.sections, quotationData.labourCost);
    lineItems   = built.lineItems;
    totalAmount = built.totalAmount;

    sectionsSnap = {};
    Object.entries(quotationData.sections).forEach(([key, section]) => {
      sectionsSnap[key] = {
        tableMode:      section.tableMode      || "list",
        shareFullTable: section.shareFullTable || false,
        selectedItems:  section.selectedItems  || [],
        allItems:       section.allItems       || [],
        gridColumns:    section.gridColumns    || [],
        gridRows:       section.gridRows       || [],
      };
    });
  } else {
    lineItems = (quotationData.lineItems || []).map((item) => ({
      description: item.description,
      quantity:    Number(item.quantity),
      unitPrice:   Number(item.unitPrice),
      total:       Number(item.quantity) * Number(item.unitPrice),
    }));
    totalAmount = lineItems.reduce((s, it) => s + it.total, 0) + Number(quotationData.labourCost || 0);
  }

  // Payload stored in Firestore — uses serverTimestamp() for server-accurate time
  const firestorePayload = {
    quotationNumber,
    customerName:    quotationData.customerName  || "",
    customerPhone:   quotationData.customerPhone || "",
    customerId:      quotationData.customerId    || null,
    vehicleCompany:  quotationData.isManualVehicle ? quotationData.notInListCompany : quotationData.vehicleCompany,
    vehicleModel:    quotationData.isManualVehicle ? quotationData.notInListModel   : quotationData.vehicleModel,
    vehicleYear:     quotationData.vehicleYear   || "",
    isManualVehicle: quotationData.isManualVehicle || false,
    carRepositoryId: quotationData.carRepositoryId || null,
    carDriveLink:    quotationData.carDriveLink    || "",
    carReelLinks:    quotationData.carReelLinks    || [],
    sections:          sectionsSnap,
    emissionCategory:  quotationData.emissionCategory || null,
    tableNote:         quotationData.tableNote         || "",
    priceTables:       quotationData.priceTables       || null,
    lineItems,
    labourCost:  Number(quotationData.labourCost || 0),
    totalAmount,
    notes:       quotationData.notes || "",
    pdfUrl:      null,
    status:      "draft",
    createdBy:     userId,
    createdByName: userDisplayName,
    createdAt:   serverTimestamp(),   // ← server time for Firestore accuracy
    updatedAt:   serverTimestamp(),
    whatsappSentAt: null,
    whatsappSentTo: null,
  };

  const docRef = await addDoc(collection(db, QUOTATIONS_COLLECTION), firestorePayload);

  await logAudit({
    action:           AUDIT_ACTIONS.QUOTATION_CREATED,
    userId,
    userName:         userDisplayName || "Unknown",
    targetId:         docRef.id,
    targetCollection: QUOTATIONS_COLLECTION,
    metadata: { quotationNumber, customerName: firestorePayload.customerName, totalAmount },
  });

  // Return the local payload with a real JS Date so the PDF renders correctly
  return {
    id:        docRef.id,
    ...firestorePayload,
    createdAt: localNow,    // ← real Date for immediate PDF rendering
    updatedAt: localNow,
  };
}

// ─── Fetch / Delete / Update ─────────────────────────────────────────────────

export async function fetchQuotations() {
  const q    = query(collection(db, QUOTATIONS_COLLECTION), orderBy("createdAt", "desc"), limit(200));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchQuotationById(quotationId) {
  const snap = await getDoc(doc(db, QUOTATIONS_COLLECTION, quotationId));
  if (!snap.exists()) throw new Error("Quotation not found");
  return { id: snap.id, ...snap.data() };
}

export async function deleteQuotation(quotationId, user) {
  await deleteDoc(doc(db, QUOTATIONS_COLLECTION, quotationId));
  await logAudit({
    action: "quotation.deleted", userId: user.uid,
    userName: user.displayName || user.email,
    targetId: quotationId, targetCollection: QUOTATIONS_COLLECTION, metadata: {},
  });
}

export async function updateQuotationPdfUrl(quotationId, pdfUrl) {
  await updateDoc(doc(db, QUOTATIONS_COLLECTION, quotationId), { pdfUrl, updatedAt: serverTimestamp() });
}

export async function markQuotationWhatsAppSent(quotationId, phone) {
  await updateDoc(doc(db, QUOTATIONS_COLLECTION, quotationId), {
    status: "sent", whatsappSentAt: serverTimestamp(), whatsappSentTo: phone, updatedAt: serverTimestamp(),
  });
}

export async function uploadQuotationPdf(pdfBlob, quotationNumber) {
  const fileName   = `quotations/${quotationNumber}-${Date.now()}.pdf`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, pdfBlob, { contentType: "application/pdf" });
  return await getDownloadURL(storageRef);
}

export async function sendQuotationWhatsApp(quotationId, pdfUrl, customerPhone, customerName, quotationNumber, userId) {
  const fn     = httpsCallable(functions, "sendQuotationWhatsApp");
  const result = await fn({ quotationId, pdfUrl, customerPhone, customerName, quotationNumber });
  if (result.data.success) {
    await markQuotationWhatsAppSent(quotationId, customerPhone);
    await logAudit({
      action: "quotation.whatsapp_sent", userId, userName: null,
      targetId: quotationId, targetCollection: QUOTATIONS_COLLECTION,
      metadata: { quotationNumber, customerPhone, customerName },
    });
  }
  return result.data;
}

export async function notifyCarNotInRepository({ vehicleCompany, vehicleModel, quotationId, quotationNumber, createdBy, createdByName }) {
  await addDoc(collection(db, "notifications"), {
    type: "car_not_in_repository",
    title: "New Car Model — Add to Repository",
    message: `Owner created quotation ${quotationNumber} with unregistered model: ${vehicleCompany} ${vehicleModel}`,
    vehicleCompany, vehicleModel, quotationId, quotationNumber,
    createdBy, createdByName, isRead: false, targetRole: "superadmin",
    createdAt: serverTimestamp(),
  });
}

export async function fetchCarRepository() {
  const snap = await getDocs(collection(db, "carRepository"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchBusinessSettings() {
  const snap = await getDoc(doc(db, "settings", "main"));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function searchCustomers(searchQuery) {
  const snap = await getDocs(collection(db, "customers"));
  const all  = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const q    = searchQuery.toLowerCase();
  return all
    .filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.vehicleNo?.toLowerCase().includes(q)
    )
    .slice(0, 10);
}

// ─── Update an existing quotation ────────────────────────────────────────────
// Only edits the fields passed in `updates`. Resets pdfUrl to null so the
// caller knows the PDF needs to be regenerated after saving.
export async function updateQuotation(quotationId, updates, userId, userDisplayName) {
  const ref  = doc(db, QUOTATIONS_COLLECTION, quotationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Quotation not found.");

  const payload = {
    ...updates,
    pdfUrl:    null,           // PDF is stale after any edit — force regeneration
    status:    "draft",        // Reset back to draft
    updatedAt: serverTimestamp(),
    lastEditedBy:     userId,
    lastEditedByName: userDisplayName,
    lastEditedAt:     serverTimestamp(),
  };

  await updateDoc(ref, payload);

  await logAudit({
    action:           "quotation.edited",
    userId,
    userName:         userDisplayName,
    targetId:         quotationId,
    targetCollection: QUOTATIONS_COLLECTION,
    metadata: {
      quotationNumber: snap.data().quotationNumber,
      editedByName:    userDisplayName,
      fieldsUpdated:   Object.keys(updates),
    },
  });
}