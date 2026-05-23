// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 INTEGRATION INSTRUCTIONS
// Two snippets to add to existing files. Read carefully.
// ═══════════════════════════════════════════════════════════════════════════════


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SNIPPET 1 — src/App.jsx
// Add this import at the top of your existing App.jsx:
//
//   import QuotationsPage from "./pages/quotations/QuotationsPage";
//
// Then add this route inside your <Routes> block, nested inside your
// existing ProtectedRoute wrapper that checks for 'owner' or 'superadmin' role.
// Place it alongside the other owner-level routes like /invoices, /customers.
//
// Your existing route structure probably looks like:
//
//   <Route element={<ProtectedRoute allowedRoles={["owner", "superadmin", "employee"]} />}>
//     <Route path="/dashboard"  element={<Dashboard />} />
//     <Route path="/customers/*" element={<CustomersPage />} />
//     <Route path="/invoices/*"  element={<InvoicePage />} />
//     <Route path="/inventory/*" element={<InventoryPage />} />
//   </Route>
//
// ADD within an owner+superadmin-only protected route group:
//
//   <Route element={<ProtectedRoute allowedRoles={["owner", "superadmin"]} />}>
//     <Route path="/quotations/*" element={<QuotationsPage />} />
//   </Route>
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SNIPPET 2 — functions/index.js
// Export the new Cloud Function alongside your existing Phase 4 functions.
//
// In your existing functions/index.js, add:
//
//   const { sendQuotationWhatsApp } = require("./src/quotations/sendQuotationWhatsApp");
//   exports.sendQuotationWhatsApp = sendQuotationWhatsApp;
//
// Your full functions/index.js should look like:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// functions/index.js (full file after adding Phase 5)
const admin = require("firebase-admin");
admin.initializeApp();

// ── Phase 4: Invoice functions (already exist) ────────────────────────────────
const { approveInvoice }        = require("./src/invoices/approveInvoice");
const { sendInvoiceWhatsApp }   = require("./src/invoices/sendInvoiceWhatsApp");
exports.approveInvoice          = approveInvoice;
exports.sendInvoiceWhatsApp     = sendInvoiceWhatsApp;

// ── Phase 5: Quotation functions ──────────────────────────────────────────────
const { sendQuotationWhatsApp } = require("./src/quotations/sendQuotationWhatsApp");
exports.sendQuotationWhatsApp   = sendQuotationWhatsApp;

// (Future phases add their exports here)


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SNIPPET 3 — Bottom Navigation (if you have a BottomNav component from Phase 1)
// The "More / Menu" tab (tab 5 per Design Document) should include a link to
// /quotations when the user role is 'owner' or 'superadmin'.
//
// In your BottomNav or MoreMenu component, add:
//
//   { label: "Quotations", icon: FileText, path: "/quotations", roles: ["owner", "superadmin"] }
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SNIPPET 4 — npm dependencies to install (run in project root)
//
// The PDF renderer is the only new dependency for this phase:
//
//   npm install @react-pdf/renderer
//
// All other packages (axios in functions) should already be present from Phase 4.
// If not:
//
//   cd functions && npm install axios
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SNIPPET 5 — WhatsApp API secrets setup (one-time, run in terminal)
//
// Set your WhatsApp credentials as Firebase Function secrets so they are never
// committed to source code or exposed client-side:
//
//   firebase functions:secrets:set WHATSAPP_TOKEN
//   (paste your Meta Permanent Access Token when prompted)
//
//   firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
//   (paste your WhatsApp Phone Number ID from Meta App Dashboard when prompted)
//
// These are the same secrets used in Phase 4 (invoice WhatsApp send).
// If already set, no action needed.
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIRESTORE INDEXES
// Add these composite indexes to firestore.indexes.json for the queries used:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const firestoreIndexes = {
  indexes: [
    {
      collectionGroup: "quotations",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "createdAt", order: "DESCENDING" }
      ]
    },
    {
      collectionGroup: "quotations",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "status",    order: "ASCENDING" },
        { fieldPath: "createdAt", order: "DESCENDING" }
      ]
    },
    {
      collectionGroup: "notifications",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "targetRole", order: "ASCENDING" },
        { fieldPath: "isRead",     order: "ASCENDING" },
        { fieldPath: "createdAt",  order: "DESCENDING" }
      ]
    }
  ],
  fieldOverrides: []
};

// Add these to your existing firestore.indexes.json under the "indexes" array.
// Or run: firebase deploy --only firestore:indexes

module.exports = { firestoreIndexes };
