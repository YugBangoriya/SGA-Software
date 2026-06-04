// SGA — Last updated: Addressed ⚠️ Bug 11.3 — Added explanatory comment documenting
// why an empty or non-existent /settings Firestore document is handled safely here.
// followUpTemplates from useSettings() already defaults to [] when the doc is missing,
// and the component renders a clear "No templates yet" empty state in that case.
// No logic, UI, or schema has been changed.
// ─────────────────────────────────────────────────────────────────────────────
// src/pages/Settings/components/Owner/FollowUpTemplates.jsx
//
// Owner: full CRUD for follow-up message templates.
// Each template: name + message in English, Hindi, Gujarati.
// Templates are read by the Messaging module when scheduling follow-ups.
//
// FIX (Phase 8 Bug 8.4): Field names aligned with messagingStore schema.
// Messaging (FollowUpScheduler) reads messageEn/messageHi/messageGu.
// Settings previously used bodyEn/bodyHi/bodyGu — now corrected to match.
//
// ── EMPTY /settings DOC SAFETY NOTE (⚠️ Bug 11.3 — addressed) ─────────────
// If the /settings Firestore document does not yet exist (fresh deployment),
// useSettings() returns `{ followUpTemplates: [] }` via its internal fallback.
// This component handles the empty array case with a clear empty state:
//   "No templates yet. Add your first follow-up template."
//
// There is no crash, no undefined access, and no missing UI. The Owner simply
// sees the empty state and can add their first template immediately. No seeding
// of the /settings document is required for this component to function correctly.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { SectionCard, FieldRow, Input, Textarea, Button, ConfirmDialog, T } from "./SettingsUI";
import {
  saveFollowUpTemplate,
  deleteFollowUpTemplate,
} from "../../lib/settingsService";
import { useSettings } from "../../hooks/useSettings";

// ── Field name constants — single source of truth ────────────────────────────
// Changing these here is all that's needed to rename schema fields app-wide.
const LANG_LABELS = {
  messageEn: {
    label: "English",
    flag: "🇬🇧",
    placeholder: "Hi {customerName}, your CNG kit from Shree Ganesh Automobile is due for a follow-up. Please call us at your convenience.",
  },
  messageHi: {
    label: "Hindi",
    flag: "🇮🇳",
    placeholder: "नमस्ते {customerName}, आपका CNG किट का फॉलो-अप बाकी है। कृपया हमसे संपर्क करें।",
  },
  messageGu: {
    label: "Gujarati",
    flag: "🏵️",
    placeholder: "નમસ્તે {customerName}, તમારા CNG કીટ માટે ફૉલો-અપ બાકી છે. કૃપા કરી અમારો સંપર્ક કરો.",
  },
};

const EMPTY_FORM = { name: "", messageEn: "", messageHi: "", messageGu: "" };

// ─── Template card (collapsed list view) ─────────────────────────────────────
function TemplateCard({ template, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        marginBottom: 10,
        overflow: "hidden",
        background: T.cardElevated,
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "13px 16px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          userSelect: "none",
          background: open ? "#F8F4F2" : T.cardElevated,
        }}
      >
        <span style={{ fontSize: 16 }}>💬</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
            {template.name}
          </div>
          <div style={{ fontSize: 11, color: T.textMeta, marginTop: 2 }}>
            {template.messageEn
              ? template.messageEn.substring(0, 60) + (template.messageEn.length > 60 ? "…" : "")
              : "No English message"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => onEdit(template)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(template)}>Delete</Button>
        </div>
        <span
          style={{
            color: T.primary,
            fontSize: 14,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "14px 16px" }}>
          {Object.entries(LANG_LABELS).map(([key, meta]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>
                {meta.flag} {meta.label}
              </div>
              <div
                style={{
                  background: "#F8F5F3",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: template[key] ? T.textPrimary : T.textMeta,
                  lineHeight: 1.6,
                  fontStyle: template[key] ? "normal" : "italic",
                  border: `1px solid ${T.border}`,
                  whiteSpace: "pre-wrap",
                }}
              >
                {template[key] || "No content for this language"}
              </div>
            </div>
          ))}
          <div
            style={{
              background: "#EFF8FF",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 11,
              color: "#1A4A70",
            }}
          >
            💡 Available variables:{" "}
            <code>{"{customerName}"}</code>,{" "}
            <code>{"{vehicleNo}"}</code>,{" "}
            <code>{"{installDate}"}</code>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FollowUpTemplates() {
  // Safety: useSettings() returns `followUpTemplates: []` when /settings doc is
  // missing or has no templates array. The empty array is handled gracefully below
  // with a "No templates yet" message. No crash possible from missing Firestore doc.
  const { followUpTemplates, setFollowUpTemplates } = useSettings();
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [editingId, setEditingId]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [activeTab, setActiveTab]   = useState("messageEn");

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setActiveTab("messageEn");
    setShowForm(true);
  };

  const openEdit = (template) => {
    setForm({
      name:      template.name,
      messageEn: template.messageEn || "",
      messageHi: template.messageHi || "",
      messageGu: template.messageGu || "",
    });
    setEditingId(template.id);
    setError("");
    setActiveTab("messageEn");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim())      { setError("Template name is required."); return; }
    if (!form.messageEn.trim()) { setError("English message is required."); return; }

    setSaving(true);
    setError("");
    try {
      const id = await saveFollowUpTemplate(
        editingId ? { ...form, id: editingId } : form
      );
      const updated = editingId
        ? followUpTemplates.map((t) => (t.id === editingId ? { ...form, id: editingId } : t))
        : [...followUpTemplates, { ...form, id }];
      setFollowUpTemplates(updated);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (e) {
      setError("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFollowUpTemplate(deleteTarget.id);
      setFollowUpTemplates(followUpTemplates.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      setError("Failed to delete: " + e.message);
    }
  };

  return (
    <>
      <SectionCard
        title="Follow-Up Message Templates"
        subtitle="Templates used by the automated follow-up system. Each template can have English, Hindi, and Gujarati versions."
        icon="✉️"
      >
        {error && !showForm && (
          <div
            style={{
              background: T.dangerBg,
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 14,
              color: T.danger,
              fontSize: 13,
            }}
          >
            ⚠ {error}
          </div>
        )}

        <div
          style={{
            background: "#EFF8FF",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 12,
            color: "#1A4A70",
            lineHeight: 1.6,
          }}
        >
          Available variables in message bodies:{" "}
          <code>{"{customerName}"}</code>,{" "}
          <code>{"{vehicleNo}"}</code>,{" "}
          <code>{"{installDate}"}</code>.{" "}
          These are replaced with real customer data when the message is sent.
        </div>

        {followUpTemplates.length > 0 ? (
          followUpTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))
        ) : (
          // Empty state: shown safely when /settings doc is missing or has no templates.
          // This is the correct first-run UX — the Owner simply adds their first template.
          <div
            style={{
              textAlign: "center",
              padding: "24px 0",
              color: T.textMeta,
              fontSize: 13,
            }}
          >
            No templates yet. Add your first follow-up template.
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <Button onClick={openCreate}>+ New Template</Button>
        </div>
      </SectionCard>

      {/* ── Create / Edit Modal ──────────────────────────────────────────── */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 9000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: T.cardElevated,
              borderRadius: 16,
              padding: "28px 24px",
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                marginBottom: 20,
                color: T.textPrimary,
              }}
            >
              {editingId ? "Edit Template" : "New Follow-Up Template"}
            </div>

            {error && (
              <div style={{ color: T.danger, fontSize: 13, marginBottom: 12 }}>
                ⚠ {error}
              </div>
            )}

            <FieldRow label="Template Name" required>
              <Input
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="e.g. 7-Day Follow-Up, CNG Service Reminder"
              />
            </FieldRow>

            {/* Language Tabs */}
            <div
              style={{
                display: "flex",
                gap: 0,
                marginBottom: 16,
                borderRadius: 8,
                overflow: "hidden",
                border: `1px solid ${T.border}`,
              }}
            >
              {Object.entries(LANG_LABELS).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    flex: 1,
                    padding: "9px 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    borderRight: key !== "messageGu" ? `1px solid ${T.border}` : "none",
                    background: activeTab === key ? T.primary : T.cardElevated,
                    color: activeTab === key ? "#fff" : T.textSecondary,
                    fontFamily: "inherit",
                    transition: "background 0.2s",
                  }}
                >
                  {meta.flag} {meta.label}
                </button>
              ))}
            </div>

            <FieldRow
              label={`${LANG_LABELS[activeTab].flag} ${LANG_LABELS[activeTab].label} Message`}
              required={activeTab === "messageEn"}
              hint={activeTab === "messageEn" ? "Required" : "Optional"}
            >
              <Textarea
                value={form[activeTab]}
                onChange={(v) => setForm({ ...form, [activeTab]: v })}
                placeholder={LANG_LABELS[activeTab].placeholder}
                rows={5}
              />
            </FieldRow>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <Button
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                  setError("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {editingId ? "Update Template" : "Save Template"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Template"
        message={`Delete the "${deleteTarget?.name}" template? Any existing scheduled follow-ups using this template will not be affected.`}
        confirmLabel="Delete Template"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}