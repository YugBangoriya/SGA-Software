// src/pages/Settings/components/SuperAdmin/InvoiceDBControls.jsx
// SuperAdmin: Invoice DB lock/unlock, monthly ZIP backup, delete all invoices

import React, { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { SectionCard, Button, ConfirmDialog, Badge, T } from "./SettingsUI";
import { setInvoiceDbLock, deleteAllInvoices } from "../../lib/settingsService";
import { useSettings } from "../../hooks/useSettings";
import useAuthStore from "../../store/authStore"; // your existing auth store

const functions = getFunctions();
const fnExportZip = httpsCallable(functions, "exportInvoicesZip");

export default function InvoiceDBControls() {
  const { systemConfig, patchSystemConfig } = useSettings();
  const currentUser = useAuthStore((s) => s.userDoc);

  const [lockLoading, setLockLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [error, setError] = useState("");

  const isLocked = systemConfig.invoiceDbLocked;

  const handleLock = async () => {
    setLockLoading(true);
    setError("");
    try {
      await setInvoiceDbLock(true, currentUser?.name || currentUser?.displayName || "SuperAdmin");
      patchSystemConfig({
        invoiceDbLocked: true,
        invoiceDbLockedBy: currentUser?.name || currentUser?.displayName || "SuperAdmin",
        invoiceDbLockedAt: new Date(),
      });
      setConfirmLock(false);
    } catch (e) {
      setError("Failed to lock database: " + e.message);
    } finally {
      setLockLoading(false);
    }
  };

  const handleUnlock = async () => {
    setLockLoading(true);
    setError("");
    try {
      await setInvoiceDbLock(false, null);
      patchSystemConfig({ invoiceDbLocked: false, invoiceDbLockedBy: null, invoiceDbLockedAt: null });
      setConfirmUnlock(false);
    } catch (e) {
      setError("Failed to unlock database: " + e.message);
    } finally {
      setLockLoading(false);
    }
  };

  const handleExportZip = async () => {
    setExportLoading(true);
    setError("");
    setExportResult(null);
    try {
      const res = await fnExportZip();
      setExportResult(res.data);
    } catch (e) {
      setError("Export failed: " + (e.message || "Unknown error. Ensure invoice PDFs exist in Storage."));
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleteLoading(true);
    setError("");
    try {
      await deleteAllInvoices();
      setConfirmDelete(false);
      setExportResult(null);
      alert("All invoices deleted successfully. Remember to unlock the database.");
    } catch (e) {
      setError("Delete failed: " + e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      {/* ── Lock Status ───────────────────────────────────────────────────── */}
      <SectionCard
        title="Invoice Database Status"
        subtitle="Current lock state of the invoice database"
        icon="🔒"
        danger={isLocked}
      >
        {error && (
          <div style={{ background: T.dangerBg, borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: T.danger, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        <div
          style={{
            background: isLocked ? T.dangerBg : T.statusGreenBg,
            border: `1.5px solid ${isLocked ? "#F0B8B8" : "#B8E0B8"}`,
            borderRadius: 10,
            padding: "16px 18px",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 24 }}>{isLocked ? "🔒" : "🔓"}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: isLocked ? T.danger : T.statusGreen }}>
                Database is {isLocked ? "LOCKED" : "UNLOCKED"}
              </div>
              {isLocked && systemConfig.invoiceDbLockedBy && (
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>
                  Locked by <strong>{systemConfig.invoiceDbLockedBy}</strong>
                  {systemConfig.invoiceDbLockedAt && (
                    <> on {new Date(systemConfig.invoiceDbLockedAt?.seconds * 1000).toLocaleString("en-IN")}</>
                  )}
                </div>
              )}
              {!isLocked && (
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>
                  All users can access invoice records normally.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!isLocked ? (
            <Button
              variant="danger"
              onClick={() => setConfirmLock(true)}
              loading={lockLoading}
            >
              🔒 Lock Invoice Database
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setConfirmUnlock(true)}
              loading={lockLoading}
            >
              🔓 Unlock Invoice Database
            </Button>
          )}
        </div>
      </SectionCard>

      {/* ── Monthly Backup ─────────────────────────────────────────────────── */}
      <SectionCard
        title="Monthly Backup"
        subtitle="Export all invoices as individual PDFs in a single ZIP file"
        icon="📦"
      >
        <div
          style={{
            background: "#FFF8E1",
            border: "1px solid #FFE082",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#7A5500",
            lineHeight: 1.6,
          }}
        >
          <strong>Recommended monthly workflow:</strong>
          <ol style={{ margin: "8px 0 0 18px", padding: 0 }}>
            <li>Lock the invoice database above</li>
            <li>Export the ZIP backup using the button below</li>
            <li>Download and verify the ZIP file</li>
            <li>Delete all invoices (in the Danger Zone below)</li>
            <li>Unlock the database</li>
          </ol>
        </div>

        <Button onClick={handleExportZip} loading={exportLoading} variant="secondary">
          📦 Export All Invoices as ZIP
        </Button>

        {exportResult && (
          <div
            style={{
              marginTop: 14,
              background: T.statusGreenBg,
              border: "1px solid #B8E0B8",
              borderRadius: 8,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontWeight: 600, color: T.statusGreen, marginBottom: 6 }}>
              ✓ Export ready — {exportResult.fileCount} invoice PDF{exportResult.fileCount !== 1 ? "s" : ""}
            </div>
            <a
              href={exportResult.downloadUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                background: T.primary,
                color: "#fff",
                padding: "9px 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                marginTop: 6,
              }}
            >
              ⬇ Download ZIP (link valid 1 hour)
            </a>
          </div>
        )}
      </SectionCard>

      {/* ── Danger Zone ───────────────────────────────────────────────────── */}
      <SectionCard
        title="Danger Zone — Delete All Invoices"
        subtitle="Permanently removes all invoice records from the database. Irreversible."
        icon="⚠️"
        danger
      >
        <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
          This action <strong>permanently deletes every invoice record</strong> from Firestore. It cannot be undone.
          Only perform this after completing and verifying a ZIP backup.
        </div>
        <Button
          variant="danger"
          onClick={() => setConfirmDelete(true)}
          loading={deleteLoading}
        >
          🗑 Delete All Invoices
        </Button>
      </SectionCard>

      {/* ── Confirm Dialogs ───────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmLock}
        title="Lock Invoice Database"
        message="This will block ALL invoice access for ALL users including the Owner. Invoice screens will show a 'Database Locked' message until you unlock. Are you sure?"
        confirmLabel="Lock Database"
        confirmVariant="danger"
        onConfirm={handleLock}
        onCancel={() => setConfirmLock(false)}
      />

      <ConfirmDialog
        open={confirmUnlock}
        title="Unlock Invoice Database"
        message="This will restore invoice access for all users. Are you sure?"
        confirmLabel="Unlock Database"
        confirmVariant="primary"
        onConfirm={handleUnlock}
        onCancel={() => setConfirmUnlock(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete All Invoices"
        message="This permanently deletes every invoice from the database. This action cannot be undone. Please ensure you have downloaded and verified the ZIP backup first."
        confirmLabel="Delete All"
        confirmVariant="danger"
        requireTyping="DELETE"
        onConfirm={handleDeleteAll}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}