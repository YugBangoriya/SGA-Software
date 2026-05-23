// =============================================================================
// functions/src/index.js
// Firebase Cloud Functions — Shree Ganesh Automobile Business Management PWA
// MERGED: Phases 1 + 4 + 8 + 9 + 11
// Deploy: firebase deploy --only functions
// =============================================================================

'use strict';

const admin = require('firebase-admin');

// ── Initialize Firebase Admin SDK (singleton — only once) ─────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}

const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth }                  = require('firebase-admin/auth');
const { onCall, HttpsError }       = require('firebase-functions/v2/https');
const { onDocumentWritten }        = require('firebase-functions/v2/firestore');

const db   = getFirestore();
const auth = getAuth();

// ── Valid roles ────────────────────────────────────────────────────────────────
const VALID_ROLES = ['superadmin', 'owner', 'employee', 'accountant'];

// ── Helper: verify caller role ─────────────────────────────────────────────────
async function requireRole(request, ...allowedRoles) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const claims = request.auth.token;
  if (!allowedRoles.includes(claims.role)) {
    throw new HttpsError('permission-denied', `Requires one of: ${allowedRoles.join(', ')}`);
  }
  return claims;
}

// =============================================================================
// PHASE 1 — Authentication & User Management
// =============================================================================

exports.setUserRole = onCall(async (request) => {
  await requireRole(request, 'superadmin');
  const { uid, role } = request.data;
  if (!uid || !role) throw new HttpsError('invalid-argument', 'uid and role are required.');
  if (!VALID_ROLES.includes(role)) throw new HttpsError('invalid-argument', `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  await auth.setCustomUserClaims(uid, { role });
  await db.doc(`users/${uid}`).set({ role }, { merge: true });
  await db.collection('auditLog').add({
    action: 'auth.role_set', userId: request.auth.uid, userRole: 'superadmin',
    targetId: uid, targetCollection: 'users',
    metadata: { newRole: role }, timestamp: FieldValue.serverTimestamp(),
  });
  return { success: true, uid, role };
});

exports.onUserDocWritten = onDocumentWritten('users/{uid}', async (event) => {
  const uid  = event.params.uid;
  const data = event.data?.after?.data();
  if (!data) return;
  const role = data.role;
  if (!role || !VALID_ROLES.includes(role)) return;
  try {
    const user          = await auth.getUser(uid);
    const currentClaims = user.customClaims || {};
    if (currentClaims.role !== role) {
      await auth.setCustomUserClaims(uid, { ...currentClaims, role });
    }
  } catch (err) {
    console.error(`[onUserDocWritten] Failed for uid ${uid}:`, err.message);
  }
});

exports.adminResetPassword = onCall(async (request) => {
  await requireRole(request, 'superadmin');
  const { uid } = request.data;
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.');
  const userRecord = await auth.getUser(uid);
  if (!userRecord.email) throw new HttpsError('not-found', 'User has no email address.');
  const resetLink = await auth.generatePasswordResetLink(userRecord.email);
  await db.doc(`users/${uid}`).update({ passwordResetRequired: true, passwordResetRequestedBy: request.auth.uid, passwordResetRequestedAt: FieldValue.serverTimestamp() });
  await db.collection('auditLog').add({ action: 'auth.password_reset', userId: request.auth.uid, userRole: 'superadmin', targetId: uid, targetCollection: 'users', metadata: { adminInitiated: true, email: userRecord.email }, timestamp: FieldValue.serverTimestamp() });
  return { success: true, resetLink, email: userRecord.email };
});

// =============================================================================
// PHASE 4 — Invoice Module
// =============================================================================

const invoiceApproval = require('./invoiceApproval');
const whatsappInvoice = require('./whatsappInvoice');

exports.approveInvoice       = invoiceApproval.approveInvoice;
exports.rejectInvoice        = invoiceApproval.rejectInvoice;
exports.sendInvoiceWhatsApp  = whatsappInvoice.sendInvoiceWhatsApp;

// =============================================================================
// PHASE 8 — Unified Messaging & CRM Inbox
// =============================================================================

const { whatsappWebhook }   = require('./webhooks/whatsappWebhook');
const { instagramWebhook }  = require('./webhooks/instagramWebhook');
const { facebookWebhook }   = require('./webhooks/facebookWebhook');
const { followUpScheduler } = require('./schedulers/followUpScheduler');
const { translateMessage }  = require('./helpers/translationHelper');
const { sendReplyMessage }  = require('./callables/sendReplyMessage');

exports.whatsappWebhook   = whatsappWebhook;
exports.instagramWebhook  = instagramWebhook;
exports.facebookWebhook   = facebookWebhook;
exports.followUpScheduler = followUpScheduler;
exports.translateMessage  = translateMessage;
exports.sendReplyMessage  = sendReplyMessage;

// =============================================================================
// PHASE 9 — CNG Re-Testing Reminder System
// =============================================================================

const { dailyCngReminderCheck } = require('./reminders/reminderScheduler');
exports.dailyCngReminderCheck = dailyCngReminderCheck;

// =============================================================================
// PHASE 11 — Settings & Administration (User Management + Invoice Backup)
// =============================================================================

const JSZip       = require('jszip');
const storageBucket = admin.storage().bucket;

exports.createUser = onCall(async (request) => {
  await requireRole(request, 'superadmin');
  const { name, email, password, role } = request.data;
  if (!['owner', 'employee', 'accountant'].includes(role)) throw new HttpsError('invalid-argument', 'Invalid role.');
  const userRecord = await auth.createUser({ email, password, displayName: name });
  await auth.setCustomUserClaims(userRecord.uid, { role });
  await db.collection('users').doc(userRecord.uid).set({ uid: userRecord.uid, name, email, role, isActive: true, createdAt: FieldValue.serverTimestamp(), lastLogin: null });
  await db.collection('auditLog').add({ action: 'USER_CREATED', userId: request.auth.uid, targetId: userRecord.uid, targetCollection: 'users', metadata: { name, email, role }, timestamp: FieldValue.serverTimestamp() });
  return { uid: userRecord.uid };
});

exports.updateUser = onCall(async (request) => {
  await requireRole(request, 'superadmin');
  const { uid, name, email, role } = request.data;
  const updates = {};
  const authUpdates = {};
  if (name) { updates.name = name; authUpdates.displayName = name; }
  if (email) { updates.email = email; authUpdates.email = email; }
  if (role) {
    if (!['owner', 'employee', 'accountant'].includes(role)) throw new HttpsError('invalid-argument', 'Invalid role.');
    updates.role = role;
    await auth.setCustomUserClaims(uid, { role });
  }
  if (Object.keys(authUpdates).length) await auth.updateUser(uid, authUpdates);
  updates.updatedAt = FieldValue.serverTimestamp();
  await db.collection('users').doc(uid).update(updates);
  await db.collection('auditLog').add({ action: 'USER_UPDATED', userId: request.auth.uid, targetId: uid, targetCollection: 'users', metadata: updates, timestamp: FieldValue.serverTimestamp() });
  return { success: true };
});

exports.resetUserPassword = onCall(async (request) => {
  await requireRole(request, 'superadmin');
  const { uid, newPassword } = request.data;
  if (!newPassword || newPassword.length < 6) throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  await auth.updateUser(uid, { password: newPassword });
  await db.collection('auditLog').add({ action: 'PASSWORD_RESET', userId: request.auth.uid, targetId: uid, targetCollection: 'users', metadata: {}, timestamp: FieldValue.serverTimestamp() });
  return { success: true };
});

exports.blockUser = onCall(async (request) => {
  await requireRole(request, 'superadmin');
  const { uid, block } = request.data;
  await auth.updateUser(uid, { disabled: block });
  await db.collection('users').doc(uid).update({ isActive: !block, updatedAt: FieldValue.serverTimestamp() });
  await db.collection('auditLog').add({ action: block ? 'USER_BLOCKED' : 'USER_UNBLOCKED', userId: request.auth.uid, targetId: uid, targetCollection: 'users', metadata: {}, timestamp: FieldValue.serverTimestamp() });
  return { success: true };
});

exports.forceLogoutUser = onCall(async (request) => {
  await requireRole(request, 'superadmin', 'owner');
  const { uid } = request.data;
  const callerClaims = request.auth.token;
  if (callerClaims.role === 'owner') {
    const targetDoc = await db.collection('users').doc(uid).get();
    if (!targetDoc.exists || targetDoc.data().role !== 'employee') throw new HttpsError('permission-denied', 'Owner can only log out employees.');
  }
  await auth.revokeRefreshTokens(uid);
  await db.collection('auditLog').add({ action: 'FORCE_LOGOUT', userId: request.auth.uid, targetId: uid, targetCollection: 'users', metadata: {}, timestamp: FieldValue.serverTimestamp() });
  return { success: true };
});

exports.listUsers = onCall(async (request) => {
  await requireRole(request, 'superadmin');
  const snap = await db.collection('users').get();
  return { users: snap.docs.map((d) => d.data()) };
});

exports.exportInvoicesZip = onCall(async (request) => {
  await requireRole(request, 'superadmin');
  const bucket  = storageBucket();
  const zip     = new JSZip();
  const folder  = zip.folder('invoices');
  const [files] = await bucket.getFiles({ prefix: 'invoices/' });
  if (files.length === 0) throw new HttpsError('not-found', 'No invoice PDFs found in storage.');
  await Promise.all(files.map(async (file) => {
    const [buffer]  = await file.download();
    const fileName  = file.name.replace('invoices/', '');
    folder.file(fileName, buffer);
  }));
  const zipBuffer   = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const timestamp   = new Date().toISOString().replace(/[:.]/g, '-');
  const zipPath     = `backups/invoices_backup_${timestamp}.zip`;
  const zipFile     = bucket.file(zipPath);
  await zipFile.save(zipBuffer, { contentType: 'application/zip' });
  const [signedUrl] = await zipFile.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
  await db.collection('auditLog').add({ action: 'INVOICE_BACKUP_EXPORTED', userId: request.auth.uid, targetId: zipPath, targetCollection: 'invoices', metadata: { fileCount: files.length, zipPath }, timestamp: FieldValue.serverTimestamp() });
  return { downloadUrl: signedUrl, fileCount: files.length };
});
