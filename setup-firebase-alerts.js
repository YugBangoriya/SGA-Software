// scripts/setup-firebase-alerts.js
// Run once to configure Firebase budget alerts and Firestore usage notifications.
//
// Prerequisites:
//   npm install firebase-admin node-fetch
//   export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
//   export FIREBASE_PROJECT_ID="your-project-id"
//   export ALERT_EMAIL="your-email@example.com"
//
// Run: node scripts/setup-firebase-alerts.js

// ─────────────────────────────────────────────────────────────────────────
// PART 1: FIREBASE CONSOLE BUDGET ALERT (Manual setup — cannot be scripted)
// ─────────────────────────────────────────────────────────────────────────
//
// Firebase free tier (Spark Plan) limits:
//   Firestore reads:    50,000 / day
//   Firestore writes:   20,000 / day
//   Firestore deletes:  20,000 / day
//   Firebase Storage:   5 GB total
//   Cloud Functions:    2,000,000 invocations / month
//
// MANUAL STEPS to set usage alerts in Firebase Console:
//
// Step 1: Go to https://console.firebase.google.com
// Step 2: Select your project → ⚙️ Project Settings → Usage and billing
// Step 3: Click "Modify plan" → Switch to Blaze (pay-as-you-go)
//         NOTE: Blaze has NO monthly minimum. You only pay above free limits.
//         Without Blaze, you CANNOT set budget alerts.
//
// Step 4: Go to Google Cloud Console → Billing → Budgets & alerts
//         URL: https://console.cloud.google.com/billing/budgets
// Step 5: Create a budget:
//         - Budget name: "SGA Firebase Monthly Budget"
//         - Budget scope: Select your Firebase project
//         - Budget amount: ₹1,000 (this is just the alert threshold, not a hard cap)
//         - Alert thresholds:
//             50% → ₹500 (warning)
//             80% → ₹800 (action required)
//             100% → ₹1,000 (critical)
//         - Email alerts: Add owner email + developer email
// Step 6: Save
//
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// PART 2: CLOUD FUNCTION — Daily Firestore Usage Monitor
// Deploy this to your Cloud Functions to get proactive alerts.
// ─────────────────────────────────────────────────────────────────────────

// Copy the function below into your /functions/index.js:

/*

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const admin = require('firebase-admin');

// ── Thresholds ──────────────────────────────────────────────────────────
const LIMITS = {
  firestoreReadsPerDay:    50000,
  firestoreWritesPerDay:   20000,
  storageBytesTotal:       5 * 1024 * 1024 * 1024, // 5 GB
  functionsCallsPerMonth:  2000000,
};
const ALERT_THRESHOLD = 0.80; // Alert at 80%

// ── Daily usage check — runs every day at 8 AM IST (2:30 AM UTC) ────────
exports.dailyUsageCheck = onSchedule('30 2 * * *', async (event) => {
  const db = getFirestore();

  try {
    // Read today's usage counter from Firestore
    // (Your app must increment these counters via Cloud Functions on each operation)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const usageRef = db.doc(`_usageTracking/${today}`);
    const usageSnap = await usageRef.get();

    if (!usageSnap.exists) {
      console.log('[UsageCheck] No usage data for today yet.');
      return;
    }

    const usage = usageSnap.data();
    const alerts = [];

    const checks = [
      { key: 'firestoreReads',    limit: LIMITS.firestoreReadsPerDay,   label: 'Firestore Reads' },
      { key: 'firestoreWrites',   limit: LIMITS.firestoreWritesPerDay,  label: 'Firestore Writes' },
    ];

    for (const { key, limit, label } of checks) {
      const current = usage[key] || 0;
      const pct = current / limit;
      if (pct >= ALERT_THRESHOLD) {
        alerts.push(
          `⚠️ ${label}: ${current.toLocaleString()} / ${limit.toLocaleString()} (${Math.round(pct * 100)}% of free tier)`
        );
      }
    }

    if (alerts.length > 0) {
      await sendAlertNotification(db, alerts, today);
    }

  } catch (err) {
    console.error('[UsageCheck] Error:', err);
  }
});

async function sendAlertNotification(db, alerts, date) {
  const message = alerts.join('\n');
  const title = '🚨 SGA Firebase Usage Alert';
  const body = `Firebase usage approaching free tier limits on ${date}. Consider reviewing or upgrading.\n\n${message}`;

  // Send FCM notification to SuperAdmin
  try {
    const superAdminSnap = await db
      .collection('users')
      .where('role', '==', 'superadmin')
      .limit(1)
      .get();

    if (superAdminSnap.empty) return;

    const superAdminData = superAdminSnap.docs[0].data();
    const tokens = Object.keys(superAdminData.fcmTokens || {});

    if (tokens.length === 0) return;

    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { type: 'USAGE_ALERT', date },
    });

    console.log('[UsageCheck] Alert sent to SuperAdmin.');

    // Also log to Firestore for reference
    await db.collection('systemAlerts').add({
      type: 'FIREBASE_USAGE',
      message: body,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      alerts,
    });

  } catch (err) {
    console.error('[UsageCheck] Failed to send alert:', err);
  }
}

*/

// ─────────────────────────────────────────────────────────────────────────
// PART 3: USAGE TRACKING — Increment counters in Cloud Functions
// Add this helper to your existing Cloud Functions:
// ─────────────────────────────────────────────────────────────────────────

/*

// In your /functions/lib/usageTracking.js:

const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

async function trackUsage(reads = 0, writes = 0) {
  const today = new Date().toISOString().split('T')[0];
  const db = getFirestore();
  await db.doc(`_usageTracking/${today}`).set(
    {
      firestoreReads:  admin.firestore.FieldValue.increment(reads),
      firestoreWrites: admin.firestore.FieldValue.increment(writes),
      lastUpdated:     admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

module.exports = { trackUsage };

// Then call in your functions:
// const { trackUsage } = require('./lib/usageTracking');
// await trackUsage(0, 1); // after a write operation

*/

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║         SHREE GANESH AUTOMOBILE — FIREBASE USAGE ALERTS         ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  MANUAL STEPS REQUIRED:                                          ║
║                                                                  ║
║  1. Upgrade to Firebase Blaze (pay-as-you-go) plan              ║
║     console.firebase.google.com → Project Settings → Billing    ║
║     NOTE: No monthly minimum — only pay above free tier          ║
║                                                                  ║
║  2. Create budget alert in Google Cloud Console:                 ║
║     console.cloud.google.com/billing/budgets                     ║
║     → Budget: ₹1,000/month                                       ║
║     → Alerts: 50%, 80%, 100%                                     ║
║     → Email: owner + developer                                   ║
║                                                                  ║
║  3. Add dailyUsageCheck Cloud Function to functions/index.js     ║
║     (see PART 2 in this file)                                    ║
║                                                                  ║
║  4. Add usage tracking to existing Cloud Functions               ║
║     (see PART 3 in this file)                                    ║
║                                                                  ║
║  FREE TIER LIMITS (daily):                                       ║
║    Firestore Reads:   50,000                                     ║
║    Firestore Writes:  20,000                                     ║
║    Storage:           5 GB total                                 ║
║    Functions:         2M calls/month                             ║
║                                                                  ║
║  ALERT THRESHOLD: 80% → email + push notification to SuperAdmin  ║
╚══════════════════════════════════════════════════════════════════╝
`);
