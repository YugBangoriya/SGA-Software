/**
 * CustomerSettings.jsx
 * Route: /settings/customers  (accessible from the More/Settings menu)
 *
 * TWO SECTIONS:
 * 1. Owner Settings — manage dropdown options:
 *    CNG Kit Brands, Kit Models (per brand), Tank Capacities,
 *    Advancers, Add-Ons, Technicians, Emission Categories
 *
 * 2. SuperAdmin Settings — manage custom field schema:
 *    Add/remove dynamic columns that appear on all customer forms
 *
 * RBAC: Owner can see Section 1. SuperAdmin sees both.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useCustomerStore from '../../store/customerStore';
import useAuth from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import { COLORS, FONTS, RADIUS } from '../../lib/tokens';
import { updateSettings, fetchSettings, saveCustomFields } from '../../lib/customerService';
import { logAudit, AUDIT_ACTIONS } from '../../lib/auditService';
import { Button, Input, Select, Card, SectionDivider, Badge, Modal, Spinner } from '../../components/ui/ui';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerSettings() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const c = isDark ? COLORS.dark : COLORS.light;
  const { uid, displayName, isOwnerOrAbove, isSuperAdmin } = useAuth();

  const { dropdownOptions, customFields, loadSettings } = useCustomerStore();

  const [localOpts, setLocalOpts] = useState(null);
  const [localFields, setLocalFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Custom field modal state
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [newField, setNewField] = useState({ label: '', type: 'text', options: '' });

  // Brand model management
  const [selectedBrand, setSelectedBrand] = useState('');
  const [newBrandInput, setNewBrandInput] = useState('');
  const [newModelInput, setNewModelInput] = useState('');

  useEffect(() => {
    (async () => {
      await loadSettings();
      const settings = await fetchSettings();
      setLocalOpts(settings ? {
        cngKitBrands:      settings.cngKitBrands || [],
        cngKitModels:      settings.cngKitModels || {},
        tankCapacities:    settings.tankCapacities || [],
        advancers:         settings.advancers || [],
        addOns:            settings.addOns || [],
        technicians:       settings.technicians || [],
        emissionCategories:settings.emissionCategories || [],
      } : { ...dropdownOptions });
      setLocalFields(customFields || []);
      setLoading(false);
    })();
  }, []);

  const showSave = (msg = 'Saved!') => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(''), 2500);
  };

  // ── Generic list manager ──────────────────────────────────────────────────
  const addToList = (key, value) => {
    if (!value.trim()) return;
    setLocalOpts((prev) => ({
      ...prev,
      [key]: prev[key].includes(value.trim()) ? prev[key] : [...prev[key], value.trim()],
    }));
  };

  const removeFromList = (key, value) => {
    setLocalOpts((prev) => ({ ...prev, [key]: prev[key].filter((v) => v !== value) }));
  };

  // ── Kit model management ──────────────────────────────────────────────────
  const addModel = () => {
    if (!selectedBrand || !newModelInput.trim()) return;
    setLocalOpts((prev) => {
      const existing = prev.cngKitModels[selectedBrand] || [];
      return {
        ...prev,
        cngKitModels: {
          ...prev.cngKitModels,
          [selectedBrand]: existing.includes(newModelInput.trim()) ? existing : [...existing, newModelInput.trim()],
        },
      };
    });
    setNewModelInput('');
  };

  const removeModel = (brand, model) => {
    setLocalOpts((prev) => ({
      ...prev,
      cngKitModels: {
        ...prev.cngKitModels,
        [brand]: (prev.cngKitModels[brand] || []).filter((m) => m !== model),
      },
    }));
  };

  // ── Save dropdown options to Firestore ─────────────────────────────────────
  const saveOptions = async () => {
    setSaving(true);
    try {
      await updateSettings(localOpts);
      await logAudit({ action: AUDIT_ACTIONS.SETTINGS_UPDATED, userId: uid, userName: displayName, targetCollection: 'settings', metadata: { section: 'customerDropdowns' } });
      await loadSettings();
      showSave('Dropdown options saved!');
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Save custom fields to Firestore (SuperAdmin only) ─────────────────────
  const saveFields = async () => {
    setSaving(true);
    try {
      await saveCustomFields(localFields);
      await logAudit({ action: AUDIT_ACTIONS.SETTINGS_UPDATED, userId: uid, userName: displayName, targetCollection: 'settings/customFields', metadata: { count: localFields.length } });
      await loadSettings();
      showSave('Custom fields saved!');
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addCustomField = () => {
    if (!newField.label.trim()) return;
    const field = {
      id: `cf_${Date.now()}`,
      label: newField.label.trim(),
      type: newField.type,
      options: newField.type === 'select'
        ? newField.options.split(',').map((o) => o.trim()).filter(Boolean)
        : undefined,
    };
    setLocalFields((prev) => [...prev, field]);
    setNewField({ label: '', type: 'text', options: '' });
    setShowFieldModal(false);
  };

  const removeCustomField = (fieldId) => {
    setLocalFields((prev) => prev.filter((f) => f.id !== fieldId));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spinner size={36} />
      </div>
    );
  }

  return (
    <div style={{ background: c.appBg, minHeight: '100vh', fontFamily: FONTS.body }}>
      {/* Header */}
      <div style={{ background: c.cardBg, borderBottom: `1px solid ${c.border}`, padding: '16px 16px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.primary, fontSize: 20 }}>←</button>
          <div>
            <h1 style={{ margin: 0, fontFamily: FONTS.heading, fontSize: 22, color: c.primary }}>Customer Settings</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: c.textSecondary }}>Manage dropdown options and custom fields</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 100px', maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {saveMsg && (
          <div style={{ padding: '10px 16px', background: c.statusGreenBg, color: c.statusGreenText, borderRadius: RADIUS.md, fontWeight: 600, fontSize: 13 }}>
            ✓ {saveMsg}
          </div>
        )}

        {/* ── OWNER SETTINGS ─────────────────────────────────────────────── */}
        {isOwnerOrAbove && (
          <>
            <SectionDivider title="Owner — Dropdown Options" />
            <p style={{ margin: 0, fontSize: 12, color: c.textSecondary }}>
              These lists appear as options when creating or editing a customer record.
            </p>

            <ListEditor label="CNG Kit Brands" items={localOpts.cngKitBrands} onAdd={(v) => addToList('cngKitBrands', v)} onRemove={(v) => removeFromList('cngKitBrands', v)} c={c} />
            <ListEditor label="Tank Capacities (Litres)" items={localOpts.tankCapacities} onAdd={(v) => addToList('tankCapacities', v)} onRemove={(v) => removeFromList('tankCapacities', v)} c={c} inputType="number" />
            <ListEditor label="Advancers" items={localOpts.advancers} onAdd={(v) => addToList('advancers', v)} onRemove={(v) => removeFromList('advancers', v)} c={c} />
            <ListEditor label="Add-Ons" items={localOpts.addOns} onAdd={(v) => addToList('addOns', v)} onRemove={(v) => removeFromList('addOns', v)} c={c} />
            <ListEditor label="Technicians" items={localOpts.technicians} onAdd={(v) => addToList('technicians', v)} onRemove={(v) => removeFromList('technicians', v)} c={c} />
            <ListEditor label="Emission Categories" items={localOpts.emissionCategories} onAdd={(v) => addToList('emissionCategories', v)} onRemove={(v) => removeFromList('emissionCategories', v)} c={c} />

            {/* CNG Kit Models per brand */}
            <Card style={{ padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: c.textPrimary }}>CNG Kit Models (per Brand)</h3>
              <Select
                placeholder="Select a brand to manage its models…"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                options={localOpts.cngKitBrands}
                containerStyle={{ marginBottom: 10 }}
              />
              {selectedBrand && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {(localOpts.cngKitModels[selectedBrand] || []).map((m) => (
                      <span key={m} style={{ background: c.statusBlueBg, color: c.statusBlueText, padding: '4px 10px', borderRadius: RADIUS.full, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {m}
                        <button onClick={() => removeModel(selectedBrand, m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.statusBlueText, fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
                      </span>
                    ))}
                    {!(localOpts.cngKitModels[selectedBrand]?.length) && (
                      <span style={{ color: c.textSecondary, fontSize: 12 }}>No models yet for {selectedBrand}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input placeholder={`Add model for ${selectedBrand}…`} value={newModelInput} onChange={(e) => setNewModelInput(e.target.value)} style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && addModel()} />
                    <Button size="sm" onClick={addModel}>Add</Button>
                  </div>
                </>
              )}
            </Card>

            <Button onClick={saveOptions} loading={saving} fullWidth>
              Save Dropdown Options
            </Button>
          </>
        )}

        {/* ── SUPERADMIN — CUSTOM FIELDS ─────────────────────────────────── */}
        {isSuperAdmin && (
          <>
            <SectionDivider title="SuperAdmin — Custom Fields" />
            <p style={{ margin: 0, fontSize: 12, color: c.textSecondary }}>
              Add custom columns that will appear on all customer records. These fields are shown on the create/edit form and customer profile.
            </p>

            {localFields.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: c.textSecondary, fontSize: 13 }}>
                No custom fields defined yet. Click below to add one.
              </div>
            )}

            {localFields.map((field, i) => (
              <Card key={field.id} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: c.textPrimary }}>{field.label}</div>
                  <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>
                    Type: <strong>{field.type}</strong>
                    {field.options?.length > 0 && ` · Options: ${field.options.join(', ')}`}
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => removeCustomField(field.id)}>Remove</Button>
              </Card>
            ))}

            <Button variant="secondary" onClick={() => setShowFieldModal(true)}>
              + Add Custom Field
            </Button>

            <Button onClick={saveFields} loading={saving} fullWidth>
              Save Custom Fields
            </Button>
          </>
        )}
      </div>

      {/* ── Add Custom Field Modal ──────────────────────────────────────────── */}
      <Modal
        open={showFieldModal}
        onClose={() => setShowFieldModal(false)}
        title="Add Custom Field"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowFieldModal(false)}>Cancel</Button>
            <Button onClick={addCustomField} disabled={!newField.label.trim()}>Add Field</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Field Label"
            required
            placeholder="e.g. Insurance Company, Loan Provider"
            value={newField.label}
            onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))}
            autoFocus
          />
          <Select
            label="Field Type"
            value={newField.type}
            onChange={(e) => setNewField((p) => ({ ...p, type: e.target.value }))}
            options={[
              { value: 'text', label: 'Text' },
              { value: 'number', label: 'Number' },
              { value: 'date', label: 'Date' },
              { value: 'select', label: 'Dropdown (Select)' },
            ]}
          />
          {newField.type === 'select' && (
            <Input
              label="Dropdown Options (comma-separated)"
              placeholder="e.g. Option A, Option B, Option C"
              value={newField.options}
              onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
              hint="Users will choose from these options."
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST EDITOR — reusable add/remove chip editor
// ─────────────────────────────────────────────────────────────────────────────
function ListEditor({ label, items = [], onAdd, onRemove, c, inputType = 'text' }) {
  const [input, setInput] = useState('');
  const handleAdd = () => { onAdd(input); setInput(''); };

  return (
    <Card style={{ padding: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: c.textPrimary, marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {items.map((item) => (
          <span key={item} style={{ background: c.elevatedBg, color: c.textPrimary, padding: '4px 10px', borderRadius: RADIUS.full, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${c.border}` }}>
            {item}
            <button onClick={() => onRemove(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textSecondary, fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
          </span>
        ))}
        {items.length === 0 && <span style={{ color: c.textSecondary, fontSize: 12 }}>No options yet.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input
          placeholder={`Add new ${label.toLowerCase()}…`}
          value={input}
          type={inputType}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          style={{ flex: 1 }}
        />
        <Button size="sm" onClick={handleAdd} disabled={!input.trim()}>Add</Button>
      </div>
    </Card>
  );
}
