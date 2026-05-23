// ─────────────────────────────────────────────────────────────────────────────
// src/lib/auditLog.js
//
// Backward-compatibility shim.
// All audit logic now lives in auditService.js — import from there directly.
// This file re-exports everything so existing imports continue to work.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { logAudit, AUDIT_ACTIONS as _AUDIT_ACTIONS } from './auditService';

// Re-export logAudit and AUDIT_ACTIONS from auditService
export { logAudit };
export const AUDIT_ACTIONS = _AUDIT_ACTIONS;

/**
 * writeAuditLog — legacy function name kept for backward compatibility.
 * Prefer logAudit() from auditService.js in new code.
 */
export async function writeAuditLog({
  action,
  userId,
  userRole,
  targetId         = null,
  targetCollection = null,
  metadata         = {},
}) {
  try {
    await addDoc(collection(db, 'auditLog'), {
      action,
      userId,
      userName: userRole ?? 'Unknown',
      userRole,
      targetId,
      targetCollection,
      metadata,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[AuditLog] Failed to write:', err.message);
  }
}