# Phase 6: Car Repository — Integration Guide
# Shree Ganesh Automobile Business Management Software

This file explains exactly how to plug Phase 6 into your existing Phase 1 project.
Follow each step in order.

---

## 1. Copy the Phase 6 files into your project

```
src/
  lib/
    carRepositoryService.js       ← copy here
  hooks/
    useCarRepository.js           ← copy here
  pages/
    CarRepository/
      index.jsx                   ← copy here
      CarRepositoryAdmin.jsx      ← copy here
      CarRepositoryBrowser.jsx    ← copy here
  components/
    CarRepository/
      CarQuickSend.jsx            ← copy here
```

---

## 2. Add the route in your React Router config

Open your existing router file (e.g. `src/router.jsx` or `src/App.jsx`) and add:

```jsx
import CarRepositoryPage from './pages/CarRepository/index';

// Inside your <Routes> block, wrapped in your existing ProtectedRoute:
<Route
  path="/car-repository"
  element={
    <ProtectedRoute allowedRoles={['superadmin', 'owner']}>
      <CarRepositoryPage />
    </ProtectedRoute>
  }
/>
```

Employees have no access. The `index.jsx` entry point also has a role
fallback, but the route guard from Phase 1 is the primary protection.

---

## 3. Add Car Repository to the "More" bottom nav tab

In your existing `BottomNav.jsx` (or wherever your nav menu is built),
add Car Repository to the "More / Menu" screen:

```jsx
// Inside your More screen menu items, filtered by role:
{(user.role === 'superadmin' || user.role === 'owner') && (
  <MenuRow
    icon="🚗"
    label="Car Repository"
    onPress={() => navigate('/car-repository')}
  />
)}
```

---

## 4. Update Firestore security rules

Open your existing `firestore.rules` and add the two new collection rules
from `firestore.rules` (Phase 6 file). Merge them inside your existing
`match /databases/{database}/documents { }` block.

The two blocks to add are:
- `match /carRepository/{companyId}` — SuperAdmin write, Owner read
- `match /notifications/{notifId}` — SuperAdmin full, Owner create-only

Deploy updated rules:
```bash
firebase deploy --only firestore:rules
```

---

## 5. Using CarQuickSend in Phase 8 (Unified Messaging)

`CarQuickSend` is a self-contained reusable component. In Phase 8,
import it into your chat input toolbar:

```jsx
import CarQuickSend from '../../components/CarRepository/CarQuickSend';

// Inside your chat input area:
<div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative' }}>

  {/* Slash popup renders above the input — must be inside a relative container */}
  <CarQuickSend
    inputValue={chatInput}
    onInputChange={setChatInput}
    onMessageGenerated={(message) => {
      // Option A: Insert into chat input for owner to review before sending
      setChatInput(message);
      // Option B: Send directly via WhatsApp API
      // sendWhatsAppMessage(activeConversation.phone, message);
    }}
    isDark={isDark}
    disabled={!activeConversation}  // disable if no conversation selected
  />

  <textarea
    value={chatInput}
    onChange={(e) => setChatInput(e.target.value)}
    placeholder='Message... or type "/swift" for car quick-send'
    // ... rest of your textarea props
  />

  <button onClick={handleSend}>Send</button>
</div>
```

**The "/" slash trigger:** When `inputValue` contains `/` followed by a
search term (e.g. `/swift`), a floating popup appears automatically above
the input. The popup is positioned `bottom: 100%` relative to the
`CarQuickSend` component, so keep it inside a `position: relative` wrapper.

---

## 6. Using flagCarNotInRepository in Phase 5 (Quotation Module)

When the quotation form detects a manually entered car (not from the repo),
call this function to notify the SuperAdmin:

```js
import { flagCarNotInRepository } from '../../lib/carRepositoryService';

// Inside your quotation submission handler:
if (vehicleEnteredManually) {
  await flagCarNotInRepository({
    companyName: form.vehicleCompany,   // what the owner typed
    modelName: form.vehicleModel,       // what the owner typed
    quotationId: newQuotation.id,       // link back to the quotation
    flaggedBy: currentUser.uid,
  });
}
```

The SuperAdmin will see this as an amber notification banner at the top of
the Car Repository admin screen in real-time (via Firestore onSnapshot).

---

## 7. Using generateCarMessage in Phase 5 (Quotation PDF)

The Quotation module can also pull car media links directly:

```js
import { generateCarMessage } from '../../components/CarRepository/CarQuickSend';

// When generating quotation PDF, optionally append the car media message:
const carMediaSection = generateCarMessage(company.name, selectedModel);
```

Or fetch the model data from Firestore directly using `carRepositoryService.js`
and embed the driveLink and reelLinks into the PDF template.

---

## 8. No additional npm packages required

All Phase 6 code uses only:
- React (already installed in Phase 1)
- Firebase Firestore SDK (already installed in Phase 1)

No new dependencies needed.

---

## File Summary

| File | Purpose |
|------|---------|
| `lib/carRepositoryService.js` | All Firestore CRUD + notification functions |
| `hooks/useCarRepository.js` | React hooks: useCarRepository, useCarSearch, useCarRepoNotifications |
| `pages/CarRepository/index.jsx` | Route entry — routes to Admin or Browser by role |
| `pages/CarRepository/CarRepositoryAdmin.jsx` | SuperAdmin: full CRUD for companies, models, reel links |
| `pages/CarRepository/CarRepositoryBrowser.jsx` | Owner: read-only browse with media link display |
| `components/CarRepository/CarQuickSend.jsx` | Reusable: slash command + car selector + message preview |
| `firestore.rules` | Security rules for /carRepository and /notifications |

---

## Firestore Data Structure (reference)

```
/carRepository/{companyId}
  name: "Maruti Suzuki"
  models: [
    {
      id: "mdl_1234_abc",
      name: "Swift",
      driveLink: "https://drive.google.com/...",
      reelLinks: [
        "https://www.instagram.com/reel/ABC123/",
        "https://www.instagram.com/reel/DEF456/"
      ],
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z"
    }
  ]
  createdAt: Timestamp
  updatedAt: Timestamp

/notifications/{notifId}
  type: "car_not_in_repo"
  companyName: "Honda"
  modelName: "City EV"
  quotationId: "quot_abc123"   (or null)
  flaggedBy: "uid_owner123"
  resolved: false
  createdAt: Timestamp
```
