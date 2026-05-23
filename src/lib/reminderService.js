/**
 * reminderService.js
 * All Firestore read/write operations for Phase 9: CNG Re-Testing Reminders.
 *
 * Consumed by:
 *   - reminderStore.js (Zustand store)
 *   - ReminderLog.jsx (main UI screen)
 *   - CustomerDetail reminder section
 *
 * Collections used:
 *   /reminderLog      — one doc per reminder sent (written by Cloud Function)
 *   /customers        — updated when owner marks re-test (nextReminderDate recalculated)
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { logAudit, AUDIT_ACTIONS } from './auditService';

// ─────────────────────────────────────────────────────────────────────────────
// DATE UTILITIES  (mirrored from reminderUtils.js — kept pure, no Node deps)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add N calendar months to a YYYY-MM-DD string.
 * Returns YYYY-MM-DD string.
 */
export function addMonths(dateStr, months) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get the reference date for a customer's current reminder cycle.
 * Priority: most recent retestDate > installationDate
 */
export function getReferenceDate(installationDate, retestDates = []) {
  if (!installationDate) return null;
  if (!retestDates || retestDates.length === 0) return installationDate;
  const sorted = [...retestDates].sort(
    (a, b) => new Date(b.retestDate) - new Date(a.retestDate)
  );
  return sorted[0]?.retestDate || installationDate;
}

/**
 * Calculate all 4 milestone dates from a reference date.
 * Returns an object with each type → YYYY-MM-DD date.
 */
export function calcMilestones(refDate) {
  if (!refDate) return null;
  return {
    warning_3m:     addMonths(refDate, 33),
    warning_2m:     addMonths(refDate, 34),
    warning_1m:     addMonths(refDate, 35),
    final:          addMonths(refDate, 36),
    actualDeadline: addMonths(refDate, 36), // same as final — the 3-year mark
  };
}

/**
 * Human-readable label for a reminder type.
 */
export function getReminderLabel(type) {
  const map = {
    warning_3m: '3 months left',
    warning_2m: '2 months left',
    warning_1m: '1 month left',
    final:      'Due today',
    expired:    'Cylinder expired',
  };
  if (map[type]) return map[type];
  if (type?.startsWith('overdue_')) {
    const n = type.split('_')[1];
    return `${n} month${n === '1' ? '' : 's'} overdue`;
  }
  return 'Reminder';
}

/**
 * Returns a status variant string for badge/color theming.
 */
export function getReminderVariant(type) {
  if (type === 'warning_3m') return 'success';
  if (type === 'warning_2m') return 'info';
  if (type === 'warning_1m') return 'warning';
  if (type === 'final')      return 'danger';
  if (type?.startsWith('overdue_')) return 'danger';
  if (type === 'expired')    return 'neutral';
  return 'info';
}

/**
 * Format a YYYY-MM-DD or ISO date string for display.
 * e.g. "2025-09-15" → "15 Sep 2025"
 */
export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
}

/**
 * Format a Firestore Timestamp or date string as "15 Sep 2025, 10:30 AM"
 */
export function fmtDateTime(tsOrStr) {
  if (!tsOrStr) return '—';
  const d = tsOrStr?.toDate ? tsOrStr.toDate() : new Date(tsOrStr);
  if (isNaN(d)) return '—';
  return d.toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRESTORE — READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all reminder log entries ordered by sentAt descending.
 * Used by the Reminder Log screen.
 */
export async function fetchAllReminders() {
  const q = query(
    collection(db, 'reminderLog'),
    orderBy('sentAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch reminders for a specific customer (for CustomerDetail timeline).
 * Ordered by sentAt descending so newest is first.
 */
export async function fetchCustomerReminders(customerId) {
  const q = query(
    collection(db, 'reminderLog'),
    where('customerId', '==', customerId),
    orderBy('sentAt',   'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch only PENDING reminders (not yet marked as re-tested).
 * Used for the dashboard count badge.
 */
export async function fetchPendingReminders() {
  const q = query(
    collection(db, 'reminderLog'),
    where('status', '==', 'pending'),
    orderBy('sentAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch summary stats for the dashboard widget.
 * Returns { total, pending, overdue }
 */
export async function fetchReminderSummary() {
  const [allSnap, pendingSnap] = await Promise.all([
    getDocs(query(collection(db, 'reminderLog'), limit(1000))),
    getDocs(query(collection(db, 'reminderLog'), where('status', '==', 'pending'))),
  ]);

  let overdue = 0;
  pendingSnap.forEach((d) => {
    const type = d.data().reminderType || '';
    if (type === 'final' || type.startsWith('overdue_')) overdue++;
  });

  return {
    total:   allSnap.size,
    pending: pendingSnap.size,
    overdue,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRESTORE — WRITE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a customer as re-tested.
 *
 * Performs a coordinated multi-write:
 *   1. Appends new entry to /customers/{id}.retestDates[]
 *   2. Sets nextReminderDate = retestDate + 33 months
 *   3. Sets nextReminderType = 'warning_3m'  (cycle restarts)
 *   4. Marks all pending /reminderLog entries for this customer as 'completed'
 *   5. Writes an audit log entry
 *
 * @param {Object} params
 * @param {string} params.customerId
 * @param {string} params.retestDate        YYYY-MM-DD
 * @param {string} params.notes             Optional notes
 * @param {string} params.uid               Owner's user ID
 * @param {string} params.displayName       Owner's display name
 * @param {Array}  params.currentRetestDates Existing retestDates array from customer doc
 * @param {string} params.installationDate
 *
 * @returns {{ updatedRetestDates, nextReminderDate, nextReminderType }}
 */
export async function markCustomerRetested({
  customerId,
  retestDate,
  notes = '',
  uid,
  displayName,
  currentRetestDates = [],
  installationDate,
}) {
  if (!customerId || !retestDate) {
    throw new Error('customerId and retestDate are required');
  }

  const customerRef = doc(db, 'customers', customerId);

  // 1. Build updated retestDates array
  const newEntry = {
    retestDate,
    recordedAt:     new Date().toISOString(),
    recordedBy:     uid,
    recordedByName: displayName,
    notes:          notes.trim(),
  };
  const updatedRetestDates = [...currentRetestDates, newEntry];

  // 2. Calculate new next reminder milestone (restart cycle from retestDate)
  const nextReminderDate = addMonths(retestDate, 33);
  const nextReminderType = 'warning_3m';

  // 3. Update customer document
  await updateDoc(customerRef, {
    retestDates:      updatedRetestDates,
    nextReminderDate,
    nextReminderType,
    updatedAt:        serverTimestamp(),
  });

  // 4. Mark all pending reminderLog entries for this customer as completed
  const pendingSnap = await getDocs(
    query(
      collection(db, 'reminderLog'),
      where('customerId', '==', customerId),
      where('status',     '==', 'pending')
    )
  );

  if (!pendingSnap.empty) {
    const batch = writeBatch(db);
    pendingSnap.forEach((logDoc) => {
      batch.update(logDoc.ref, {
        status:           'completed',
        retestDate,
        retestRecordedAt: serverTimestamp(),
        retestRecordedBy: uid,
        retestNotes:      notes.trim(),
      });
    });
    await batch.commit();
  }

  // 5. Audit log
  try {
    await logAudit(
      AUDIT_ACTIONS.CUSTOMER_UPDATED,
      customerId,
      'customers',
      {
        action:      'retest_recorded',
        retestDate,
        recordedBy:  displayName,
        notesAdded:  !!notes.trim(),
      }
    );
  } catch (_) {
    // Non-fatal — audit failure should not block the re-test save
  }

  return { updatedRetestDates, nextReminderDate, nextReminderType };
}
