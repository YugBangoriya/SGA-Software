/**
 * useAuditLog.js
 * Custom hook for reading /auditLog with optional filters.
 *
 * All action types written by Phases 1-9:
 *  user_login | user_logout | remote_logout | account_locked
 *  user_created | user_blocked | user_unblocked | password_reset
 *  customer_created | customer_updated
 *  inventory_added | inventory_replenished
 *  invoice_created | invoice_approved | invoice_deleted | payment_updated
 *  invoice_db_locked | invoice_db_unlocked | invoice_db_backup
 *  quotation_created | quotation_sent
 *  car_company_created | car_model_added | car_model_updated | car_model_deleted
 *  document_uploaded | document_deleted
 *  followup_scheduled | followup_sent | followup_cancelled
 *  reminder_sent | retest_date_updated
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// All distinct action types — used to populate the filter dropdown
export const AUDIT_ACTION_TYPES = [
  // Auth
  { value: 'user_login',       label: 'Login',                group: 'Auth' },
  { value: 'user_logout',      label: 'Logout',               group: 'Auth' },
  { value: 'remote_logout',    label: 'Remote Logout',        group: 'Auth' },
  { value: 'account_locked',   label: 'Account Locked',       group: 'Auth' },
  { value: 'user_created',     label: 'User Created',         group: 'Auth' },
  { value: 'user_blocked',     label: 'User Blocked',         group: 'Auth' },
  { value: 'user_unblocked',   label: 'User Unblocked',       group: 'Auth' },
  { value: 'password_reset',   label: 'Password Reset',       group: 'Auth' },
  // Customers
  { value: 'customer_created', label: 'Customer Created',     group: 'Customers' },
  { value: 'customer_updated', label: 'Customer Updated',     group: 'Customers' },
  { value: 'retest_date_updated', label: 'Re-test Date Updated', group: 'Customers' },
  // Inventory
  { value: 'inventory_added',      label: 'Inventory Added',      group: 'Inventory' },
  { value: 'inventory_replenished',label: 'Inventory Replenished',group: 'Inventory' },
  // Invoices
  { value: 'invoice_created',  label: 'Invoice Created',      group: 'Invoices' },
  { value: 'invoice_approved', label: 'Invoice Approved',     group: 'Invoices' },
  { value: 'invoice_deleted',  label: 'Invoice Deleted',      group: 'Invoices' },
  { value: 'payment_updated',  label: 'Payment Updated',      group: 'Invoices' },
  // Invoice DB
  { value: 'invoice_db_locked',  label: 'Invoice DB Locked',  group: 'System' },
  { value: 'invoice_db_unlocked',label: 'Invoice DB Unlocked',group: 'System' },
  { value: 'invoice_db_backup',  label: 'Invoice DB Backup',  group: 'System' },
  // Quotations
  { value: 'quotation_created', label: 'Quotation Created',   group: 'Quotations' },
  { value: 'quotation_sent',    label: 'Quotation Sent',      group: 'Quotations' },
  // Car Repository
  { value: 'car_company_created', label: 'Car Company Created', group: 'Car Repo' },
  { value: 'car_model_added',     label: 'Car Model Added',     group: 'Car Repo' },
  { value: 'car_model_updated',   label: 'Car Model Updated',   group: 'Car Repo' },
  { value: 'car_model_deleted',   label: 'Car Model Deleted',   group: 'Car Repo' },
  // Docs Repository
  { value: 'document_uploaded', label: 'Document Uploaded',   group: 'Docs Repo' },
  { value: 'document_deleted',  label: 'Document Deleted',    group: 'Docs Repo' },
  // Follow-Ups
  { value: 'followup_scheduled', label: 'Follow-up Scheduled', group: 'Follow-Ups' },
  { value: 'followup_sent',      label: 'Follow-up Sent',      group: 'Follow-Ups' },
  { value: 'followup_cancelled', label: 'Follow-up Cancelled', group: 'Follow-Ups' },
  // Reminders
  { value: 'reminder_sent', label: 'CNG Reminder Sent', group: 'Reminders' },
];

// Action type → colour coding for badges
export const ACTION_COLOR = {
  // Green = create/success
  user_created: 'green', customer_created: 'green', inventory_added: 'green',
  invoice_approved: 'green', quotation_created: 'green', car_company_created: 'green',
  car_model_added: 'green', document_uploaded: 'green', reminder_sent: 'green',
  // Blue = update/neutral
  user_login: 'blue', user_logout: 'blue', customer_updated: 'blue',
  inventory_replenished: 'blue', invoice_created: 'blue', payment_updated: 'blue',
  quotation_sent: 'blue', car_model_updated: 'blue', followup_scheduled: 'blue',
  followup_sent: 'blue', retest_date_updated: 'blue', password_reset: 'blue',
  user_unblocked: 'blue', invoice_db_unlocked: 'blue',
  // Amber = warning/info
  account_locked: 'amber', remote_logout: 'amber',
  invoice_db_locked: 'amber', invoice_db_backup: 'amber',
  // Red = delete/destructive
  user_blocked: 'red', invoice_deleted: 'red', car_model_deleted: 'red',
  document_deleted: 'red', followup_cancelled: 'red',
};

/**
 * Builds a human-readable summary line from an audit entry.
 * e.g. "Invoice INV-004 approved for Raj Patel"
 */
export function buildAuditSummary(entry) {
  const m = entry.metadata || {};
  switch (entry.action) {
    case 'invoice_created':   return `Invoice ${m.invoiceNo || ''} created${m.customerName ? ` for ${m.customerName}` : ''}`;
    case 'invoice_approved':  return `Invoice ${m.invoiceNo || ''} approved${m.customerName ? ` for ${m.customerName}` : ''}`;
    case 'invoice_deleted':   return `Invoice ${m.invoiceNo || ''} deleted`;
    case 'payment_updated':   return `Payment updated on ${m.invoiceNo || ''} → ${m.newStatus || ''}`;
    case 'customer_created':  return `Customer profile created: ${m.customerName || ''}`;
    case 'customer_updated':  return `Customer updated: ${m.customerName || ''}`;
    case 'inventory_added':   return `Inventory added: ${m.itemName || ''} (${m.quantity || ''} units)`;
    case 'inventory_replenished': return `Inventory restocked: ${m.itemName || ''} (+${m.quantity || ''})`;
    case 'quotation_created': return `Quotation ${m.quotationNo || ''} created${m.customerName ? ` for ${m.customerName}` : ''}`;
    case 'quotation_sent':    return `Quotation ${m.quotationNo || ''} sent via WhatsApp${m.customerName ? ` to ${m.customerName}` : ''}`;
    case 'user_login':        return `${entry.userName || 'User'} logged in`;
    case 'user_logout':       return `${entry.userName || 'User'} logged out`;
    case 'remote_logout':     return `${m.targetUserName || 'User'} remotely logged out`;
    case 'account_locked':    return `Account locked after failed login attempts: ${entry.userName || ''}`;
    case 'user_created':      return `New user created: ${m.newUserName || ''} (${m.newUserRole || ''})`;
    case 'user_blocked':      return `User blocked: ${m.targetUserName || ''}`;
    case 'user_unblocked':    return `User unblocked: ${m.targetUserName || ''}`;
    case 'password_reset':    return `Password reset for: ${m.targetUserName || ''}`;
    case 'invoice_db_locked': return 'Invoice database locked by SuperAdmin';
    case 'invoice_db_unlocked': return 'Invoice database unlocked by SuperAdmin';
    case 'invoice_db_backup': return `Invoice database backed up (${m.recordCount || ''} records)`;
    case 'car_company_created': return `Car company added: ${m.company || ''}`;
    case 'car_model_added':   return `Car model added: ${m.company || ''} ${m.model || ''}`;
    case 'car_model_updated': return `Car model updated: ${m.company || ''} ${m.model || ''}`;
    case 'car_model_deleted': return `Car model deleted: ${m.company || ''} ${m.model || ''}`;
    case 'document_uploaded': return `Document uploaded: ${m.fileName || ''}`;
    case 'document_deleted':  return `Document deleted: ${m.fileName || ''}`;
    case 'followup_scheduled':return `Follow-up scheduled for ${m.customerName || ''} on ${m.scheduledDate || ''}`;
    case 'followup_sent':     return `Follow-up sent to ${m.customerName || ''}`;
    case 'followup_cancelled':return `Follow-up cancelled for ${m.customerName || ''}`;
    case 'reminder_sent':     return `CNG re-test reminder sent to ${m.customerName || ''}`;
    case 'retest_date_updated': return `Re-test date updated for ${m.customerName || ''}: ${m.retestDate || ''}`;
    default: return entry.action?.replace(/_/g, ' ') || 'Unknown action';
  }
}

/**
 * @param {object} filters
 *   filters.userId    — string | null
 *   filters.action    — string | null
 *   filters.startDate — Date   | null
 *   filters.endDate   — Date   | null
 *   filters.search    — string (client-side against userName + summary)
 */
export function useAuditLog(filters = {}) {
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [users, setUsers]           = useState([]);

  // Fetch user list once for filter dropdown
  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then((snap) =>
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
      )
      .catch(console.error);
  }, []);

  // Build Firestore query — orderBy timestamp is the only guaranteed sort
  // Compound filters require Firestore indexes; we apply userId/action in Firestore,
  // date range in client to avoid requiring a composite index per combination.
  useEffect(() => {
    setLoading(true);

    let constraints = [orderBy('timestamp', 'desc')];

    if (filters.userId) constraints.push(where('userId', '==', filters.userId));
    if (filters.action) constraints.push(where('action', '==', filters.action));

    const q = query(collection(db, 'auditLog'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Client-side date range filter
        if (filters.startDate) {
          const start = Timestamp.fromDate(filters.startDate);
          entries = entries.filter((e) => e.timestamp?.seconds >= start.seconds);
        }
        if (filters.endDate) {
          const end = Timestamp.fromDate(
            new Date(filters.endDate.getTime() + 86400000) // include full end day
          );
          entries = entries.filter((e) => e.timestamp?.seconds <= end.seconds);
        }

        setAllEntries(entries);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [filters.userId, filters.action, filters.startDate, filters.endDate]);

  // Client-side search: against userName, userRole, action, and metadata values
  const search = (filters.search || '').toLowerCase().trim();
  const entries = search
    ? allEntries.filter((e) => {
        const summary = buildAuditSummary(e).toLowerCase();
        return (
          (e.userName || '').toLowerCase().includes(search) ||
          (e.userRole || '').toLowerCase().includes(search) ||
          (e.action || '').toLowerCase().includes(search) ||
          summary.includes(search)
        );
      })
    : allEntries;

  return { entries, allEntries, loading, error, users };
}
