/**
 * reminderScheduler.js
 * Firebase Scheduled Cloud Function — runs every day at 10:00 AM IST.
 *
 * WHAT IT DOES:
 *   1. Queries /customers where nextReminderDate <= today (IST)
 *   2. For each customer, checks /reminderLog for duplicates
 *   3. Sends the appropriate WhatsApp template message
 *   4. Writes a log entry to /reminderLog
 *   5. Sends an FCM push notification to the Owner
 *   6. Advances customer.nextReminderDate → next milestone
 *
 * MIGRATION SUPPORT:
 *   Phase 2 customers without nextReminderDate are backfilled automatically
 *   on the first scheduler run — no manual migration needed.
 *
 * RATE LIMIT SAFETY:
 *   Customers are processed in sequential batches of 10 with a 1-second
 *   delay between batches to respect WhatsApp API rate limits.
 */

'use strict';

const { onSchedule }   = require('firebase-functions/v2/scheduler');
const { logger }       = require('firebase-functions/v2');
const admin            = require('firebase-admin');

const {
  todayIST,
  toYMD,
  addMonths,
  getReferenceDate,
  isCylinderExpired,
  calculateNextReminder,
  getMilestoneOffset,
  getReminderLabel,
} = require('./reminderUtils');

const { sendReminderWhatsApp } = require('./whatsappService');
const { notifyOwnerReminderSent } = require('./fcmService');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Check /reminderLog to see if this exact reminder was already sent.
 * Deduplication key: customerId + reminderType + referenceDate.
 */
async function isDuplicate(db, customerId, reminderType, referenceDate) {
  const snap = await db
    .collection('reminderLog')
    .where('customerId',    '==', customerId)
    .where('reminderType',  '==', reminderType)
    .where('referenceDate', '==', referenceDate)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Write a new document to /reminderLog.
 */
async function writeReminderLog(db, customer, reminderType, reminderLabel, referenceDate, dueDate, waResult) {
  const milestoneOffset = getMilestoneOffset(reminderType);
  const milestoneDate   = toYMD(addMonths(referenceDate, milestoneOffset));

  const entry = {
    // Customer identifiers
    customerId:          customer.id,
    customerName:        customer.name         || '',
    vehicleNo:           customer.vehicleNo    || '',
    vehicleCompany:      customer.vehicleCompany || '',
    vehicleModel:        customer.vehicleModel  || '',
    phone:               customer.phone         || '',

    // Reminder metadata
    reminderType,
    reminderLabel,
    referenceDate,          // The install/retest date this cycle started from
    milestoneDate,          // The specific date this notification corresponds to
    actualDueDate: dueDate, // The 3-year re-testing deadline

    // Send outcome
    sentAt:              admin.firestore.FieldValue.serverTimestamp(),
    whatsappSuccess:     waResult.success,
    whatsappMessageId:   waResult.messageId  || null,
    whatsappError:       waResult.error       || null,

    // Status — updated to 'completed' when owner marks re-tested
    status:              'pending',

    // Re-test fields — filled in by owner via "Mark as Re-tested" flow
    retestDate:          null,
    retestRecordedAt:    null,
    retestRecordedBy:    null,
    retestNotes:         null,
  };

  const ref = await db.collection('reminderLog').add(entry);
  logger.info(`[ReminderLog] Written: ${ref.id} (${reminderType} → customer ${customer.id})`);
  return ref.id;
}

/**
 * Process one customer document:
 *   – decide whether to send
 *   – send WhatsApp
 *   – log + notify
 *   – advance nextReminderDate
 *
 * Returns: 'sent' | 'error' | 'skipped' | 'no_date' | 'duplicate' | 'expired'
 */
async function processCustomer(db, customerDoc) {
  const customer = { id: customerDoc.id, ...customerDoc.data() };

  // Must have installationDate and phone to send any reminder
  if (!customer.installationDate || !customer.phone) return 'no_date';

  // Cylinder lifetime check
  if (isCylinderExpired(customer.installationDate)) {
    // Mark permanently so we never query this customer again
    await customerDoc.ref.update({
      nextReminderDate: 'EXPIRED',
      nextReminderType: 'expired',
    });
    return 'expired';
  }

  const today         = todayIST();
  const retestDates   = customer.retestDates || [];
  const referenceDate = getReferenceDate(customer.installationDate, retestDates);

  // ── STEP 1: Backfill nextReminderDate if missing (Phase 2 migration) ────────
  let nextReminderDate = customer.nextReminderDate;
  let nextReminderType = customer.nextReminderType;

  if (!nextReminderDate || !nextReminderType) {
    const next = calculateNextReminder(customer.installationDate, retestDates, null);
    if (!next) {
      await customerDoc.ref.update({ nextReminderDate: 'EXPIRED', nextReminderType: 'expired' });
      return 'expired';
    }
    nextReminderDate = next.nextReminderDate;
    nextReminderType = next.nextReminderType;
    // Write backfill immediately so future queries work
    await customerDoc.ref.update({ nextReminderDate, nextReminderType });
    logger.info(`[Backfill] Customer ${customer.id} → nextReminderDate: ${nextReminderDate}`);

    // If backfilled date is in the future, this customer isn't due yet
    if (nextReminderDate > today) return 'skipped';
  }

  // ── STEP 2: Skip if not yet due ─────────────────────────────────────────────
  if (nextReminderDate === 'EXPIRED') return 'expired';
  if (nextReminderDate > today)       return 'skipped';

  // ── STEP 3: Duplicate check ──────────────────────────────────────────────────
  const dup = await isDuplicate(db, customer.id, nextReminderType, referenceDate);
  if (dup) {
    logger.info(`[Duplicate] Skipping already-sent ${nextReminderType} for ${customer.id}`);
    // Still advance the pointer so we don't keep re-checking
    const next = calculateNextReminder(customer.installationDate, retestDates, nextReminderType);
    await customerDoc.ref.update(
      next
        ? { nextReminderDate: next.nextReminderDate, nextReminderType: next.nextReminderType }
        : { nextReminderDate: 'EXPIRED', nextReminderType: 'expired' }
    );
    return 'duplicate';
  }

  // ── STEP 4: Compute the actual 3-year deadline for message body ──────────────
  const dueDate     = toYMD(addMonths(referenceDate, 36));
  const reminderLabel = getReminderLabel(nextReminderType);

  // ── STEP 5: Send WhatsApp template message ────────────────────────────────────
  const waResult = await sendReminderWhatsApp(customer, nextReminderType, dueDate);

  // ── STEP 6: Write to /reminderLog ────────────────────────────────────────────
  try {
    await writeReminderLog(
      db, customer, nextReminderType, reminderLabel,
      referenceDate, dueDate, waResult
    );
  } catch (logErr) {
    logger.error(`[ReminderLog] Failed to write for ${customer.id}:`, logErr.message);
  }

  // ── STEP 7: FCM push to Owner (fire-and-forget) ───────────────────────────────
  if (waResult.success) {
    notifyOwnerReminderSent(customer, nextReminderType, reminderLabel).catch((e) =>
      logger.warn(`[FCM] Non-fatal error for ${customer.id}:`, e.message)
    );
  }

  // ── STEP 8: Advance nextReminderDate on the customer document ─────────────────
  const next = calculateNextReminder(customer.installationDate, retestDates, nextReminderType);
  try {
    await customerDoc.ref.update(
      next
        ? { nextReminderDate: next.nextReminderDate, nextReminderType: next.nextReminderType }
        : { nextReminderDate: 'EXPIRED', nextReminderType: 'expired' }
    );
  } catch (advErr) {
    logger.error(`[Advance] Failed to update nextReminderDate for ${customer.id}:`, advErr.message);
  }

  return waResult.success ? 'sent' : 'error';
}

// ── The Scheduled Function ─────────────────────────────────────────────────────

/**
 * Runs every day at 10:00 AM IST.
 * Firestore query uses the composite index on (nextReminderDate ASC).
 */
exports.dailyCngReminderCheck = onSchedule(
  {
    schedule:       'every day 10:00',
    timeZone:       'Asia/Kolkata',
    region:         'asia-south1',
    timeoutSeconds: 540,  // 9 minutes max (Function v2 max = 9 min for scheduled)
    memory:         '256MiB',
    secrets: [
      'WHATSAPP_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'SHOP_PHONE_NUMBER',
    ],
  },
  async (event) => {
    const db    = admin.firestore();
    const today = todayIST();

    logger.info(`[CNG Reminders] ─── Daily run starting for ${today} ───`);

    const stats = {
      total:     0,
      sent:      0,
      error:     0,
      skipped:   0,
      no_date:   0,
      duplicate: 0,
      expired:   0,
    };

    let snap;
    try {
      // Query all customers whose next reminder date is today or earlier.
      // Composite index required: customers → nextReminderDate ASC
      // (Added to firestore.indexes.json)
      snap = await db
        .collection('customers')
        .where('nextReminderDate', '<=', today)
        .orderBy('nextReminderDate', 'asc')
        .get();
    } catch (queryErr) {
      logger.error('[CNG Reminders] Query failed:', queryErr.message);
      return;
    }

    stats.total = snap.size;
    logger.info(`[CNG Reminders] ${snap.size} customer(s) matched for today's check`);

    if (snap.empty) {
      logger.info('[CNG Reminders] No customers due — exiting');
      return;
    }

    // Process in sequential batches to avoid overwhelming WA API
    const BATCH_SIZE = 10;
    const docs = snap.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);

      // Within a batch, process in parallel
      const results = await Promise.allSettled(
        batch.map((docSnap) => processCustomer(db, docSnap))
      );

      results.forEach((result, j) => {
        if (result.status === 'fulfilled') {
          const outcome = result.value;
          stats[outcome] = (stats[outcome] || 0) + 1;
          logger.info(`  → ${docs[i + j].id}: ${outcome}`);
        } else {
          stats.error++;
          logger.error(`  → ${docs[i + j].id}: EXCEPTION — ${result.reason?.message}`);
        }
      });

      // 1-second delay between batches to respect WA rate limits
      if (i + BATCH_SIZE < docs.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info('[CNG Reminders] ─── Run complete ───');
    logger.info(`  Sent: ${stats.sent} | Error: ${stats.error} | Skipped: ${stats.skipped} | Duplicate: ${stats.duplicate} | No date: ${stats.no_date} | Expired: ${stats.expired}`);
  }
);
