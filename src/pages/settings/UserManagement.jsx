// src/pages/Settings/components/SuperAdmin/UserManagement.jsx
// SuperAdmin: full user CRUD — create, edit, reset password, block, force logout

import React, { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { SectionCard, FieldRow, Input, Select, Button, ConfirmDialog, Badge, T } from "./SettingsUI";

const functions = getFunctions();
const fnCreateUser = httpsCallable(functions, "createUser");
const fnUpdateUser = httpsCallable(functions, "updateUser");
const fnResetPassword = httpsCallable(functions, "resetUserPassword");
const fnBlockUser = httpsCallable(functions, "blockUser");
const fnForceLogout = httpsCallable(functions, "forceLogoutUser");
const fnListUsers = httpsCallable(functions, "listUsers");

const ROLES = ["owner", "employee", "accountant"];
const ROLE_COLORS = { owner: "blue", employee: "green", accountant: "purple", superadmin: "amber" };

const EMPTY_FORM = { name: "", email: "", password: "", role: "employee" };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [confirmBlock, setConfirmBlock] = useState(null);
  const [confirmLogout, setConfirmLogout] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newPassword, setNewPassword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fnListUsers();
      setUsers(res.data.users || []);
    } catch (e) {
      setError("Failed to load users.");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      setError("Name, email, and password are required.");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      await fnCreateUser(form);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await loadUsers();
      flash("User created successfully.");
    } catch (e) {
      setError(e.message || "Failed to create user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setActionLoading(true);
    setError("");
    try {
      await fnUpdateUser({
        uid: editUser.uid,
        name: editUser.name,
        email: editUser.email,
        role: editUser.role,
      });
      setEditUser(null);
      await loadUsers();
      flash("User updated.");
    } catch (e) {
      setError(e.message || "Failed to update user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser || !newPassword) { setError("New password required."); return; }
    setActionLoading(true);
    setError("");
    try {
      await fnResetPassword({ uid: resetUser.uid, newPassword });
      setResetUser(null);
      setNewPassword("");
      flash("Password reset successfully.");
    } catch (e) {
      setError(e.message || "Failed to reset password.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async (uid, block) => {
    setActionLoading(true);
    try {
      await fnBlockUser({ uid, block });
      setConfirmBlock(null);
      await loadUsers();
      flash(block ? "User blocked." : "User unblocked.");
    } catch (e) {
      setError(e.message || "Failed to update user status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceLogout = async (uid) => {
    setActionLoading(true);
    try {
      await fnForceLogout({ uid });
      setConfirmLogout(null);
      flash("User session terminated.");
    } catch (e) {
      setError(e.message || "Failed to force logout.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {/* Users Table */}
      <SectionCard
        title="User Management"
        subtitle="Create and manage all system users"
        icon="👥"
      >
        {successMsg && (
          <div style={{ background: "#E8F5E9", border: "1px solid #B8E0B8", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: T.statusGreen, fontSize: 13 }}>
            ✓ {successMsg}
          </div>
        )}
        {error && (
          <div style={{ background: T.dangerBg, border: "1px solid #F0B8B8", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: T.danger, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ marginBottom: 16, textAlign: "right" }}>
          <Button onClick={() => { setShowCreate(true); setError(""); }}>
            + Add New User
          </Button>
        </div>

        {loadingUsers ? (
          <div style={{ color: T.textSecondary, fontSize: 14, padding: 20, textAlign: "center" }}>
            Loading users…
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#F0EDED" }}>
                  {["Name", "Email", "Role", "Status", "Last Login", "Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${T.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 12px", fontWeight: 500, color: T.textPrimary }}>{u.name}</td>
                    <td style={{ padding: "12px 12px", color: T.textSecondary, fontSize: 13 }}>{u.email}</td>
                    <td style={{ padding: "12px 12px" }}>
                      <Badge label={u.role} color={ROLE_COLORS[u.role] || "gray"} />
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <Badge label={u.isActive ? "Active" : "Blocked"} color={u.isActive ? "green" : "red"} />
                    </td>
                    <td style={{ padding: "12px 12px", color: T.textMeta, fontSize: 12 }}>
                      {u.lastLogin ? new Date(u.lastLogin?.seconds * 1000).toLocaleDateString("en-IN") : "Never"}
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Button size="sm" variant="secondary" onClick={() => setEditUser({ ...u })}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setResetUser(u); setError(""); }}>Reset PW</Button>
                        <Button
                          size="sm"
                          variant={u.isActive ? "danger" : "secondary"}
                          onClick={() => setConfirmBlock({ user: u, block: u.isActive })}
                        >
                          {u.isActive ? "Block" : "Unblock"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmLogout(u)}>
                          Logout
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 24, color: T.textMeta, fontSize: 13 }}>
                      No users found. Add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Create User Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <ModalOverlay onClose={() => { setShowCreate(false); setForm(EMPTY_FORM); setError(""); }}>
          <ModalTitle>Create New User</ModalTitle>
          {error && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <FieldRow label="Full Name" required>
            <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Rahul Mehta" />
          </FieldRow>
          <FieldRow label="Email Address" required>
            <Input value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" placeholder="email@example.com" />
          </FieldRow>
          <FieldRow label="Temporary Password" required>
            <Input value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" placeholder="Min. 6 characters" />
          </FieldRow>
          <FieldRow label="Role" required>
            <Select value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={ROLES} />
          </FieldRow>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <Button variant="ghost" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setError(""); }}>Cancel</Button>
            <Button onClick={handleCreate} loading={actionLoading}>Create User</Button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Edit User Modal ───────────────────────────────────────────────── */}
      {editUser && (
        <ModalOverlay onClose={() => { setEditUser(null); setError(""); }}>
          <ModalTitle>Edit User</ModalTitle>
          {error && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <FieldRow label="Full Name">
            <Input value={editUser.name} onChange={(v) => setEditUser({ ...editUser, name: v })} />
          </FieldRow>
          <FieldRow label="Email Address">
            <Input value={editUser.email} onChange={(v) => setEditUser({ ...editUser, email: v })} type="email" />
          </FieldRow>
          <FieldRow label="Role">
            <Select value={editUser.role} onChange={(v) => setEditUser({ ...editUser, role: v })} options={ROLES} />
          </FieldRow>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <Button variant="ghost" onClick={() => { setEditUser(null); setError(""); }}>Cancel</Button>
            <Button onClick={handleUpdate} loading={actionLoading}>Save Changes</Button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Reset Password Modal ──────────────────────────────────────────── */}
      {resetUser && (
        <ModalOverlay onClose={() => { setResetUser(null); setNewPassword(""); setError(""); }}>
          <ModalTitle>Reset Password — {resetUser.name}</ModalTitle>
          {error && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <FieldRow label="New Password" required>
            <Input value={newPassword} onChange={setNewPassword} type="password" placeholder="Min. 6 characters" />
          </FieldRow>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <Button variant="ghost" onClick={() => { setResetUser(null); setNewPassword(""); }}>Cancel</Button>
            <Button onClick={handleResetPassword} loading={actionLoading}>Reset Password</Button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Confirm Block ──────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmBlock}
        title={confirmBlock?.block ? "Block User" : "Unblock User"}
        message={
          confirmBlock?.block
            ? `Block ${confirmBlock?.user?.name}? They will immediately lose access to the application and cannot log in until unblocked.`
            : `Unblock ${confirmBlock?.user?.name}? They will be able to log in again.`
        }
        confirmLabel={confirmBlock?.block ? "Block User" : "Unblock User"}
        confirmVariant={confirmBlock?.block ? "danger" : "primary"}
        onConfirm={() => handleBlock(confirmBlock.user.uid, confirmBlock.block)}
        onCancel={() => setConfirmBlock(null)}
      />

      {/* ── Confirm Force Logout ───────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmLogout}
        title="Force Logout"
        message={`Immediately terminate ${confirmLogout?.name}'s active session? They will be signed out on all devices.`}
        confirmLabel="Force Logout"
        confirmVariant="danger"
        onConfirm={() => handleForceLogout(confirmLogout.uid)}
        onCancel={() => setConfirmLogout(null)}
      />
    </>
  );
}

// ── Local modal helpers ────────────────────────────────────────────────────────
function ModalOverlay({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.cardElevated, borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}
function ModalTitle({ children }) {
  return <div style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary, marginBottom: 20 }}>{children}</div>;
}
