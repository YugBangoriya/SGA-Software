// src/pages/Settings/components/Owner/GSTAndTerms.jsx
// Owner: GST number, global low stock threshold, invoice terms & conditions

import React, { useState } from "react";
import { SectionCard, FieldRow, Input, Textarea, SaveRow, Badge, T } from "./SettingsUI";
import {
  saveGSTNumber,
  saveGlobalLowStockThreshold,
  saveTermsAndConditions,
} from "../../lib/settingsService";
import { useSettings } from "../../hooks/useSettings";

// ─── GST Settings ─────────────────────────────────────────────────────────────
export function GSTSettings() {
  const { settings, patchSettings, isGSTEnabled } = useSettings();
  const [gstNumber, setGstNumber] = useState(settings.gstNumber || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    setGstNumber(settings.gstNumber || "");
  }, [settings.gstNumber]);

  const validateGST = (val) => {
    if (!val) return true; // Empty is valid — means GST is disabled
    // Indian GSTIN: 15-character alphanumeric
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val.toUpperCase());
  };

  const handleSave = async () => {
    const trimmed = gstNumber.trim().toUpperCase();
    if (trimmed && !validateGST(trimmed)) {
      setError("Invalid GSTIN format. Must be a valid 15-character Indian GST number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveGSTNumber(trimmed);
      patchSettings({ gstNumber: trimmed });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="GST Settings"
      subtitle="When GSTIN is set, a GST checkbox appears on every invoice. When empty, GST is hidden everywhere."
      icon="📋"
    >
      {error && (
        <div style={{ background: T.dangerBg, borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: T.danger, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* GST Status Banner */}
      <div
        style={{
          background: isGSTEnabled ? T.statusGreenBg : T.statusAmberBg,
          border: `1px solid ${isGSTEnabled ? "#B8E0B8" : "#FFD088"}`,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18 }}>{isGSTEnabled ? "✅" : "⚠️"}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isGSTEnabled ? T.statusGreen : T.statusAmber }}>
            GST is currently {isGSTEnabled ? "ENABLED" : "DISABLED"}
          </div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
            {isGSTEnabled
              ? "GST breakdown (CGST + SGST) is available in invoice creation."
              : "Leave the GSTIN field empty to keep GST hidden from all invoice forms."}
          </div>
        </div>
      </div>

      <FieldRow
        label="GSTIN Number"
        hint="15-character Indian GST Identification Number. Leave empty to disable GST on all invoices."
      >
        <Input
          value={gstNumber}
          onChange={(v) => setGstNumber(v.toUpperCase())}
          placeholder="e.g. 24ABCDE1234F1Z5 (leave empty to disable GST)"
          style={{ fontFamily: "monospace", fontSize: 14, letterSpacing: 1 }}
        />
      </FieldRow>

      <SaveRow onSave={handleSave} loading={saving} saved={saved} />
    </SectionCard>
  );
}

// ─── Low Stock Default ────────────────────────────────────────────────────────
export function LowStockDefault() {
  const { settings, patchSettings } = useSettings();
  const [threshold, setThreshold] = useState(String(settings.globalLowStockThreshold ?? 5));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    setThreshold(String(settings.globalLowStockThreshold ?? 5));
  }, [settings.globalLowStockThreshold]);

  const handleSave = async () => {
    const val = parseInt(threshold, 10);
    if (isNaN(val) || val < 0) {
      setError("Must be a non-negative whole number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveGlobalLowStockThreshold(val);
      patchSettings({ globalLowStockThreshold: val });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="Low Stock Default Threshold"
      subtitle="New inventory items will use this threshold unless overridden individually in the Inventory module."
      icon="📦"
    >
      {error && (
        <div style={{ background: T.dangerBg, borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: T.danger, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}
      <FieldRow label="Default Low Stock Threshold (units)" hint="When item quantity falls at or below this number, a low stock alert is triggered.">
        <Input
          value={threshold}
          onChange={setThreshold}
          type="number"
          placeholder="5"
          style={{ maxWidth: 160 }}
        />
      </FieldRow>
      <SaveRow onSave={handleSave} loading={saving} saved={saved}>
        <span style={{ fontSize: 12, color: T.textSecondary }}>
          Currently: <strong>{settings.globalLowStockThreshold ?? 5} units</strong>
        </span>
      </SaveRow>
    </SectionCard>
  );
}

// ─── Terms & Conditions ───────────────────────────────────────────────────────
export function TermsAndConditions() {
  const { settings, patchSettings } = useSettings();
  const [text, setText] = useState(settings.invoiceTermsAndConditions || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    setText(settings.invoiceTermsAndConditions || "");
  }, [settings.invoiceTermsAndConditions]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await saveTermsAndConditions(text);
      patchSettings({ invoiceTermsAndConditions: text });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="Invoice Terms & Conditions"
      subtitle="This text appears at the bottom of every generated invoice PDF."
      icon="📄"
    >
      {error && (
        <div style={{ background: T.dangerBg, borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: T.danger, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}
      <FieldRow label="Terms & Conditions Text" hint="Use line breaks to separate numbered clauses.">
        <Textarea
          value={text}
          onChange={setText}
          rows={6}
          placeholder="1. Goods once sold will not be returned.&#10;2. Warranty as per manufacturer terms."
        />
      </FieldRow>
      <div style={{ fontSize: 12, color: T.textMeta, marginBottom: 14 }}>
        {text.length} characters
      </div>
      <SaveRow onSave={handleSave} loading={saving} saved={saved} />
    </SectionCard>
  );
}
