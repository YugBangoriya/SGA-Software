// SGA — Last updated: Migrated from writeAuditLog (auditLog.js shim) to logAudit (auditService.js direct).
// Removed auditLog.js dependency. All 7 audit calls updated: userRole now stored in metadata,
// userName now uses real display name with email fallback.
// ─────────────────────────────────────────────────────────────────────────────
// src/store/authStore.js
// Global auth state via Zustand.
// Handles: login, logout, remote-logout, user blocking, password reset,
//          force-refresh of Firebase custom claims (role).
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
} from "@/lib/firebase";
import { logAudit, AUDIT_ACTIONS } from "@/lib/auditService";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Force-refresh the ID token so we pick up updated custom claims (role). */
async function refreshClaims(firebaseUser) {
  const token = await firebaseUser.getIdTokenResult(true);
  return token.claims;
}

/** Fetch the /users/{uid} Firestore document. */
async function fetchUserDoc(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const useAuthStore = create((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────────────
  firebaseUser:   null,   // raw Firebase User object
  userDoc:        null,   // Firestore /users/{uid} document
  role:           null,   // "superadmin" | "owner" | "employee" | "accountant"
  isLoading:      true,   // true while auth state is being determined on app boot
  isAuthenticated: false,
  loginError:     null,
  sessionInvalidated: false, // true when remote logout was triggered

  // ── Auth state listener (call once in App.jsx) ───────────────────────────────
  initAuth: () => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        set({
          firebaseUser:    null,
          userDoc:         null,
          role:            null,
          isLoading:       false,
          isAuthenticated: false,
        });
        return;
      }

      try {
        // Get custom claims (role is set server-side via Cloud Functions)
        const claims  = await refreshClaims(fbUser);
        const userDoc = await fetchUserDoc(fbUser.uid);

        // Check if account is blocked by SuperAdmin
        if (userDoc?.isActive === false) {
          await signOut(auth);
          set({
            firebaseUser:    null,
            userDoc:         null,
            role:            null,
            isLoading:       false,
            isAuthenticated: false,
            loginError:      "Your account has been deactivated. Contact SuperAdmin.",
          });
          return;
        }

        // Check remote-logout flag: SuperAdmin sets forceLogout=true on the doc
        if (userDoc?.forceLogout === true) {
          // Clear the flag first so it doesn't loop
          await updateDoc(doc(db, "users", fbUser.uid), { forceLogout: false });
          await signOut(auth);
          set({
            firebaseUser:       null,
            userDoc:            null,
            role:               null,
            isLoading:          false,
            isAuthenticated:    false,
            sessionInvalidated: true,
          });
          return;
        }

        // Update lastLogin
        await updateDoc(doc(db, "users", fbUser.uid), {
          lastLogin: serverTimestamp(),
        }).catch(() => {}); // non-critical

        set({
          firebaseUser:    fbUser,
          userDoc,
          role:            claims.role || userDoc?.role || null,
          isLoading:       false,
          isAuthenticated: true,
          loginError:      null,
          sessionInvalidated: false,
        });
      } catch (err) {
        console.error("[Auth] State error:", err);
        set({ isLoading: false, isAuthenticated: false });
      }
    });
    return unsubscribe; // call to detach listener on unmount
  },

  // ── Login ────────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ loginError: null, isLoading: true });
    try {
      const cred    = await signInWithEmailAndPassword(auth, email, password);
      const claims  = await refreshClaims(cred.user);
      const userDoc = await fetchUserDoc(cred.user.uid);

      if (userDoc?.isActive === false) {
        await signOut(auth);
        set({ isLoading: false, loginError: "Your account has been deactivated. Contact SuperAdmin." });
        return { success: false };
      }

      await logAudit({
        action:   AUDIT_ACTIONS.LOGIN,
        userId:   cred.user.uid,
        userName: userDoc?.name || cred.user.email || 'Unknown',
        metadata: { email, userRole: claims.role || userDoc?.role },
      });

      set({
        firebaseUser:    cred.user,
        userDoc,
        role:            claims.role || userDoc?.role,
        isLoading:       false,
        isAuthenticated: true,
        loginError:      null,
      });
      return { success: true };
    } catch (err) {
      const msg = mapAuthError(err.code);
      set({ loginError: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  // ── Logout (self) ─────────────────────────────────────────────────────────────
  logout: async () => {
    const { firebaseUser, role, userDoc } = get();
    if (firebaseUser) {
      await logAudit({
        action:   AUDIT_ACTIONS.LOGOUT,
        userId:   firebaseUser.uid,
        userName: userDoc?.name || firebaseUser.email || 'Unknown',
        metadata: { userRole: role },
      });
    }
    await signOut(auth);
    set({
      firebaseUser:    null,
      userDoc:         null,
      role:            null,
      isAuthenticated: false,
      sessionInvalidated: false,
    });
  },

  // ── Remote logout (Owner can log out employees; SA can log out anyone) ────────
  remoteLogout: async (targetUid) => {
    const { firebaseUser, role, userDoc } = get();
    try {
      // Set forceLogout flag — the target user's listener will pick this up
      await updateDoc(doc(db, "users", targetUid), { forceLogout: true });
      await logAudit({
        action:           AUDIT_ACTIONS.REMOTE_LOGOUT,
        userId:           firebaseUser.uid,
        userName:         userDoc?.name || firebaseUser.email || 'Unknown',
        targetId:         targetUid,
        targetCollection: "users",
        metadata:         { userRole: role },
      });
      return { success: true };
    } catch (err) {
      console.error("[Auth] remoteLogout error:", err);
      return { success: false, error: err.message };
    }
  },

  // ── Block user account (SuperAdmin only) ──────────────────────────────────────
  blockUser: async (targetUid, block = true) => {
    const { firebaseUser, role, userDoc } = get();
    try {
      await updateDoc(doc(db, "users", targetUid), {
        isActive:       !block,
        blockedAt:      block ? serverTimestamp() : null,
        blockedBy:      block ? firebaseUser.uid : null,
        // Also force logout if blocking
        forceLogout:    block ? true : false,
      });
      await logAudit({
        action:           block ? AUDIT_ACTIONS.ACCOUNT_BLOCKED : AUDIT_ACTIONS.ACCOUNT_UNBLOCKED,
        userId:           firebaseUser.uid,
        userName:         userDoc?.name || firebaseUser.email || 'Unknown',
        targetId:         targetUid,
        targetCollection: "users",
        metadata:         { userRole: role },
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ── Change own password ───────────────────────────────────────────────────────
  changePassword: async (newPassword) => {
    const { firebaseUser, role, userDoc } = get();
    try {
      await updatePassword(firebaseUser, newPassword);
      await logAudit({
        action:   AUDIT_ACTIONS.PASSWORD_RESET,
        userId:   firebaseUser.uid,
        userName: userDoc?.name || firebaseUser.email || 'Unknown',
        metadata: { self: true, userRole: role },
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: mapAuthError(err.code) };
    }
  },

  // ── SuperAdmin: reset another user's password ─────────────────────────────────
  // Note: This requires a Cloud Function on the backend.
  // The SA sets a "passwordResetRequired" flag; the Cloud Function sends reset email.
  adminResetPassword: async (targetUid, targetEmail) => {
    const { firebaseUser, role, userDoc } = get();
    try {
      await updateDoc(doc(db, "users", targetUid), {
        passwordResetRequired: true,
        passwordResetRequestedBy: firebaseUser.uid,
        passwordResetRequestedAt: serverTimestamp(),
      });
      await logAudit({
        action:           AUDIT_ACTIONS.PASSWORD_RESET,
        userId:           firebaseUser.uid,
        userName:         userDoc?.name || firebaseUser.email || 'Unknown',
        targetId:         targetUid,
        targetCollection: "users",
        metadata:         { adminInitiated: true, targetEmail, userRole: role },
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ── Create new user document in Firestore (SA action) ─────────────────────────
  // Actual Firebase Auth account is created via Cloud Function (admin SDK)
  createUserRecord: async ({ uid, name, email, role: newRole, username }) => {
    const { firebaseUser, role, userDoc } = get();
    try {
      await setDoc(doc(db, "users", uid), {
        uid,
        name,
        email,
        username,
        role:       newRole,
        isActive:   true,
        forceLogout: false,
        createdAt:  serverTimestamp(),
        createdBy:  firebaseUser.uid,
        lastLogin:  null,
        // ── WHY theme: "light" is hardcoded and safe ────────────────────────────
        // New Firestore user documents always start with "light" as a sensible default.
        // This value is only used as a cross-device fallback. On any device where the
        // user has previously toggled dark mode, themeStore.syncFromUserDoc() gives
        // localStorage precedence over the Firestore doc, so the stored "light" value
        // is never applied on top of a user's real preference.
        // Behaviour: First login on a NEW device → "light" (correct default).
        //            Returning user on known device → localStorage wins (correct preference).
        // Changing this to read the creating-admin's theme would be incorrect:
        // the SuperAdmin who creates an account shouldn't force their own theme on others.
        // ────────────────────────────────────────────────────────────────────────
        theme:      "light",
        language:   "en",
        passwordResetRequired: false,
      });
      await logAudit({
        action:           AUDIT_ACTIONS.USER_CREATED,
        userId:           firebaseUser.uid,
        userName:         userDoc?.name || firebaseUser.email || 'Unknown',
        targetId:         uid,
        targetCollection: "users",
        metadata:         { newRole, email, userRole: role },
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ── Fetch all users (SA/Owner) ─────────────────────────────────────────────────
  fetchAllUsers: async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      return [];
    }
  },

  // ── Persist theme/language preference for this user ───────────────────────────
  updateUserPreference: async (field, value) => {
    const { firebaseUser, userDoc } = get();
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), { [field]: value });
      set({ userDoc: { ...userDoc, [field]: value } });
    } catch (err) {
      console.error("[Auth] updateUserPreference:", err);
    }
  },

  // ── Clear login error ──────────────────────────────────────────────────────────
  clearError: () => set({ loginError: null, sessionInvalidated: false }),
}));

// ── Map Firebase error codes → user-friendly messages ────────────────────────
function mapAuthError(code) {
  const map = {
    "auth/user-not-found":       "No account found with this email.",
    "auth/wrong-password":       "Incorrect password. Please try again.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/user-disabled":        "This account has been disabled. Contact SuperAdmin.",
    "auth/too-many-requests":    "Too many failed attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/invalid-credential":   "Invalid email or password.",
    "auth/requires-recent-login":"Please log in again to complete this action.",
  };
  return map[code] || "An error occurred. Please try again.";
}

export default useAuthStore;