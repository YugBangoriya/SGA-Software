// src/pages/Settings/components/SuperAdmin/CustomFieldsManager.jsx
// SuperAdmin: add/edit/delete custom columns on Customer Record schema.
// Fields are stored in /settings/customFields and read by CustomerForm + CustomerProfile.

import React, { useState } from "react";
import { SectionCard, FieldRow, Input, Select, Button, ConfirmDialog, SaveRow, T } from "./SettingsUI";
import { saveCustomFields } from "../../lib/settingsService";
import { useSettings } from "../../hooks/useSettings";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown (options defined per field)" },
];

const EMPTY_FIELD = { key: "", label: "", type: "text", dropdownOptions: "", required: false };

export default function CustomFieldsManager() {
  const { customFields, setCustomFields } = useSettings();
  const [fields, setFields] = useState(customFields);
  const [showAdd, setShowAdd] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(EMPTY_FIELD);
  const [deleteIdx, setDeleteIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Sync if settings load after component mounts
  React.useEffect(() => { setFields(customFields); }, [customFields]);

  const generateKey = (label) =>
    label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  const handleAddOrEdit = () => {
    if (!form.label.trim()) { setError("Field label is required."); return; }
    const key = form.key || generateKey(form.label);
    const duplicate = fields.some((f, i) => f.key === key && i !== editIdx);
    if (duplicate) { setError("A field with this key already exists."); return; }

    const newField = {
      key,
      label: form.label.trim(),
      type: form.type,
      required: form.required,
      dropdownOptions:
        form.type === "dropdown"
          ? form.dropdownOptions.split(",").map((o) => o.trim()).filter(Boolean)
          : [],
    };

    let updated;
    if (editIdx !== null) {
      updated = fields.map((f, i) => (i === editIdx ? newField : f));
      setEditIdx(null);
    } else {
      updated = [...fields, newField];
    }
    setFields(updated);
    setForm(EMPTY_FIELD);
    setShowAdd(false);
    setError("");
  };

  const handleDelete = () => {
    const updated = fields.filter((_, i) => i !== deleteIdx);
    setFields(updated);
    setDeleteIdx(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCustomFields(fields);
      setCustomFields(fields);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (idx) => {
    const f = fields[idx];
    setForm({
      ...f,
      dropdownOptions: Array.isArray(f.dropdownOptions) ? f.dropdownOptions.join(", ") : "",
    });
    setEditIdx(idx);
    setShowAdd(true);
    setError("");
  };

  return (
    <>
      <SectionCard
        title="Custom Customer Fields"
        subtitle="Add extra columns to the Customer Record form. Fields appear on all customer profiles and forms immediately after saving."
        icon="🧩"
      >
        {error && (
          <div style={{ background: T.dangerBg, borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: T.danger, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        <div
          style={{
            background: "#EFF8FF",
            border: "1px solid #B8D8F0",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 12,
            color: "#1A4A70",
            lineHeight: 1.6,
          }}
        >
          These fields are added to every customer record. Use them for business-specific data not covered by the standard fields (e.g., "Referred By", "Service Plan", "Custom Notes").
        </div>

        {/* Existing Fields List */}
        {fields.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            {fields.map((f, i) => (
              <div
                key={f.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: T.cardElevated,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: T.textMeta, marginTop: 2 }}>
                    Key: <code style={{ background: "#F0EDED", padding: "1px 5px", borderRadius: 4 }}>{f.key}</code>
                    {" · "}Type: {f.type}
                    {f.required && " · Required"}
                    {f.type === "dropdown" && f.dropdownOptions?.length > 0 && (
                      <> · Options: {f.dropdownOptions.slice(0, 3).join(", ")}{f.dropdownOptions.length > 3 ? "…" : ""}</>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button size="sm" variant="secondary" onClick={() => startEdit(i)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteIdx(i)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "24px 0", color: T.textMeta, fontSize: 13 }}>
            No custom fields yet. Click below to add one.
          </div>
        )}

        <Button variant="secondary" onClick={() => { setShowAdd(true); setForm(EMPTY_FIELD); setEditIdx(null); setError(""); }}>
          + Add Custom Field
        </Button>

        <SaveRow onSave={handleSave} loading={saving} saved={saved}>
          <span style={{ fontSize: 12, color: T.textSecondary }}>
            Click Save to apply changes to all customer forms.
          </span>
        </SaveRow>
      </SectionCard>

      {/* ── Add / Edit Field Modal ─────────────────────────────────────────── */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: T.cardElevated, borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: T.textPrimary }}>
              {editIdx !== null ? "Edit Custom Field" : "Add Custom Field"}
            </div>
            {error && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <FieldRow label="Field Label" required hint="Shown to users on the form">
              <Input value={form.label} onChange={(v) => setForm({ ...form, label: v, key: generateKey(v) })} placeholder="e.g. Referred By" />
            </FieldRow>
            <FieldRow label="Field Key" hint="Auto-generated. Used in database.">
              <Input value={form.key} onChange={(v) => setForm({ ...form, key: v })} placeholder="referred_by" style={{ fontFamily: "monospace", fontSize: 13 }} />
            </FieldRow>
            <FieldRow label="Field Type">
              <Select value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={FIELD_TYPES} />
            </FieldRow>
            {form.type === "dropdown" && (
              <FieldRow label="Dropdown Options" hint="Comma-separated values, e.g. Option A, Option B, Option C">
                <Input value={form.dropdownOptions} onChange={(v) => setForm({ ...form, dropdownOptions: v })} placeholder="Option A, Option B, Option C" />
              </FieldRow>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input
                type="checkbox"
                id="required"
                checked={form.required}
                onChange={(e) => setForm({ ...form, required: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: T.primary }}
              />
              <label htmlFor="required" style={{ fontSize: 13, color: T.textPrimary, cursor: "pointer" }}>
                Required field
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => { setShowAdd(false); setForm(EMPTY_FIELD); setEditIdx(null); setError(""); }}>Cancel</Button>
              <Button onClick={handleAddOrEdit}>{editIdx !== null ? "Update Field" : "Add Field"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteIdx !== null}
        title="Delete Custom Field"
        message={`Delete the "${fields[deleteIdx]?.label}" field? Existing customer data stored under this field key will remain in the database but will no longer appear on forms.`}
        confirmLabel="Delete Field"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteIdx(null)}
      />
    </>
  );
}
