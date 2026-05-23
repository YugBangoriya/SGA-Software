// ============================================================
// PHASE 11 — INTEGRATION PATCHES
// ============================================================
// These are the exact changes needed in Phase 2 (Customer Records)
// and Phase 4 (Invoice Module) to wire them to live Settings values.
//
// Each patch shows: FILE → FIND THIS → REPLACE WITH THIS
// ============================================================


// ============================================================
// PATCH 1 — Customer Form (Phase 2)
// File: src/pages/Customers/components/CustomerForm.jsx
//       (or wherever your customer create/edit form lives)
// ============================================================

// ── STEP 1: Add import at top of CustomerForm.jsx ──────────────────────────
//
// ADD this import:
import { useSettings } from "../../hooks/useSettings";
// (adjust relative path as needed)


// ── STEP 2: Inside the component function, add this line ──────────────────
//
// ADD after your existing useState/useEffect lines:
const {
  cngKitBrands,
  cngKitModels,
  addOns,
  advancers,
  vehicleEmissionCategories,
  technicianNames,
  customFields,
} = useSettings();

// ── STEP 3: Replace hardcoded arrays ──────────────────────────────────────
//
// FIND (examples — your exact variable names may differ):
//   const CNG_BRANDS = ["Lovato", "Tomasetto", "BRC", ...];
//   const CNG_MODELS = ["Smart", "Classic", "Premium", ...];
//   const ADD_ONS = ["Fly Cutter", "Tank Guard", ...];
//   const ADVISERS = ["Standard", "Digital", ...];
//   const EMISSION = ["BS4", "BS6", "BS3"];
//   const TECHNICIANS = ["Raju", "Suresh", ...];
//
// REPLACE WITH:
//   (use the variables from useSettings() above — they are already arrays)
//   cngKitBrands, cngKitModels, addOns, advancers,
//   vehicleEmissionCategories, technicianNames


// ── STEP 4: Render custom fields after standard fields ────────────────────
//
// At the end of your customer form, BEFORE the submit button, ADD:

/*
  {customFields.length > 0 && (
    <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #E8E2DF" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#661F1F", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>
        Additional Information
      </div>
      {customFields.map((field) => (
        <div key={field.key} style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
            {field.label}
            {field.required && <span style={{ color: "#CC0000", marginLeft: 3 }}>*</span>}
          </label>
          {field.type === "text" && (
            <input
              type="text"
              value={formData.customFields?.[field.key] || ""}
              onChange={(e) => setFormData({
                ...formData,
                customFields: { ...formData.customFields, [field.key]: e.target.value }
              })}
              required={field.required}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 14, borderRadius: 8, border: "1.5px solid #E8E2DF", outline: "none", fontFamily: "inherit" }}
            />
          )}
          {field.type === "number" && (
            <input
              type="number"
              value={formData.customFields?.[field.key] || ""}
              onChange={(e) => setFormData({
                ...formData,
                customFields: { ...formData.customFields, [field.key]: e.target.value }
              })}
              required={field.required}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 14, borderRadius: 8, border: "1.5px solid #E8E2DF", outline: "none", fontFamily: "inherit" }}
            />
          )}
          {field.type === "date" && (
            <input
              type="date"
              value={formData.customFields?.[field.key] || ""}
              onChange={(e) => setFormData({
                ...formData,
                customFields: { ...formData.customFields, [field.key]: e.target.value }
              })}
              required={field.required}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 14, borderRadius: 8, border: "1.5px solid #E8E2DF", outline: "none", fontFamily: "inherit" }}
            />
          )}
          {field.type === "dropdown" && (
            <select
              value={formData.customFields?.[field.key] || ""}
              onChange={(e) => setFormData({
                ...formData,
                customFields: { ...formData.customFields, [field.key]: e.target.value }
              })}
              required={field.required}
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 8, border: "1.5px solid #E8E2DF", outline: "none", fontFamily: "inherit", background: "#fff" }}
            >
              <option value="">Select {field.label}</option>
              {(field.dropdownOptions || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  )}
*/

// ── STEP 5: Save custom fields with the customer record ───────────────────
//
// In your handleSubmit / save function, make sure the customer object includes:
//   customFields: formData.customFields || {}
// This is already supported by the /customers Firestore schema from Phase 2.


// ============================================================
// PATCH 2 — Invoice Form (Phase 4)
// File: src/pages/Invoices/components/InvoiceForm.jsx
//       (or wherever your invoice creation form lives)
// ============================================================

// ── STEP 1: Add import ─────────────────────────────────────────────────────
//
// ADD:
import { useSettings } from "../../hooks/useSettings";


// ── STEP 2: In the component function ─────────────────────────────────────
//
// ADD:
const { isGSTEnabled, gstNumber, invoiceTermsAndConditions, paymentTerms } = useSettings();


// ── STEP 3: GST conditional display ───────────────────────────────────────
//
// FIND your GST checkbox section. It probably looks like:
//   <input type="checkbox" ... /> Apply GST
//
// REPLACE the entire GST block with:
/*
  {isGSTEnabled && (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <input
        type="checkbox"
        id="applyGST"
        checked={applyGST}
        onChange={(e) => setApplyGST(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: "#661F1F" }}
      />
      <label htmlFor="applyGST" style={{ fontSize: 13, cursor: "pointer" }}>
        Apply GST (CGST + SGST) — GSTIN: {gstNumber}
      </label>
    </div>
  )}
  {!isGSTEnabled && (
    // GST is hidden when no GSTIN is set — nothing rendered here
    null
  )}
*/

// ── STEP 4: Terms & Conditions in PDF ─────────────────────────────────────
//
// FIND where you pass terms to @react-pdf/renderer or your PDF template:
//   termsAndConditions: "Goods once sold will not be returned."  // (hardcoded)
//
// REPLACE WITH:
//   termsAndConditions: invoiceTermsAndConditions
//
// invoiceTermsAndConditions comes from useSettings() and is always current.


// ── STEP 5: Payment Terms dropdown (if used in invoice) ───────────────────
//
// FIND your hardcoded payment terms / T&C preset dropdown.
// REPLACE its options array with: paymentTerms (from useSettings())


// ============================================================
// PATCH 3 — Invoice DB Locked Guard (Phase 4)
// File: src/pages/Invoices/InvoicesPage.jsx
// ============================================================

// ── In InvoicesPage.jsx, ADD this guard at the top of the component ────────
/*
  const { isInvoiceDbLocked, systemConfig } = useSettings();

  if (isInvoiceDbLocked) {
    return (
      <div style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#CC0000", marginBottom: 8 }}>
          Invoice Database Locked
        </div>
        <div style={{ fontSize: 14, color: "#666", maxWidth: 360, lineHeight: 1.6 }}>
          The invoice database has been temporarily locked by the SuperAdmin
          {systemConfig.invoiceDbLockedBy ? ` (${systemConfig.invoiceDbLockedBy})` : ""}.
          Invoice records are inaccessible until unlocked.
        </div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 12 }}>
          Contact your SuperAdmin to unlock the database.
        </div>
      </div>
    );
  }
*/

// ── Apply the same guard to: InvoiceDetailPage, CreateInvoicePage ──────────
// The guard logic is identical — copy the JSX block to each invoice-related page.


// ============================================================
// PATCH 4 — App.jsx: Initialize settings on boot
// File: src/App.jsx
// ============================================================

// ── ADD this to your root App component (inside the component body) ────────
/*
  import { useSettings } from "./hooks/useSettings";

  // Inside App() function:
  useSettings(); // This triggers initSettings() once on app load.
                 // All other components then read from the already-loaded store.
*/


// ============================================================
// PATCH 5 — Add Settings route
// File: src/App.jsx or src/router.jsx
// ============================================================

// ── ADD this route ─────────────────────────────────────────────────────────
/*
  import SettingsPage from "./pages/Settings/SettingsPage";

  // In your <Routes>:
  <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
*/


// ============================================================
// PATCH 6 — Bottom Navigation (Phase 1)
// File: src/components/BottomNav.jsx or similar
// ============================================================

// ── The "More" tab should link to Settings ─────────────────────────────────
// Make sure your existing "More / Menu" tab includes a Settings entry:
/*
  { label: "Settings", icon: <SettingsIcon />, path: "/settings" }
*/
// This was already planned in Design Document Section 4.1 (More / Menu tab).
