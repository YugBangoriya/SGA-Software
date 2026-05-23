# Shree Ganesh Automobile — Business Management Software

A private, role-based, mobile-first Progressive Web Application (PWA) for
managing CNG kit installation operations: customers, invoices, inventory,
quotations, unified messaging, and automated reminders.

---

## Tech Stack

| Layer         | Technology                                     |
| ------------- | ---------------------------------------------- |
| Frontend      | React 18 + Vite + Tailwind CSS + Zustand       |
| Backend       | Firebase (Firestore, Auth, Storage, Functions) |
| Hosting       | Firebase Hosting (free tier)                   |
| Messaging     | WhatsApp Business API + Meta Graph API (IG/FB) |
| Notifications | Firebase Cloud Messaging (FCM)                 |
| Translation   | Google Cloud Translation API                   |

---

## Project Structure

```
shree-ganesh-automobile/
├── src/
│   ├── components/        UI components (layout, invoices, shared ui)
│   ├── pages/             One folder per module
│   │   ├── customers/     Phase 2
│   │   ├── inventory/     Phase 3
│   │   ├── invoices/      Phase 4
│   │   ├── quotations/    Phase 5
│   │   ├── carRepository/ Phase 6
│   │   ├── docsRepository/Phase 7
│   │   ├── messaging/     Phase 8
│   │   ├── reminders/     Phase 9
│   │   ├── reporting/     Phase 10
│   │   └── settings/      Phase 11
│   ├── store/             Zustand state stores
│   ├── lib/               Firebase services, API clients, helpers
│   ├── hooks/             Custom React hooks
│   ├── locales/           i18n (English + Gujarati)
│   └── assets/            Logo and static assets
├── functions/
│   ├── src/
│   │   ├── index.js       MERGED entry point (Phases 1+4+8+9+11)
│   │   ├── invoiceApproval.js
│   │   ├── whatsappInvoice.js
│   │   ├── webhooks/      WhatsApp, Instagram, Facebook webhooks
│   │   ├── schedulers/    Follow-up scheduler
│   │   ├── helpers/       Meta sender, translation, message store
│   │   ├── callables/     sendReplyMessage
│   │   └── reminders/     CNG reminder scheduler
│   └── package.json
├── public/                PWA icons, manifest, service worker
├── docs/                  Integration guides + user guides
├── firestore.rules        Final consolidated security rules (Phase 12)
├── firestore.indexes.json Merged indexes (Phases 1+2+9+10)
├── storage.rules          Firebase Storage rules (Phase 7)
├── firebase.json          Firebase project config
└── .env.local.example     Environment variable template
```

---

## Quick Start

### Prerequisites

- Node.js v20 LTS
- Firebase CLI: `npm install -g firebase-tools`
- Git

### 1. Install dependencies

```bash
npm install
cd functions && npm install && cd ..
```

### 2. Configure environment

Copy `.env.local.example` to `.env` and fill in your Firebase credentials:

```bash
cp .env.local.example .env
```

### 3. Link to Firebase project

```bash
firebase login
firebase use --add   # select your Firebase project
```

### 4. Run locally

```bash
npm run dev
# App opens at http://localhost:5173
```

### 5. Run with Firebase emulators

```bash
firebase emulators:start --only functions,firestore,auth
```

### 6. Deploy to production

```bash
npm run build
firebase deploy
```

---

## Roles

| Role       | Access Level                                             |
| ---------- | -------------------------------------------------------- |
| SuperAdmin | Full god-mode. User management, DB backup, system config |
| Owner      | Full business access. Messaging, invoices, quotations    |
| Employee   | Create pending invoices, view customers & inventory      |
| Accountant | Placeholder — not implemented in v1                      |

---

## Environment Variables

See `.env.local.example` for the full list. Key variables:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
VITE_WHATSAPP_PHONE_NUMBER_ID
VITE_WHATSAPP_WABA_ID
VITE_GOOGLE_TRANSLATE_API_KEY
```

Cloud Function secrets are set via:

```bash
firebase functions:config:set whatsapp.access_token="..." meta.page_access_token="..."
```

---

## Modules (Build Order)

| Phase | Module                    | Status |
| ----- | ------------------------- | ------ |
| 1     | Project Setup & Auth      | ✅     |
| 2     | Customer Records          | ✅     |
| 3     | Inventory Management      | ✅     |
| 4     | Invoice Module            | ✅     |
| 5     | Quotation Module          | ✅     |
| 6     | Car Repository            | ✅     |
| 7     | Docs Repository           | ✅     |
| 8     | Unified Messaging         | ✅     |
| 9     | CNG Reminders             | ✅     |
| 10    | Reporting & Audit         | ✅     |
| 11    | Settings & Administration | ✅     |
| 12    | PWA Optimization          | ✅     |

---

## Docs

See the `/docs` folder for:

- `user-guides/` — Owner, Employee, SuperAdmin user guides + UAT checklist
- `INTEGRATION_phase*.md` — Per-phase wiring notes

---

> ⚠️ This is a **private business application** built for a real client.
> Credentials and API keys are not included. See `.env.local.example` for setup.
