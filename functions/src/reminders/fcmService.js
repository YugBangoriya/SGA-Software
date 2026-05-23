/**
 * fcmService.js
 * Firebase Cloud Messaging — sends push notifications to the Owner's device(s)
 * whenever a CNG reminder is dispatched to a customer.
 *
 * Expects FCM tokens to be stored on the user document at:
 *   /users/{uid}.fcmTokens  →  string[]
 *
 * Phase 1's PWA service worker should register tokens and write them here.
 * On new SW registration: db.collection('users').doc(uid).update({ fcmTokens: arrayUnion(token) })
 */

'use strict';

const admin = require('firebase-admin');

// ── Token management ──────────────────────────────────────────────────────────

/**
 * Fetch all active FCM tokens belonging to users with role === 'owner'.
 * Returns a flat string array (may be empty if no tokens registered).
 */
async function getOwnerFcmTokens() {
  const db = admin.firestore();

  const snap = await db
    .collection('users')
    .where('role', '==', 'owner')
    .where('isActive', '==', true)
    .get();

  const tokens = [];
  snap.forEach((userDoc) => {
    const { fcmTokens } = userDoc.data();
    if (Array.isArray(fcmTokens)) {
      fcmTokens.forEach((t) => { if (t && typeof t === 'string') tokens.push(t); });
    }
  });

  return tokens;
}

/**
 * Remove stale/expired FCM tokens from all owner user documents.
 * Called automatically after a multicast send detects invalid tokens.
 *
 * @param {string[]} staleTokens
 */
async function removeStaleTokens(staleTokens) {
  if (!staleTokens.length) return;

  const db   = admin.firestore();
  const snap = await db.collection('users').where('role', '==', 'owner').get();

  const batch = db.batch();
  snap.forEach((userDoc) => {
    const { fcmTokens } = userDoc.data();
    if (!Array.isArray(fcmTokens)) return;
    const cleaned = fcmTokens.filter((t) => !staleTokens.includes(t));
    if (cleaned.length !== fcmTokens.length) {
      batch.update(userDoc.ref, { fcmTokens: cleaned });
    }
  });
  await batch.commit();
  console.log(`[FCM] Removed ${staleTokens.length} stale token(s)`);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Send a push notification to the Owner when a CNG reminder is sent.
 *
 * @param {Object} customer       Customer data { id, name, vehicleNo, ... }
 * @param {string} reminderType   e.g. 'warning_3m', 'final'
 * @param {string} reminderLabel  Human-readable label, e.g. "3 months left for re-testing"
 */
async function notifyOwnerReminderSent(customer, reminderType, reminderLabel) {
  const tokens = await getOwnerFcmTokens();

  if (tokens.length === 0) {
    console.log('[FCM] No owner FCM tokens found — skipping push notification');
    return;
  }

  const customerName = customer.name    || 'Unknown Customer';
  const vehicleNo    = customer.vehicleNo || 'N/A';

  const title = '🔔 CNG Reminder Sent';
  const body  = `Sent to ${customerName} (${vehicleNo}) — ${reminderLabel}`;

  const message = {
    notification: { title, body },

    // Deep-link data for the PWA to navigate to the reminder log on tap
    data: {
      type:       'cng_reminder_sent',
      customerId: customer.id          || '',
      vehicleNo:  customer.vehicleNo   || '',
      reminderType,
      clickAction: '/reminders', // PWA route
    },

    // Android config
    android: {
      priority: 'high',
      notification: {
        channelId: 'cng_reminders',
        color:     '#661F1F',
        priority:  'high',
        defaultSound: true,
      },
    },

    // APNs (iOS) config
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          badge: 1,
          sound: 'default',
        },
      },
    },

    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(
      `[FCM] Notification sent — success: ${response.successCount}/${tokens.length}`
    );

    // Collect and clean up invalid tokens
    const stale = [];
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || '';
        const isInvalid =
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered';
        if (isInvalid) stale.push(tokens[i]);
        else console.warn(`[FCM] Non-fatal error for token[${i}]: ${r.error?.message}`);
      }
    });

    if (stale.length > 0) await removeStaleTokens(stale);

  } catch (err) {
    // Non-fatal — reminder was still sent via WhatsApp, don't let FCM kill the job
    console.error('[FCM] Error sending multicast:', err.message);
  }
}

module.exports = { notifyOwnerReminderSent };
