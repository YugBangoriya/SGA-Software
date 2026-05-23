/**
 * reminderUtils.js
 * Pure date arithmetic and milestone calculation for CNG re-testing reminders.
 *
 * ─── REMINDER SCHEDULE PER CYCLE (from reference date) ───────────────────────
 *
 *   Reference Date = last recorded retestDate  OR  installationDate (if no retests yet)
 *
 *   +33 months (2y 9m)  → type: 'warning_3m' → "3 months left for re-testing"
 *   +34 months (2y 10m) → type: 'warning_2m' → "2 months left for re-testing"
 *   +35 months (2y 11m) → type: 'warning_1m' → "1 month left for re-testing"
 *   +36 months (3y)     → type: 'final'      → "Get tested today — pumps deny CNG to expired kits"
 *   +37, 38... months   → type: 'overdue_N'  → "N months overdue — immediate re-testing required"
 *
 *   After owner records a re-test date → cycle restarts from that new date.
 *   Cylinder lifetime: 15 years (180 months) from installationDate. No reminders after.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const CYLINDER_LIFETIME_MONTHS = 180; // 15 years

const MILESTONE_OFFSETS = {
  warning_3m: 33,
  warning_2m: 34,
  warning_1m: 35,
  final:      36,
};

const ORDERED_MILESTONES = ['warning_3m', 'warning_2m', 'warning_1m', 'final'];

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Add N months to a date string or Date object.
 * Returns a new Date object. Uses calendar month arithmetic (not 30-day).
 */
function addMonths(dateInput, months) {
  const d = new Date(typeof dateInput === 'string' ? dateInput : dateInput);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Format a Date to YYYY-MM-DD string (no timezone conversion).
 */
function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get today's date as YYYY-MM-DD in IST (UTC+5:30).
 * Cloud Functions run in UTC — we manually shift for IST date boundaries.
 */
function todayIST() {
  const now = new Date();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 330 minutes in ms
  const istDate = new Date(now.getTime() + IST_OFFSET_MS);
  return toYMD(istDate);
}

// ── Core logic ────────────────────────────────────────────────────────────────

/**
 * Determine the reference date for a customer's current reminder cycle.
 * Priority: most recent retestDate > installationDate
 *
 * @param {string} installationDate  YYYY-MM-DD
 * @param {Array}  retestDates       Array of { retestDate: 'YYYY-MM-DD', ... }
 * @returns {string|null}            YYYY-MM-DD or null
 */
function getReferenceDate(installationDate, retestDates = []) {
  if (!installationDate) return null;
  if (!retestDates || retestDates.length === 0) return installationDate;

  // Sort descending by retestDate — take the most recent
  const sorted = [...retestDates].sort(
    (a, b) => new Date(b.retestDate) - new Date(a.retestDate)
  );
  return sorted[0].retestDate || installationDate;
}

/**
 * Check if this customer's cylinder has exceeded its 15-year lifetime.
 *
 * @param {string} installationDate  YYYY-MM-DD
 * @returns {boolean}
 */
function isCylinderExpired(installationDate) {
  if (!installationDate) return false;
  const expiryDate = addMonths(installationDate, CYLINDER_LIFETIME_MONTHS);
  const today = new Date(todayIST());
  return today >= expiryDate;
}

/**
 * Calculate the NEXT reminder milestone for a customer.
 *
 * Used in three scenarios:
 *   A) Customer first created / no nextReminderDate set yet   → currentType = null
 *   B) A reminder was just sent, advance to next milestone    → currentType = 'warning_3m' etc.
 *   C) Owner recorded a re-test date, restart cycle          → currentType = null (ref date changed)
 *
 * @param {string} installationDate
 * @param {Array}  retestDates
 * @param {string|null} currentType  The milestone type JUST sent, or null for fresh calculation
 * @returns {{ nextReminderDate: string, nextReminderType: string } | null}
 *   Returns null if cylinder is past 15-year life.
 */
function calculateNextReminder(installationDate, retestDates = [], currentType = null) {
  if (!installationDate) return null;
  if (isCylinderExpired(installationDate)) return null;

  const referenceDate = getReferenceDate(installationDate, retestDates);
  if (!referenceDate) return null;

  const todayStr = todayIST();

  // ── SCENARIO A / C: Fresh calculation — find the first upcoming milestone ──
  if (currentType === null) {
    for (const type of ORDERED_MILESTONES) {
      const milestoneDate = toYMD(addMonths(referenceDate, MILESTONE_OFFSETS[type]));
      if (milestoneDate >= todayStr) {
        return { nextReminderDate: milestoneDate, nextReminderType: type };
      }
    }
    // All 4 milestones have already passed — customer is overdue
    // Find how many whole months past the 3-year mark
    const finalDate = addMonths(referenceDate, 36);
    const today = new Date(todayStr);
    const monthsOverdue = Math.max(
      1,
      Math.ceil((today - finalDate) / (1000 * 60 * 60 * 24 * 30.44))
    );
    const nextDate = toYMD(addMonths(referenceDate, 36 + monthsOverdue));
    return {
      nextReminderDate: nextDate <= todayStr ? todayStr : nextDate,
      nextReminderType: `overdue_${monthsOverdue}`,
    };
  }

  // ── SCENARIO B: Advance from the current milestone to the next ─────────────
  const idx = ORDERED_MILESTONES.indexOf(currentType);

  if (idx !== -1 && idx < ORDERED_MILESTONES.length - 1) {
    // Still within the 4-milestone sequence — go to next
    const nextType = ORDERED_MILESTONES[idx + 1];
    return {
      nextReminderDate: toYMD(addMonths(referenceDate, MILESTONE_OFFSETS[nextType])),
      nextReminderType: nextType,
    };
  }

  // 'final' or 'overdue_N' — advance by 1 more month
  const currentOverdueN = currentType.startsWith('overdue_')
    ? parseInt(currentType.split('_')[1], 10)
    : 0; // 'final' is overdue_0 conceptually

  const nextN = currentOverdueN + 1;
  const nextDate = toYMD(addMonths(referenceDate, 36 + nextN));

  // Check cylinder lifetime won't be exceeded
  if (isCylinderExpired(installationDate)) return null;

  return {
    nextReminderDate: nextDate,
    nextReminderType: `overdue_${nextN}`,
  };
}

/**
 * Get how many months from referenceDate a given type corresponds to.
 */
function getMilestoneOffset(reminderType) {
  if (MILESTONE_OFFSETS[reminderType] !== undefined) return MILESTONE_OFFSETS[reminderType];
  if (reminderType.startsWith('overdue_')) {
    return 36 + parseInt(reminderType.split('_')[1], 10);
  }
  return 33;
}

/**
 * Get a human-readable label for a reminder type.
 */
function getReminderLabel(reminderType) {
  const labels = {
    warning_3m: '3 months left for re-testing',
    warning_2m: '2 months left for re-testing',
    warning_1m: '1 month left for re-testing',
    final:      'Re-testing due today',
  };
  if (labels[reminderType]) return labels[reminderType];
  if (reminderType && reminderType.startsWith('overdue_')) {
    const n = reminderType.split('_')[1];
    return `${n} month${n === '1' ? '' : 's'} overdue — immediate re-testing required`;
  }
  return 'CNG re-testing reminder';
}

/**
 * Get the WhatsApp template name for a given reminder type.
 * These template names MUST match what you registered in Meta Business Manager.
 *
 * ─── META TEMPLATE SUBMISSION GUIDE ─────────────────────────────────────────
 *
 * Submit 5 templates at: business.facebook.com → WhatsApp Manager → Message Templates
 *
 * [1] Name: cng_retest_3months_left  | Category: UTILITY | Language: en
 *     Body: "Dear {{1}}, your CNG kit installed in {{2}} (Reg: {{3}}) is due for
 *            re-testing in 3 months. Please visit Shree Ganesh Automobile before
 *            {{4}} to keep your vehicle compliant. — Shree Ganesh Automobile, Rajkot"
 *     Variables: {{1}}=customer_name {{2}}=vehicle_model {{3}}=vehicle_reg {{4}}=due_date
 *
 * [2] Name: cng_retest_2months_left  | Category: UTILITY | Language: en
 *     Body: "Dear {{1}}, reminder: your CNG kit ({{2}} · Reg: {{3}}) needs re-testing
 *            within 2 months (by {{4}}). Book your appointment at Shree Ganesh Automobile."
 *
 * [3] Name: cng_retest_1month_left   | Category: UTILITY | Language: en
 *     Body: "⚠️ Dear {{1}}, your CNG re-testing for {{2}} (Reg: {{3}}) is due in 1 month
 *            (by {{4}}). Please schedule your visit to Shree Ganesh Automobile soon."
 *
 * [4] Name: cng_retest_due_today     | Category: UTILITY | Language: en
 *     Body: "🚨 Dear {{1}}, your CNG certificate for {{2}} (Reg: {{3}}) expires TODAY.
 *            CNG pumps will refuse to fill vehicles with expired certificates. Visit
 *            Shree Ganesh Automobile immediately. Call us: {{4}}"
 *     Variables: {{4}} = shop phone number
 *
 * [5] Name: cng_retest_overdue       | Category: UTILITY | Language: en
 *     Body: "🚨 Dear {{1}}, your CNG re-test for {{2}} (Reg: {{3}}) is now {{4}} overdue.
 *            You may be refused CNG at petrol pumps. Please visit Shree Ganesh Automobile
 *            at the earliest. — Shree Ganesh Automobile, Rajkot"
 *     Variables: {{4}} = e.g. "2 months"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
function getWhatsAppTemplateName(reminderType) {
  const templateMap = {
    warning_3m: 'cng_retest_3months_left',
    warning_2m: 'cng_retest_2months_left',
    warning_1m: 'cng_retest_1month_left',
    final:      'cng_retest_due_today',
  };
  if (templateMap[reminderType]) return templateMap[reminderType];
  if (reminderType && reminderType.startsWith('overdue_')) return 'cng_retest_overdue';
  return 'cng_retest_3months_left';
}

module.exports = {
  addMonths,
  toYMD,
  todayIST,
  getReferenceDate,
  isCylinderExpired,
  calculateNextReminder,
  getMilestoneOffset,
  getReminderLabel,
  getWhatsAppTemplateName,
  MILESTONE_OFFSETS,
  ORDERED_MILESTONES,
};
