# Phase 11 — Settings & Administration
## Shree Ganesh Automobile Business Management PWA

---

## Files Delivered

```
phase11/
├── src/
│   ├── lib/
│   │   └── settingsService.js          ← All Firestore read/write for settings
│   ├── store/
│   │   └── settingsStore.js            ← Zustand global settings store
│   ├── hooks/
│   │   └── useSettings.js             ← Drop-in hook for any component
│   ├── pages/
│   │   ├── Settings/
│   │   │   ├── index.js               ← Barrel exports
│   │   │   ├── SettingsPage.jsx       ← Master shell with role-based tabs
│   │   │   └── components/
│   │   │       ├── SettingsUI.jsx     ← Shared UI primitives
│   │   │       ├── SuperAdmin/
│   │   │       │   ├── UserManagement.jsx      ← Full user CRUD
│   │   │       │   ├── InvoiceDBControls.jsx   ← Lock/unlock/backup/delete
│   │   │       │   └── CustomFieldsManager.jsx ← Dynamic customer fields
│   │   │       ├── Owner/
│   │   │       │   ├── BusinessInfo.jsx         ← Name/address/logo/links
│   │   │       │   ├── GSTAndTerms.jsx          ← GST + low stock + T&C
│   │   │       │   ├── DropdownManager.jsx      ← All CNG dropdown values
│   │   │       │   └── FollowUpTemplates.jsx    ← EN/HI/GU template CRUD
│   │   │       └── User/
│   │   │           └── UserPreferences.jsx      ← Theme/language/password
│   │   └── Customers/
│   │       └── components/
│   │           └── CustomerCustomFields.jsx ← Custom fields on profile page
│   └── INTEGRATION_PATCHES.js        ← Exact patches for Phase 2 & 4
├── functions/
│   ├── package.json                  ← Cloud Functions dependencies
│   └── src/
│       └── index.js                  ← createUser, blockUser, exportZip, etc.
└── firestore.rules                   ← Complete updated security rules
```

---

## Step-by-Step Setup

### Step 1 — Install Cloud Functions dependencies

```bash
cd functions
npm install
cd ..
```

### Step 2 — Add route to your router

In `src/App.jsx` or `src/router.jsx`:

```jsx
import { SettingsPage } from "./pages/Settings";

// Inside <Routes>:
<Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
```

### Step 3 — Initialize settings on app boot

In `src/App.jsx`, inside the root component body:

```jsx
import { useSettings } from "./hooks/useSettings";

function App() {
  useSettings(); // Seeds store once on boot — all other components read from cache
  // ... rest of your App
}
```

### Step 4 — Apply Integration Patches

Open `src/INTEGRATION_PATCHES.js` and follow each patch:

| Patch | File | What changes |
|-------|------|-------------|
| PATCH 1 | `CustomerForm.jsx` | Replace hardcoded dropdown arrays with `useSettings()` values + render custom fields |
| PATCH 2 | `InvoiceForm.jsx` | Wire GST conditional display + T&C text to live settings |
| PATCH 3 | `InvoicesPage.jsx` | Add DB locked guard screen |
| PATCH 4 | `App.jsx` | Boot-time settings init |
| PATCH 5 | `App.jsx` / router | Add `/settings` route |
| PATCH 6 | `BottomNav.jsx` | Settings link in More tab |

### Step 5 — Add CustomerCustomFields to profile page

In your existing `CustomerProfilePage.jsx` (Phase 2), import and render the component:

```jsx
import CustomerCustomFields from "../components/CustomerCustomFields";

// At the bottom of the profile, before the closing div:
<CustomerCustomFields customer={customer} />
```

### Step 6 — Deploy Firestore security rules

```bash
firebase deploy --only firestore:rules
```

### Step 7 — Deploy Cloud Functions

```bash
firebase deploy --only functions
```

This deploys: `createUser`, `updateUser`, `resetUserPassword`, `blockUser`,
`forceLogoutUser`, `listUsers`, `exportInvoicesZip`.

### Step 8 — First run (Firestore seeding)

On first load, `settingsService.js` auto-seeds `/settings/main` and
`/systemConfig/main` with defaults if they don't exist yet. Nothing manual needed.

---

## Firestore Collections Added / Updated

| Collection | Added in Phase 11 | Notes |
|---|---|---|
| `/settings/main` | ✅ New | Business info, GST, thresholds, dropdowns, T&C |
| `/settings/customFields` | ✅ New | Custom field schema definitions |
| `/systemConfig/main` | ✅ New | Invoice DB lock state |
| `/followUpTemplates` | ✅ New | EN/HI/GU message templates |
| `/users` | Updated | `isActive`, `lastPasswordChange` fields added |

---

## Role-Based Access Summary

| Section | SuperAdmin | Owner | Employee |
|---|---|---|---|
| User Management | ✅ Full CRUD | ❌ | ❌ |
| Invoice DB Controls | ✅ Lock/Unlock/Export/Delete | ❌ | ❌ |
| Car Repository Link | ✅ Shortcut | ❌ | ❌ |
| Custom Fields | ✅ Full CRUD | ❌ | ❌ |
| Business Information | ✅ (god-mode) | ✅ | ❌ |
| GST Settings | ✅ (god-mode) | ✅ | ❌ |
| Low Stock Default | ✅ (god-mode) | ✅ | ❌ |
| Dropdown Values | ✅ (god-mode) | ✅ | ❌ |
| Follow-Up Templates | ✅ (god-mode) | ✅ | ❌ |
| Terms & Conditions | ✅ (god-mode) | ✅ | ❌ |
| Theme Toggle | ✅ | ✅ | ✅ |
| Language Toggle | ✅ | ✅ | ✅ |
| Change Password | ✅ | ✅ | ✅ |

---

## How Other Modules Read Settings

Any component in any phase can now do:

```jsx
import { useSettings } from "../../hooks/useSettings";

function MyComponent() {
  const {
    isGSTEnabled,        // boolean — controls GST checkbox visibility
    gstNumber,           // string — GSTIN for PDF
    businessName,        // string — for PDF headers
    businessLogoUrl,     // string — for PDF headers
    cngKitBrands,        // string[] — dropdown options
    cngKitModels,        // string[] — dropdown options
    addOns,              // string[] — multi-select options
    advancers,           // string[] — multi-select options
    vehicleEmissionCategories, // string[]
    technicianNames,     // string[]
    paymentTerms,        // string[] — invoice T&C presets
    invoiceTermsAndConditions, // string — invoice PDF footer
    isInvoiceDbLocked,   // boolean — for invoice guard
    customFields,        // FieldDef[] — extra customer record fields
    followUpTemplates,   // Template[] — for messaging module
    globalLowStockThreshold, // number
    instagramUrl,        // string — for quotation PDF links
    facebookUrl,         // string — for quotation PDF links
    googleMapsUrl,       // string — for quotation PDF links
  } = useSettings();
}
```

---

## Notes

- **No hardcoded dropdowns remain** in Phase 2 or Phase 4 after applying the patches.
  All dropdown options come from `/settings/main` via the Zustand store.
- **GST is fully wired**: when GSTIN is empty, the GST checkbox does not render
  anywhere in the app. When filled, it appears in invoice creation.
- **Invoice DB lock** is enforced at both the Firestore rules level (backend) and
  the UI level (locked guard screen). Both layers must agree.
- **Custom fields** added by SuperAdmin appear immediately on the customer form
  after saving — no code deployment needed.
- **Follow-up templates** written here are read directly by the Phase 8
  messaging module's follow-up scheduler with no changes to Phase 8.

---

*Phase 11 complete. Next: Phase 12 — PWA Optimization & Launch Prep.*
