/**
 * auditService.js
 * Append-only audit log writer. Every create/edit/delete action anywhere in the
 * app calls logAudit(). Firestore rules prevent update and delete on /auditLog.
 * Errors are silently swallowed so a logging failure never breaks the user flow.
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * @param {object} params
 * @param {string} params.action          - e.g. 'CUSTOMER_CREATED', 'CUSTOMER_UPDATED'
 * @param {string} params.userId          - Firebase Auth UID of the acting user
 * @param {string} params.userName        - Display name of the acting user
 * @param {string|null} params.targetId   - Firestore document ID affected
 * @param {string|null} params.targetCollection - Collection name affected
 * @param {object} params.metadata        - Any extra context (field names, old values, etc.)
 */
export const logAudit = async ({
  action,
  userId,
  userName = 'Unknown',
  targetId = null,
  targetCollection = null,
  metadata = {},
}) => {
  try {
    await addDoc(collection(db, 'auditLog'), {
      action,
      userId,
      userName,
      targetId,
      targetCollection,
      timestamp: serverTimestamp(),
      metadata,
    });
  } catch (err) {
    // Silent fail — audit must never crash the calling feature
    console.warn('[AuditService] Failed to write audit log:', err?.message);
  }
};

// ─── Action Constants ─────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for all audit action strings.
// Import AUDIT_ACTIONS from here (not from auditLog.js).
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN:                   'auth.login',
  LOGOUT:                  'auth.logout',
  REMOTE_LOGOUT:           'auth.remote_logout',
  PASSWORD_RESET:          'auth.password_reset',
  ACCOUNT_BLOCKED:         'auth.account_blocked',
  ACCOUNT_UNBLOCKED:       'auth.account_unblocked',
  USER_CREATED:            'auth.user_created',
  USER_LOGIN:              'auth.login',       // alias
  USER_LOGOUT:             'auth.logout',      // alias
  USER_LOCKED:             'auth.account_blocked', // alias

  // Customers
  CUSTOMER_CREATED:        'customer.created',
  CUSTOMER_UPDATED:        'customer.updated',
  CUSTOMER_DELETED:        'customer.deleted',
  RETEST_DATE_ADDED:       'reminder.retest_date_added',
  RETEST_DATE_UPDATED:     'reminder.retest_date_updated',

  // Invoices
  INVOICE_CREATED:         'invoice.created',
  INVOICE_APPROVED:        'invoice.approved',
  INVOICE_DELETED:         'invoice.deleted',
  INVOICE_DB_LOCKED:       'invoice.db_locked',
  INVOICE_DB_UNLOCKED:     'invoice.db_unlocked',

  // Inventory
  INVENTORY_ADDED:         'inventory.added',
  INVENTORY_UPDATED:       'inventory.updated',
  INVENTORY_DEDUCTED:      'inventory.deducted',

  // Quotations
  QUOTATION_CREATED:       'quotation.created',

  // Reminders
  REMINDER_SENT:           'reminder.sent',

  // Settings
  SETTINGS_UPDATED:        'settings.updated',
  DROPDOWN_OPTION_ADDED:   'settings.dropdown_option_added',
  DROPDOWN_OPTION_REMOVED: 'settings.dropdown_option_removed',
  CUSTOM_FIELD_ADDED:      'settings.custom_field_added',
  CUSTOM_FIELD_REMOVED:    'settings.custom_field_removed',
};