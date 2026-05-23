# Phase 3 — Inventory Management Module
## Shree Ganesh Automobile Business Management Software

---

## Files Delivered

```
phase3-inventory/
│
├── firestore.rules                              ← Firestore security rules (merge into existing)
├── INTEGRATION_GUIDE.js                         ← Routes, nav, dashboard & Phase 4 integration docs
│
└── src/
    ├── lib/
    │   ├── designTokens.js                      ← Brand colors, typography, shadows (shared across all phases)
    │   ├── auditService.js                      ← Append-only audit logger — call from any module
    │   └── inventoryService.js                  ← All Firestore CRUD for /inventory + /inventoryCategories
    │
    ├── store/
    │   └── inventoryStore.js                    ← Zustand global state — components never call Firestore directly
    │
    ├── hooks/
    │   └── useMediaQuery.js                     ← Responsive breakpoint detection (useIsMobile, useIsDesktop)
    │
    └── pages/Inventory/
        ├── index.jsx                            ← Main inventory list page (Owner + Employee view)
        ├── LowStockBanner.jsx                   ← Alert banner shown when items are at/below threshold
        ├── AddInventoryModal.jsx                ← Owner-only add new item form (bottom sheet)
        ├── ReplenishModal.jsx                   ← Owner-only replenish existing item form (bottom sheet)
        ├── ItemDetailPage.jsx                   ← Full item detail + restock history (route: /inventory/:itemId)
        └── CategoryManagerModal.jsx             ← Owner-only category CRUD (summoned from Settings)
```

---

## What Each Requirement Maps To

| # | Requirement | File(s) |
|---|---|---|
| 1 | Inventory list — name, category, qty, price, low-stock, date | `index.jsx` |
| 2 | Color-coded stock indicators (Green/Amber/Red) | `index.jsx` → `StockStatusBadge`, `QuantityDisplay` |
| 3 | Add Inventory form (Owner only) with amber date highlight | `AddInventoryModal.jsx` |
| 4 | Replenish existing item | `ReplenishModal.jsx` |
| 5 | Category management | `CategoryManagerModal.jsx` + `inventoryService.js` |
| 6 | Low-stock threshold per item + global default | `AddInventoryModal.jsx` + `ItemDetailPage.jsx` (inline editor) |
| 7 | In-app low-stock alert notification to Owner | `LowStockBanner.jsx` |
| 8 | Item detail + full restock history | `ItemDetailPage.jsx` |
| 9 | Profit tracking — purchase price stored per batch | `inventoryService.js` → `restockHistory` subcollection |
| 10 | Firestore `/inventory` collection + security rules | `inventoryService.js` + `firestore.rules` |
| 11 | Audit log on every add/replenish | `auditService.js` called from `inventoryService.js` |
| 12 | Design Document colors, cards, responsive (mobile-first) | All `.jsx` files use `designTokens.js` |

---

## Critical Rules Enforced

- **Employee = Read Only**: Every write operation in `inventoryService.js` is called only from
  Owner-rendered components. Firestore rules enforce this at the backend too — employee role
  has no `create` or `update` permission on `/inventory`.

- **No inventory deduction on invoice creation**: `deductInventoryForInvoice()` exists in
  `inventoryService.js` but is **deliberately not called anywhere in Phase 3**. It is exported
  specifically so Phase 4 can call it during invoice approval only. See `INTEGRATION_GUIDE.js`.

- **Per-batch purchase price history**: Every add/replenish writes a document to the
  `/inventory/{itemId}/restockHistory` subcollection with `purchasePrice` recorded. This gives
  Phase 4 the data it needs for exact profit/loss calculation per item sold.

- **Manually overridden dates are amber**: Both `AddInventoryModal` and `ReplenishModal` track
  `isDateManuallySet` (compares input value vs today's ISO string). The flag is stored in
  Firestore as `isLastDateManuallySet` and visually surfaced as an amber "M" badge in all list
  and detail views.

- **Audit log is append-only**: Firestore rules explicitly deny `update` and `delete` on
  `/auditLog`. Every inventory add and replenish writes an entry via `auditService.js`.

---

## Firestore Collections Created in Phase 3

### `/inventory/{itemId}`
```
itemName              string
categoryId            string (FK → /inventoryCategories)
quantity              number
purchasePrice         number   ← latest batch price
lowStockThreshold     number
vendorName            string
lastRestockedDate     Timestamp
isLastDateManuallySet boolean
notes                 string
createdAt             Timestamp
createdBy             string (UID)
createdByName         string
lastUpdatedAt         Timestamp
lastUpdatedBy         string (UID)
```

### `/inventory/{itemId}/restockHistory/{historyId}`
```
date              Timestamp
quantityAdded     number
purchasePrice     number    ← price per unit for this batch (Phase 4 uses this)
vendorName        string
notes             string
addedBy           string (UID)
addedByName       string
addedAt           Timestamp
isDateManuallySet boolean
entryType         'INITIAL' | 'REPLENISH'
```

### `/inventoryCategories/{categoryId}`
```
name       string
createdAt  Timestamp
createdBy  string (UID)
```

---

## Phase 4 Handoff Note

When building the Invoice Module, import from `inventoryService.js`:

```js
import { deductInventoryForInvoice } from '../lib/inventoryService';

// Call ONLY inside invoice approval handler, inside a Firestore transaction:
await deductInventoryForInvoice({ lineItems, invoiceId, user, transaction });
```

The invoice line items must store `inventoryItemId` (the Firestore document ID from `/inventory`)
so this function can locate and decrement the correct item.
