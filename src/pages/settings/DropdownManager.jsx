// src/pages/Settings/components/Owner/DropdownManager.jsx
// Owner: manage dropdown options for CNG Kit Brand, Model, Add-Ons, Advancers,
// Vehicle Emission Category, Technician Names, Payment Terms.
// Changes write to Firestore and immediately reflect in all forms.

import React, { useState } from "react";
import { SectionCard, FieldRow, Input, Button, SaveRow, T } from "./SettingsUI";
import { saveDropdownValues } from "../../lib/settingsService";
import { useSettings } from "../../hooks/useSettings";

const DROPDOWN_CATEGORIES = [
  {
    key: "cngKitBrands",
    label: "CNG Kit Brands",
    icon: "⚙️",
    hint: "Used in Customer Record — CNG Kit Brand field",
  },
  {
    key: "cngKitModels",
    label: "CNG Kit Models",
    icon: "🔧",
    hint: "Used in Customer Record — CNG Kit Model field",
  },
  {
    key: "addOns",
    label: "Add-Ons",
    icon: "➕",
    hint: "Used in Customer Record — Add-Ons multi-select",
  },
  {
    key: "advancers",
    label: "Advancers",
    icon: "⬆️",
    hint: "Used in Customer Record — Advancers multi-select",
  },
  {
    key: "vehicleEmissionCategories",
    label: "Vehicle Emission Categories",
    icon: "🌿",
    hint: "Used in Customer Record — Vehicle Emission Category field (e.g. BS4, BS6)",
  },
  {
    key: "technicianNames",
    label: "Technician Names",
    icon: "👨‍🔧",
    hint: "Used in Customer Record — Technician Name field",
  },
  {
    key: "paymentTerms",
    label: "Payment Terms (Invoice T&C Presets)",
    icon: "💳",
    hint: "Quick-select options for invoice payment terms",
  },
];

// One accordion panel per dropdown category
function DropdownCategory({ categoryKey, label, icon, hint, initialValues }) {
  const { patchDropdown } = useSettings();
  const [values, setValues] = useState(initialValues);
  const [newItem, setNewItem] = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => { setValues(initialValues); }, [JSON.stringify(initialValues)]);

  const addItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed) { setError("Cannot add an empty value."); return; }
    if (values.includes(trimmed)) { setError("This value already exists."); return; }
    setValues([...values, trimmed]);
    setNewItem("");
    setError("");
  };

  const deleteItem = (idx) => {
    setValues(values.filter((_, i) => i !== idx));
  };

  const startEdit = (idx) => {
    setEditIdx(idx);
    setEditValue(values[idx]);
    setError("");
  };

  const saveEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed) { setError("Cannot be empty."); return; }
    const dup = values.some((v, i) => v === trimmed && i !== editIdx);
    if (dup) { setError("Duplicate value."); return; }
    setValues(values.map((v, i) => (i === editIdx ? trimmed : v)));
    setEditIdx(null);
    setEditValue("");
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await saveDropdownValues(categoryKey, values);
      patchDropdown(categoryKey, values);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

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
      {/* Header */}
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
        <span style={{ fontSize: 16 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{label}</div>
          <div style={{ fontSize: 11, color: T.textMeta }}>{hint}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: "#F0EDED",
              color: T.textSecondary,
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 12,
              fontWeight: 600,
            }}
          >
            {values.length} {values.length === 1 ? "option" : "options"}
          </span>
          <span
            style={{
              color: T.primary,
              fontSize: 14,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          >
            ▾
          </span>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: "14px 16px", borderTop: `1px solid ${T.border}` }}>
          {error && (
            <div style={{ color: T.danger, fontSize: 12, marginBottom: 10 }}>⚠ {error}</div>
          )}

          {/* Existing Values */}
          {values.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              {values.map((val, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    background: "#F8F5F3",
                    borderRadius: 6,
                    marginBottom: 6,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <span style={{ fontSize: 12, color: T.textMeta, minWidth: 20, fontFamily: "monospace" }}>
                    {idx + 1}.
                  </span>

                  {editIdx === idx ? (
                    <>
                      <Input
                        value={editValue}
                        onChange={setEditValue}
                        style={{ flex: 1, padding: "5px 8px", fontSize: 13 }}
                      />
                      <Button size="sm" onClick={saveEdit}>✓</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditIdx(null); setError(""); }}>✕</Button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 13, color: T.textPrimary }}>{val}</span>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(idx)}>✏️</Button>
                      <Button size="sm" variant="danger" onClick={() => deleteItem(idx)}>✕</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: T.textMeta, marginBottom: 12, fontStyle: "italic" }}>
              No options yet. Add one below.
            </div>
          )}

          {/* Add new */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <Input
              value={newItem}
              onChange={setNewItem}
              placeholder={`Add new ${label.toLowerCase()} option…`}
              style={{ flex: 1 }}
            />
            <Button onClick={addItem} variant="secondary" style={{ flexShrink: 0 }}>
              + Add
            </Button>
          </div>

          {/* Save */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
            {saved && <span style={{ color: T.statusGreen, fontSize: 12 }}>✓ Saved</span>}
            <Button onClick={handleSave} loading={saving} size="sm">
              Save {label}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DropdownManager() {
  const { settings } = useSettings();
  const dropdowns = settings.dropdowns || {};

  return (
    <SectionCard
      title="Dropdown Value Management"
      subtitle="Manage the options that appear in all CNG-related form dropdowns across the application."
      icon="📝"
    >
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
        Changes to these options are reflected immediately in the Customer Record and Invoice forms.
        Each category is saved independently — click the Save button within each expanded section.
      </div>

      {DROPDOWN_CATEGORIES.map((cat) => (
        <DropdownCategory
          key={cat.key}
          categoryKey={cat.key}
          label={cat.label}
          icon={cat.icon}
          hint={cat.hint}
          initialValues={dropdowns[cat.key] || []}
        />
      ))}
    </SectionCard>
  );
}
