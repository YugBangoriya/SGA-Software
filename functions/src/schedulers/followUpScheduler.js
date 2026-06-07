/**
 * followUpScheduler.js
 * Firebase Scheduled Cloud Function — runs every day at 09:30 AM IST.
 *
 * WHAT IT DOES:
 *   1. Queries /followUps for documents where status === 'pending'
 *      AND scheduledDate <= now
 *   2. For each pending follow-up, attempts to send via the appropriate
 *      messaging platform (WhatsApp for automated sends)
 *   3. Updates the document status to: 'sent' | 'error' | 'api_not_configured' | 'skipped'
 *
 * NOTE — WhatsApp API Status:
 *   The WhatsApp Business API tokens are not yet activated for this deployment.
 *   Until activation, outbound sends will fail gracefully: the document status
 *   is set to 'api_not_configured' so no data is lost and retries are possible
 *   after the API is enabled. Logs record every attempted send.
 *
 * NOTE — Issue 4:
 *   metaSender.js currently reads credentials via functions.config() (v1 style).
 *   When Issue 4 (firebase-functions upgrade) is completed in a future session,
 *   metaSender.js will be migrated to process.env secrets (v2 style). No changes
 *   are needed in this file at that point — the interface is unchanged.
 *
 * Deploy: firebase deploy --only functions
 */

'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger }     = require('firebase-functions/v2');
const admin          = require('firebase-admin');

const { sendWhatsAppFollowUp } = require('../helpers/metaSender');

// ── Process one follow-up document ────────────────────────────────────────────

/**
 * Attempt to send the follow-up and update the Firestore document status.
 * Returns: 'sent' | 'error' | 'api_not_configured' | 'skipped'
 */
async function processFollowUp(db, docSnap) {
  const followUp = { id: docSnap.id, ...docSnap.data() };

  const {
    platform     = 'whatsapp',
    contactId,            // Phone number in E.164 (WA) or platform user ID (IG/FB)
    customerName = 'Customer',
    message,
    language     = 'en',
  } = followUp;

  // ── Validate required fields ───────────────────────────────────────────────
  if (!contactId || !message) {
    logger.warn(
      `[FollowUp] ${docSnap.id} — missing contactId or message. Marking as error.`
    );
    await docSnap.ref.update({
      status:       'error',
      errorReason:  'Missing contactId or message in document',
      processedAt:  admin.firestore.FieldValue.serverTimestamp(),
    });
    return 'error';
  }

  // ── Platform routing ───────────────────────────────────────────────────────
  if (platform !== 'whatsapp') {
    // Instagram and Facebook DMs require the owner to reply live from the inbox.
    // Automated follow-ups for IG/FB are not supported in this version.
    logger.info(
      `[FollowUp] ${docSnap.id} — platform '${platform}' does not support ` +
      `automated follow-ups. Marking as skipped.`
    );
    await docSnap.ref.update({
      status:       'skipped',
      skipReason:   `Platform '${platform}' does not support automated follow-up sends`,
      processedAt:  admin.firestore.FieldValue.serverTimestamp(),
    });
    return 'skipped';
  }

  // ── Attempt WhatsApp send ──────────────────────────────────────────────────
  try {
    await sendWhatsAppFollowUp(contactId, customerName, message, language);

    await docSnap.ref.update({
      status:  'sent',
      sentAt:  admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(
      `[FollowUp] ${docSnap.id} — ✅ Sent via WhatsApp to ${contactId} ` +
      `(${customerName}, lang: ${language})`
    );
    return 'sent';

  } catch (err) {
    // Distinguish between "API not configured yet" vs a genuine send failure.
    // A missing token typically surfaces as TypeError or an axios 401/403.
    const msg = err.message || '';
    const isApiNotConfigured =
      msg.includes('undefined') ||
      msg.toLowerCase().includes('token') ||
      msg.toLowerCase().includes('config') ||
      err.response?.status === 401 ||
      err.response?.status === 403;

    const status = isApiNotConfigured ? 'api_not_configured' : 'error';

    logger.warn(
      `[FollowUp] ${docSnap.id} — ` +
      (isApiNotConfigured
        ? '⚠️  WhatsApp API not yet configured'
        : '❌  Send failed') +
      `: ${msg}`
    );

    await docSnap.ref.update({
      status,
      errorReason:  msg || 'Unknown error',
      processedAt:  admin.firestore.FieldValue.serverTimestamp(),
    });

    return status;
  }
}

// ── The Scheduled Function ─────────────────────────────────────────────────────

/**
 * Runs every day at 09:30 AM IST.
 * Firestore composite index required on /followUps:
 *   (status ASC, scheduledDate ASC)
 * This index is already present in firestore.indexes.json.
 */
exports.followUpScheduler = onSchedule(
  {
    schedule:       'every day 09:30',
    timeZone:       'Asia/Kolkata',
    region:         'asia-south1',
    timeoutSeconds: 300,   // 5 minutes — sufficient for typical follow-up volumes
    memory:         '256MiB',
  },
  async (event) => {
    const db  = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    logger.info('[FollowUpScheduler] ─── Daily run starting ───');

    const stats = {
      total:              0,
      sent:               0,
      error:              0,
      skipped:            0,
      api_not_configured: 0,
    };

    // ── Query pending follow-ups due now or earlier ──────────────────────────
    let snap;
    try {
      snap = await db
        .collection('followUps')
        .where('status',        '==',  'pending')
        .where('scheduledDate', '<=', now)
        .get();
    } catch (queryErr) {
      logger.error('[FollowUpScheduler] Firestore query failed:', queryErr.message);
      return;
    }

    stats.total = snap.size;
    logger.info(`[FollowUpScheduler] ${snap.size} pending follow-up(s) due`);

    if (snap.empty) {
      logger.info('[FollowUpScheduler] No pending follow-ups — exiting');
      return;
    }

    // ── Process all due follow-ups (parallel — low volume, no rate-limit risk) ─
    const results = await Promise.allSettled(
      snap.docs.map((docSnap) => processFollowUp(db, docSnap))
    );

    results.forEach((result, i) => {
      const docId = snap.docs[i].id;
      if (result.status === 'fulfilled') {
        const outcome = result.value;
        stats[outcome] = (stats[outcome] || 0) + 1;
        logger.info(`  → ${docId}: ${outcome}`);
      } else {
        stats.error++;
        logger.error(`  → ${docId}: UNHANDLED EXCEPTION — ${result.reason?.message}`);
      }
    });

    logger.info('[FollowUpScheduler] ─── Run complete ───');
    logger.info(
      `  Sent: ${stats.sent} | ` +
      `Error: ${stats.error} | ` +
      `Skipped: ${stats.skipped} | ` +
      `API not configured: ${stats.api_not_configured}`
    );
  }
);