# Phase 9: CNG Re-Testing Reminder System
## Integration Guide — Shree Ganesh Automobile PWA

---

## Files Delivered in This Phase

```
phase9/
│
├── functions/
│   ├── index.js                            ← Append exports to existing functions/index.js
│   ├── package.json                        ← Add 'axios' dependency to existing package.json
│   └── src/
│       └── reminders/
│           ├── reminderScheduler.js        ← Scheduled Cloud Function (daily at 10 AM IST)
│           ├── reminderUtils.js            ← Pure date arithmetic, milestone calculator
│           ├── whatsappService.js          ← Meta WhatsApp Cloud API dispatch
│           └── fcmService.js              ← Owner push notifications via FCM
│
├── src/
│   ├── lib/
│   │   └── reminderService.js             ← All Firestore reads/writes for reminders
│   ├── store/
│   │   └── reminderStore.js               ← Zustand state management
│   └── pages/
│       └── reminders/
│           ├── ReminderLog.jsx            ← Main screen: /reminders route (Owner only)
│           ├── MarkRetestedModal.jsx      ← Modal: record re-test date
│           └── CustomerReminderTimeline.jsx ← Embedded in CustomerDetail (Phase 2)
│
├── firestore.rules                        ← Updated rules (adds /reminderLog)
└── firestore.indexes.json                 ← All required composite indexes
```

---

## Step 1 — Install Dependencies

Inside your `functions/` folder, add `axios`:

```bash
cd functions
npm install axios
```

---

## Step 2 — Merge functions/index.js

Open your existing `functions/index.js` from Phase 1. Append these lines **after** the existing exports:

```js
// Phase 9: CNG Re-Testing Reminder System
const { dailyCngReminderCheck } = require('./src/reminders/reminderScheduler');
exports.dailyCngReminderCheck = dailyCngReminderCheck;
```

Copy the four new files into your existing `functions/src/reminders/` folder:
- `reminderScheduler.js`
- `reminderUtils.js`
- `whatsappService.js`
- `fcmService.js`

---

## Step 3 — Set Firebase Secrets

Run these three commands from your terminal (not inside functions/):

```bash
firebase functions:secrets:set WHATSAPP_TOKEN
# Paste your permanent WhatsApp Cloud API access token when prompted

firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
# Paste the Phone Number ID from Meta App Dashboard → WhatsApp → Configuration

firebase functions:secrets:set SHOP_PHONE_NUMBER
# Paste your shop's customer-facing phone number e.g. 9876543210
```

To verify secrets are set:
```bash
firebase functions:secrets:access WHATSAPP_TOKEN
```

---

## Step 4 — Deploy Firestore Indexes FIRST

**This must happen before deploying the Cloud Function.**

```bash
firebase deploy --only firestore:indexes
```

Wait for all 6 indexes to show status **"Enabled"** in Firebase Console → Firestore → Indexes.
This typically takes 2–10 minutes. Do NOT proceed until they are all enabled.

---

## Step 5 — Update Firestore Security Rules

Replace your existing `firestore.rules` with the one from this phase, which adds the `/reminderLog` collection rules while preserving all Phase 1–8 rules.

```bash
firebase deploy --only firestore:rules
```

---

## Step 6 — Deploy Cloud Functions

```bash
firebase deploy --only functions
```

After deployment, verify in Firebase Console → Functions that `dailyCngReminderCheck` appears with status **Active** and trigger type **Scheduler (every day 10:00, Asia/Kolkata)**.

---

## Step 7 — Add Frontend Files to Your Project

Copy the following files into your existing PWA `src/` folder:

```
src/lib/reminderService.js          → merge into your existing src/lib/ folder
src/store/reminderStore.js          → merge into your existing src/store/ folder
src/pages/reminders/ReminderLog.jsx
src/pages/reminders/MarkRetestedModal.jsx
src/pages/reminders/CustomerReminderTimeline.jsx
```

---

## Step 8 — Add Route to App.jsx

In your existing `App.jsx` (from Phase 1), add the `/reminders` route inside the authenticated route block:

```jsx
import ReminderLog from './pages/reminders/ReminderLog';

// Inside your <Routes> block, protected route for owner:
<Route
  path="/reminders"
  element={
    <ProtectedRoute allowedRoles={['owner', 'superadmin']}>
      <ReminderLog />
    </ProtectedRoute>
  }
/>
```

---

## Step 9 — Add "Reminders" to the More Menu (Phase 1 Navigation)

In your `MoreMenu.jsx` or wherever the **More / Menu** tab items are defined, add:

```jsx
import { Bell } from 'lucide-react';

// Inside the menu items array (visible to owner + superadmin only):
{
  label: 'CNG Reminders',
  icon:  <Bell size={20} />,
  path:  '/reminders',
  roles: ['owner', 'superadmin'],
}
```

---

## Step 10 — Add Timeline to CustomerDetail (Phase 2)

Open your existing `CustomerDetail.jsx` from Phase 2.

At the top, add the import:
```jsx
import CustomerReminderTimeline from '../reminders/CustomerReminderTimeline';
```

Inside the JSX, add the timeline after the CNG Details section:
```jsx
{/* CNG Re-Testing History — Phase 9 */}
<CustomerReminderTimeline
  customer={customer}
  onRetested={(result) => {
    // Refresh customer data to reflect new retestDates[] and nextReminderDate
    fetchCustomer(customerId);
  }}
/>
```

---

## Step 11 — Backfill Existing Customers

Existing customers from Phase 2 do **not** have `nextReminderDate` or `nextReminderType` fields yet.

**No manual migration needed.** The Cloud Function automatically backfills these fields the first time it runs for each customer. On the very first 10 AM IST run after deployment, every customer with an `installationDate` will get their `nextReminderDate` calculated and written.

If you want to force an immediate backfill for testing, use the Firebase Functions shell:

```bash
firebase functions:shell
# Inside shell:
dailyCngReminderCheck.run({})
```

---

## Step 12 — Submit WhatsApp Templates to Meta

Go to: **business.facebook.com → WhatsApp Manager → Message Templates → Create Template**

Submit all 5 templates (details in `whatsappService.js` comments):

| Template Name               | When Sent                        |
|-----------------------------|----------------------------------|
| `cng_retest_3months_left`   | 2 years 9 months from ref date   |
| `cng_retest_2months_left`   | 2 years 10 months from ref date  |
| `cng_retest_1month_left`    | 2 years 11 months from ref date  |
| `cng_retest_due_today`      | 3 years from ref date            |
| `cng_retest_overdue`        | Monthly after 3-year deadline    |

**Template approval takes 24–72 hours.** The Cloud Function will still run and log entries during this period, but WhatsApp delivery will fail until templates are approved. Logs will show `whatsappSuccess: false` with the error reason.

---

## How the System Works End-to-End

```
Customer installed Jan 1, 2023
    │
    ├─ nextReminderDate = Oct 1, 2025  (33 months)  type: warning_3m
    ├─ nextReminderDate = Nov 1, 2025  (34 months)  type: warning_2m
    ├─ nextReminderDate = Dec 1, 2025  (35 months)  type: warning_1m
    └─ nextReminderDate = Jan 1, 2026  (36 months)  type: final

Daily at 10AM IST:
    Cloud Function queries: WHERE nextReminderDate <= today
    → Finds customer
    → Sends WhatsApp template
    → Writes to /reminderLog
    → Sends FCM push to owner
    → Advances customer.nextReminderDate to next milestone

Owner taps "Mark as Re-tested" → enters Feb 15, 2026:
    → retestDates[] gets new entry {retestDate: "2026-02-15", ...}
    → nextReminderDate = Nov 15, 2028  (33 months from Feb 15, 2026)
    → nextReminderType = "warning_3m"
    → All pending reminderLog entries → status: "completed"
    → Cycle restarts from new reference date
```

---

## Testing Checklist

- [ ] `firebase deploy --only firestore:indexes` — all 6 indexes enabled
- [ ] `firebase deploy --only firestore:rules` — deployed successfully
- [ ] `firebase deploy --only functions` — `dailyCngReminderCheck` visible in Console
- [ ] Secrets set: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, SHOP_PHONE_NUMBER
- [ ] Manually run function via shell — check Firebase Functions logs
- [ ] `/reminders` route loads — Reminder Log screen appears
- [ ] Customer Detail shows the CNG Re-Testing History section
- [ ] "Mark as Re-tested" modal opens and saves correctly
- [ ] Re-test date saves to customer.retestDates[] in Firestore
- [ ] nextReminderDate updates to retestDate + 33 months
- [ ] WhatsApp template messages approved in Meta Business Manager
- [ ] Test WhatsApp delivery with a real customer phone (your own number)
- [ ] FCM notification arrives on owner's device when reminder is sent

---

## Monitoring & Logs

View Cloud Function logs:
```bash
firebase functions:log --only dailyCngReminderCheck
```

Or in Firebase Console → Functions → Logs → filter by `dailyCngReminderCheck`.

Each run logs:
- How many customers matched
- Result per customer: `sent | skipped | duplicate | error | no_date | expired`
- WhatsApp message IDs on success
- Error messages on failure

---

*Phase 9 complete. Next: Phase 10 — Reporting & Audit Trail.*
