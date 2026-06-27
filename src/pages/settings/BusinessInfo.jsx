// SGA — Last updated: Feature — Added "Business Website URL" field to Settings
// Social & Location Links section. Saved as businessWebsiteUrl to Firestore
// /settings/main. Auto-included in the Quotation PDF "Connect With Us" section
// the same way Instagram, Facebook, and Google Maps links work.
// src/pages/settings/BusinessInfo.jsx
// Owner: business name, address, phone, logo upload, social + website links

import React, { useState, useRef } from "react";
import { SectionCard, FieldRow, Input, SaveRow, T } from "./SettingsUI";
import { saveBusinessInfo, uploadBusinessLogo } from "../../lib/settingsService";
import { useSettings } from "../../hooks/useSettings";

export default function BusinessInfo() {
  const { settings, patchSettings } = useSettings();

  const [form, setForm] = useState({
    businessName:       settings.businessName       || "",
    businessAddress:    settings.businessAddress    || "",
    businessPhone:      settings.businessPhone      || "",
    instagramUrl:       settings.instagramUrl       || "",
    facebookUrl:        settings.facebookUrl        || "",
    googleMapsUrl:      settings.googleMapsUrl      || "",
    businessWebsiteUrl: settings.businessWebsiteUrl || "",   // NEW
  });

  // Sync form when settings load after mount
  React.useEffect(() => {
    setForm({
      businessName:       settings.businessName       || "",
      businessAddress:    settings.businessAddress    || "",
      businessPhone:      settings.businessPhone      || "",
      instagramUrl:       settings.instagramUrl       || "",
      facebookUrl:        settings.facebookUrl        || "",
      googleMapsUrl:      settings.googleMapsUrl      || "",
      businessWebsiteUrl: settings.businessWebsiteUrl || "",  // NEW
    });
  }, [settings.businessName]);

  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview,   setLogoPreview]   = useState(settings.businessLogoUrl || "");
  const [error,         setError]         = useState("");
  const fileRef = useRef(null);

  const handleSave = async () => {
    if (!form.businessName.trim()) { setError("Business name is required."); return; }
    setSaving(true);
    setError("");
    try {
      await saveBusinessInfo(form);   // businessWebsiteUrl is included in form
      patchSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
      setError("Logo must be PNG, JPG, WebP, or SVG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);

    setLogoUploading(true);
    setError("");
    try {
      const url = await uploadBusinessLogo(file);
      patchSettings({ businessLogoUrl: url });
      setLogoPreview(url);
    } catch (e) {
      setError("Logo upload failed: " + e.message);
      setLogoPreview(settings.businessLogoUrl || "");
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <SectionCard
      title="Business Information"
      subtitle="Used in invoice and quotation PDF headers and for social quick-links"
      icon="🏢"
    >
      {error && (
        <div style={{ background: T.dangerBg, borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: T.danger, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Logo Upload ─────────────────────────────────────────────────── */}
      <FieldRow label="Business Logo" hint="Appears on all invoice and quotation PDFs. PNG/JPG/SVG, max 2 MB.">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 80, height: 80, borderRadius: 10, border: `2px dashed ${T.border}`, background: "#F8F5F3", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {logoPreview
              ? <img src={logoPreview} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <span style={{ fontSize: 28, color: T.textMeta }}>🏭</span>
            }
          </div>
          <div>
            <input type="file" ref={fileRef} accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoChange} style={{ display: "none" }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={logoUploading}
              style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: logoUploading ? "wait" : "pointer", fontFamily: "inherit" }}
            >
              {logoUploading ? "Uploading…" : logoPreview ? "Change Logo" : "Upload Logo"}
            </button>
            {logoPreview && !logoUploading && (
              <div style={{ fontSize: 11, color: T.statusGreen, marginTop: 4 }}>✓ Logo uploaded</div>
            )}
          </div>
        </div>
      </FieldRow>

      <div style={{ height: 1, background: T.border, margin: "8px 0 16px" }} />

      {/* ── Business Details ─────────────────────────────────────────────── */}
      <FieldRow label="Business Name" required>
        <Input value={form.businessName} onChange={(v) => setForm({ ...form, businessName: v })} placeholder="Shree Ganesh Automobile" />
      </FieldRow>

      <FieldRow label="Address" hint="Full address as it should appear on invoices">
        <Input value={form.businessAddress} onChange={(v) => setForm({ ...form, businessAddress: v })} placeholder="Shop No. X, Street, City, PIN" />
      </FieldRow>

      <FieldRow label="Phone Number">
        <Input value={form.businessPhone} onChange={(v) => setForm({ ...form, businessPhone: v })} placeholder="+91 98765 43210" type="tel" />
      </FieldRow>

      <div style={{ height: 1, background: T.border, margin: "8px 0 16px" }} />

      {/* ── Social & Location Links ───────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 600, color: T.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
        Social & Location Links
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 14, lineHeight: 1.5 }}>
        These links appear in quotation PDFs and Car quick-send messages.
      </div>

      <FieldRow label="Instagram Page URL">
        <Input value={form.instagramUrl} onChange={(v) => setForm({ ...form, instagramUrl: v })} placeholder="https://instagram.com/yourpage" type="url" />
      </FieldRow>

      <FieldRow label="Facebook Page URL">
        <Input value={form.facebookUrl} onChange={(v) => setForm({ ...form, facebookUrl: v })} placeholder="https://facebook.com/yourpage" type="url" />
      </FieldRow>

      <FieldRow label="Google Maps Link">
        <Input value={form.googleMapsUrl} onChange={(v) => setForm({ ...form, googleMapsUrl: v })} placeholder="https://maps.google.com/?q=..." type="url" />
      </FieldRow>

      {/* ── Business Website — NEW ────────────────────────────────────────── */}
      <FieldRow
        label="Business Website URL"
        hint="Optional. Shown in quotation PDFs under 'Connect With Us' alongside Instagram, Facebook, and Google Maps."
      >
        <Input
          value={form.businessWebsiteUrl}
          onChange={(v) => setForm({ ...form, businessWebsiteUrl: v })}
          placeholder="https://www.yourwebsite.com"
          type="url"
        />
      </FieldRow>

      <SaveRow onSave={handleSave} loading={saving} saved={saved} />
    </SectionCard>
  );
}