# Phase 2 — Customer Records Module
## Integration Guide for Phase 1 Developer

This document explains **exactly** what to add to the Phase 1 codebase to wire
in all Phase 2 files.

---

## 1. Copy Files Into Phase 1 Project

Copy these directories/files into your existing Phase 1 project:

```
src/lib/firebase.js          ← Only if Phase 1 doesn't already have this
src/lib/tokens.js            ← Design tokens (colors, fonts, shadows)
src/lib/auditService.js      ← Audit logging
src/lib/customerService.js   ← All Firestore CRUD for customers
src/store/customerStore.js   ← Zustand store
src/hooks/useAuth.js         ← Auth helper (adjust import to match Phase 1)
src/hooks/useTheme.js        ← Dark mode helper
src/components/ui/ui.jsx     ← Shared UI primitives
src/pages/customers/         ← All customer pages (copy entire folder)
firestore.rules              ← REPLACE Phase 1's rules with this file
firestore.indexes.json       ← Deploy compound query indexes
seed.js                      ← Run once to populate default data
```

---

## 2. Update useAuth.js

Phase 2's `useAuth.js` reads `window.__sgUser`. In Phase 1's `AuthProvider`
(or `onAuthStateChanged` handler), add this line after getting the ID token:

```js
// In Phase 1 AuthProvider — after getting idTokenResult:
const idTokenResult = await firebaseUser.getIdTokenResult();

window.__sgUser = {
  uid:         firebaseUser.uid,
  displayName: firebaseUser.displayName || 'User',
  email:       firebaseUser.email,
  role:        idTokenResult.claims.role || 'employee',
};
```

**Alternative (preferred):** If Phase 1 uses a Zustand `authStore`, replace
the `useAuth` hook body with:
```js
import useAuthStore from '../store/authStore';

const useAuth = () => {
  const { user, role } = useAuthStore();
  return {
    user, role,
    uid: user?.uid,
    displayName: user?.displayName,
    isSuperAdmin: role === 'superadmin',
    isOwner:      role === 'owner',
    isEmployee:   role === 'employee',
    isOwnerOrAbove: role === 'owner' || role === 'superadmin',
    isEmployeeOrAbove: ['employee','owner','superadmin'].includes(role),
  };
};
```

---

## 3. Add Routes to Phase 1 Router

In Phase 1's main router file (e.g. `App.jsx` or `router.jsx`):

```jsx
// Add this import:
import CustomerRoutesWrapper, { CustomerSettingsRoute } from './pages/customers/CustomerRoutes';

// Inside your <Routes> block, add:
<Route path="/customers/*" element={<CustomerRoutesWrapper />} />
<Route path="/settings/customers" element={<CustomerSettingsRoute />} />
```

---

## 4. Add "Customers" Tab to Bottom Navigation

In Phase 1's bottom navigation component, add the Customers tab:

```jsx
const NAV_TABS = [
  { path: '/',           label: 'Home',      icon: <HomeIcon /> },
  { path: '/customers',  label: 'Customers', icon: <UsersIcon /> },  // ← ADD THIS
  { path: '/invoices',   label: 'Invoices',  icon: <FileIcon /> },
  { path: '/inventory',  label: 'Inventory', icon: <BoxIcon /> },
  { path: '/more',       label: 'More',      icon: <MenuIcon /> },
];
```

The Customers tab is tab #2 per the Design Document (Section 4.1).

---

## 5. Add "Customer Settings" Link to Settings Page

In Phase 1's Settings screen (or More menu), add a link:

```jsx
<SettingsRow
  label="Customer Dropdowns"
  description="Manage CNG kit brands, add-ons, technicians"
  onClick={() => navigate('/settings/customers')}
  // Visible to: Owner + SuperAdmin
/>
```

---

## 6. Deploy Firestore Rules and Indexes

```bash
# Replace Phase 1's firestore rules with the new Phase 2 rules:
firebase deploy --only firestore:rules

# Deploy compound query indexes:
firebase deploy --only firestore:indexes

# Or deploy both at once:
firebase deploy --only firestore:rules,firestore:indexes
```

---

## 7. Run the Seed Script (First Time Only)

Before first use, seed the database with default dropdown options:

```bash
# In browser console (development):
import { seedDatabase } from './seed.js';
seedDatabase();

# Or from the browser dev console on the running app:
# (expose seedDatabase on window temporarily for testing)
```

This populates:
- `settings/main` with default CNG kit brands, models, technicians, etc.
- `settings/customFields` with an empty field list
- 3 sample customer records for testing

---

## 8. Set Custom Claims on User Accounts

Phase 1's Cloud Function (or admin script) must set the `role` custom claim
on each Firebase Auth user. Example Cloud Function:

```js
// functions/index.js (Phase 1 Cloud Function)
exports.setUserRole = functions.https.onCall(async (data, context) => {
  // Only SuperAdmin can call this
  if (context.auth.token.role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'SuperAdmin only');
  }
  await admin.auth().setCustomUserClaims(data.uid, { role: data.role });
  return { success: true };
});
```

Valid roles: `'superadmin'` | `'owner'` | `'employee'`

---

## File Map

```
Phase 2 adds these routes:
  GET /customers           → CustomerList.jsx
  GET /customers/new       → CustomerForm.jsx (create mode)
  GET /customers/:id       → CustomerDetail.jsx
  GET /customers/:id/edit  → CustomerForm.jsx (edit mode)
  GET /settings/customers  → CustomerSettings.jsx

Phase 2 reads/writes these Firestore collections:
  /customers               → All customer CRUD
  /settings/main           → Dropdown options (read by all, write by Owner+)
  /settings/customFields   → Custom field schema (SuperAdmin only)
  /auditLog                → Append-only audit trail

Phase 2 exports:
  useCustomerStore         → Zustand store for customer state
  CustomerRoutesWrapper    → Drop into Phase 1 <Routes>
  CustomerSettingsRoute    → Add to /settings route
  logAudit + AUDIT_ACTIONS → Use in all future phases for consistency
  COLORS, FONTS, RADIUS    → Design tokens for all future phases
  Button, Input, Select, MultiSelect, Badge, Card, Modal, Spinner, EmptyState
                           → Shared UI primitives for all future phases
```

---

## RBAC Summary (as implemented)

| Action                  | SuperAdmin | Owner | Employee |
|-------------------------|-----------|-------|----------|
| View customer list      | ✓         | ✓     | ✓        |
| View customer detail    | ✓         | ✓     | ✓        |
| Create customer         | ✓         | ✓     | ✓        |
| Edit customer           | ✓         | ✓     | ✓ (limited) |
| Add re-test dates       | ✓         | ✓     | ✗        |
| Edit re-test dates      | ✓         | ✓     | ✗        |
| Manage dropdown options | ✓         | ✓     | ✗        |
| Add custom fields       | ✓         | ✗     | ✗        |

Employee restriction on re-test dates is enforced at **both** the UI level
(button hidden) and the Firestore security rules level (update blocked).
