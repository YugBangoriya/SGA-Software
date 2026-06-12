<div align="center">

# SGA Business Management Software

### A fully deployed, role-controlled Progressive Web Application custom-built for an automotive CNG kit installation business

**Live Deployment →** [sga-software.web.app](https://sga-software.web.app)

</div>

---

## About Shree Ganesh Automobile

Shree Ganesh Automobile is a direct-to-consumer automotive business specialising in CNG (Compressed Natural Gas) kit installation for private and commercial vehicles. Operating out of a physical workshop, the business handles everything from customer acquisition and vehicle consultations to CNG kit procurement, professional installation, and post-installation servicing — including mandatory government-mandated re-testing every three years.

Before this software, the business was running entirely on a patchwork of disconnected tools: customer information spread across Excel files and WhatsApp conversations, invoices generated through legacy software with no connection to inventory, stock levels tracked informally with no alerts, and quotations sent as manually typed WhatsApp messages. Customer re-testing reminders — a regulatory requirement — were tracked manually or missed entirely. Every day of normal operations required navigating between four or five different tools, with no single source of truth for any part of the business.

The business needed more than digitisation — it needed unification. A single system that understood the specific workflows of a CNG installation business and could replace the entire fragmented stack with something coherent, secure, and genuinely designed for the way the team actually works.

---

## What I Built & Why

SGA Software is a role-controlled Progressive Web Application that consolidates the entirety of Shree Ganesh Automobile's daily operations into one platform. It is a private, internal tool — not a consumer product — built for a team of two to ten users with carefully defined access boundaries for each role.

The brief was clear: the software needed to feel like it was made specifically for this business, not like a generic tool adapted to fit. That shaped every decision — the CNG-specific data fields in customer records, the automated re-testing reminder lifecycle that tracks each customer through a 15-year cylinder lifespan, the invoice approval workflow that reflects how the Owner and Employees actually collaborate, and the quotation system designed to reduce the friction between a sales conversation and a professionally delivered quote.

The result is a fully deployed, actively used product that replaced four disconnected tools with one unified platform — and continues to be maintained and updated based on client feedback.

---

## Features Overview

### 🔐 Authentication & Role-Based Access Control
Three active user roles — SuperAdmin, Owner, and Employee — each with a carefully bounded permission set enforced at two independent layers: the React application routing layer and the Firestore database security rules layer. Role information is embedded in JWT tokens as server-set custom claims and evaluated at the database level, ensuring that no client-side manipulation can bypass data access controls. The Owner can remotely invalidate employee sessions; the SuperAdmin can remotely invalidate all sessions and block accounts entirely.

### 🧑‍🤝‍🧑 Customer Records Management
Comprehensive customer profiles capturing every CNG-relevant detail — vehicle registration, make and model, emission category, kit brand and specifications, installation date, and technician. A dynamic custom fields system allows the business to extend the customer data model at any time without any code changes. Real-time search and filter across the full customer list. Re-test date history tracked per customer with a visual reminder timeline.

### 📦 Inventory Management
Real-time stock tracking with three-tier colour-coded indicators (sufficient / low / critical), configurable per-item thresholds, and a complete restock history subcollection. A selling price field on each item auto-fills during invoice creation, removing the opportunity for inconsistent ad hoc pricing. The low-stock count surfaces directly on the dashboard for at-a-glance monitoring.

### 🧾 Invoice Module
A five-step creation wizard covering customer selection, item selection with auto-pricing, labour costs, discount and payment method, and a full review before submission. Invoices created by Employees enter a pending approval state with no inventory impact — inventory is deducted only when the Owner approves. The full lifecycle includes: return invoice processing with automatic inventory reinstatement, a pending payments dashboard, date override with visual flagging, and client-side PDF generation with full business branding. Invoice numbers follow a date-based format (`INV-DD-MM-YYYY-XXX`) for intuitive physical filing reference.

### 📋 Quotation Generator
Branded quotation PDFs built around a Car Repository of vehicle-specific media links. When a vehicle model is in the repository, its associated Google Drive images and Instagram installation reels are automatically pulled into the quotation document. Quotations are numbered, dated, stored permanently, and designed for direct WhatsApp delivery to the prospective customer.

### 🚗 Car Repository
A hierarchical database of Car Company → Car Model → Media Links, managed exclusively by SuperAdmin. Feeds directly into the quotation creation flow. When a new model is not yet in the repository, SuperAdmin receives an automatic notification to update it — ensuring the repository stays current.

### 📁 Docs Repository
Centralised file storage for business documents — price lists, banners, installation media — with category-based organisation, PDF and image preview, and a quick-send integration accessible directly from the Messaging chat view without navigating away.

### 💬 Unified Messaging Module
A three-platform unified inbox integrating WhatsApp Business, Instagram DMs, and Facebook Messenger into a single interface. Each conversation is tagged by platform. A private notes panel allows the Owner to maintain internal context per conversation — never transmitted to the customer. Follow-up scheduling, multi-language template management (English, Hindi, Gujarati), and a three-panel desktop layout are all fully built. Backend Cloud Functions and webhook handlers are deployed; live API activation is pending the client's decision to activate the paid messaging plans.

### ⏰ CNG Re-Testing Reminder System
A Firebase Scheduled Cloud Function that runs daily, scans all customer records, and identifies anyone approaching their re-testing deadline. Escalating reminders are dispatched at defined milestones, up to and including the expiry date, with a message appropriate to the urgency at each stage. The system manages the full reminder lifecycle — from dispatch through to Owner notification, re-test date recording, and automatic scheduling of the next cycle. Each CNG cylinder has a 15-year lifespan, meaning up to five reminder cycles per customer.

### 📊 Reporting & Analytics
A full reporting suite: profit/loss analysis with line-item loss flagging and Recharts visualisations, an append-only audit trail with filter-by-user and filter-by-date, a pending receivables summary, a customer acquisition pipeline, and a follow-up performance tracker. The dashboard home surfaces live summary counts — pending invoices, low stock, upcoming reminders, pending follow-ups — with one-tap navigation into each.

### ⚙️ Settings & Administration
A layered settings panel structured by role: SuperAdmin controls user management, invoice database lock and backup operations, custom fields, and system configuration; Owner controls all business-facing settings — branding, GST configuration, dropdown options, follow-up templates, and inventory categories; all users control personal preferences for theme and language.

### 📱 Progressive Web App
Installable via browser on Android and iOS with Add to Home Screen. Service worker caches the application shell for offline read access. Firebase Cloud Messaging delivers push notifications for key events. HTTPS enforced across all routes via the Firebase Hosting CDN.

---

## Tech Stack

| Technology | Category | Version | Purpose |
|---|---|---|---|
| React | Frontend Framework | v19.2 | Component architecture; all UI |
| Vite | Build Tool | v8.0 | Development server; production bundler |
| Tailwind CSS | Styling | v3.4 | Utility-first styling with dark mode |
| React Router DOM | Routing | v7.1 | Client-side routing; protected routes |
| Zustand | State Management | v5.0 | Global application state |
| React Hook Form + Zod | Forms & Validation | RHF v7.7 / Zod v4.3 | Type-safe form handling across all modules |
| Firebase SDK | BaaS Platform | v12.1 | Auth, Firestore, Storage, Functions, Hosting, FCM |
| Cloud Firestore | Database | v12 | Primary data store — 14 collections |
| Firebase Cloud Functions | Serverless Backend | Node.js 22, 2nd Gen (Cloud Run) | Business logic, scheduling, webhook processing |
| @react-pdf/renderer | PDF Generation | v4.5 | Client-side invoice and quotation PDFs |
| Recharts | Data Visualisation | v3.8 | Profit/Loss and reporting charts |
| i18next + react-i18next | Internationalisation | v26 / v17 | English and Gujarati language support |
| vite-plugin-pwa | PWA Tooling | v1.2 | Service worker generation; PWA manifest |
| lucide-react | Icons | v1.11 | All iconography throughout the application |
| Meta Cloud API (WhatsApp) | External API | — | Messaging infrastructure (pending activation) |
| Meta Graph API (IG/FB) | External API | — | Unified inbox infrastructure (pending activation) |
| AntiGravity | Development Environment | — | Primary IDE and AI-assisted development |
| Firebase CLI | Deployment | Latest | Hosting, Functions, and Rules deployment |

---

## Project Status

| Attribute | Status |
|---|---|
| **Build Status** | ✅ Complete |
| **Deployment** | ✅ Live at [sga-software.web.app](https://sga-software.web.app) |
| **Client Delivery** | ✅ Delivered — actively used |
| **Post-Deployment Maintenance** | ✅ Ongoing — features added based on client feedback |
| **External API Activation** | 🔶 Pending client decision (WhatsApp, Instagram, Facebook) |

---

## Recent Updates

**June 2026 —** The Cloud Functions backend was upgraded to `firebase-functions` v7.2.5, with all functions migrated to **Node.js 22, 2nd Generation (Cloud Run)**. This completes the post-deployment maintenance cycle: all four issues identified after initial deployment — the reminder-scheduler document dependency, the Secret Manager migration for API credentials, the Node.js runtime upgrade, and the firebase-functions v7 upgrade itself — are now fully resolved, deployed, and verified in production. As with the original deployment, the Cloud Functions configuration relies on a `functions/.env` file and Secret Manager secrets, neither of which are committed to version control.

---

## Portfolio Note

This is a privately deployed client application. Live login access is not available — the application uses role-based authentication with credentials managed exclusively for the client's internal team.

The live URL ([sga-software.web.app](https://sga-software.web.app)) is included so you can see the login screen, branding, and application shell. All functional screens require an authenticated session.

For a complete walkthrough of every screen, feature, design decision, technical architecture, and the full build process — including a screen-by-screen demo guide with screenshots — visit the **[GitHub Wiki](../../wiki)**.

---

## About the Builder

**Yug Bangoriya** is a Bachelor of Science student in Computer Science with a minor in Entrepreneurship. His approach to software development is rooted in systems architecture, product thinking, and AI-native execution — translating complex business requirements into functional software through the intersection of CS fundamentals and entrepreneurial reasoning.

SGA Software was designed and shipped entirely through prompt engineering. Every module, every security decision, every database design choice, and every user-facing interaction was the product of deliberate systems thinking — knowing what to build, why to build it, and how the pieces connect — not line-by-line syntax authorship. The CS coursework that underpins the product — database design, cybersecurity, computer networks, human-computer interaction, software engineering — was applied directly and measurably to every architectural decision in the codebase.

This project represents a belief: that the ability to design, architect, and ship a product that solves a real business problem is the measure that matters. Not the tools or processes which were used to build it.

---

## Explore the Full Documentation

The GitHub Wiki for this project is a multi-page technical and reflective documentation suite covering:

- **1. Project Overview** — Business context, problem statement, feature map, and user personas
- **2. Technical Architecture** — Stack deep-dive, system architecture, and data flow
- **3. The Build — A Chronicle** — The story of the project from first client conversation to live product, told in chronological order
- **4. Feature Deep-Dive & Demo Guide** — Screen-by-screen walkthrough of every feature with screenshot guidance
- **5. The Build Process Reflections** — A first-person account of building with AI, the new era of software development, and the CS + Entrepreneurship intersection
- **6. Challenges & Problem Solving** — Specific bugs, root cause analyses, and what they taught me about building real systems
- **7. Academic-to-Product Bridge** — Various courses mapped to the specific features and architectural decisions they produced, stated directly
- **8. Project Retrospective** — What I would do differently, what I'm most proud of, and what this build revealed about how I think

---
<div align="center">
  
[![Status](https://img.shields.io/badge/Status-Deployed_%26_Active-success?style=flat-square)](https://sga-software.web.app)
[![React](https://img.shields.io/badge/React-v19.2-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-v12-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Vite](https://img.shields.io/badge/Vite-v8.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square)](https://sga-software.web.app)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](#)

---

*Built by Yug Bangoriya — 2026*

</div>
