/**
 * CustomerForm.jsx
 * Multi-step form for creating and editing customer records.
 * Used by both /customers/new and /customers/:id/edit
 *
 * Steps:
 *   1 — Personal Info (name, phones)
 *   2 — Vehicle Info (reg no, make, model, year, emission)
 *   3 — CNG Details (kit brand, model, tank, advancers, add-ons)
 *   4 — Installation (date, technician, notes)
 *   5 — Custom Fields (SuperAdmin-defined extra columns)
 *
 * RBAC:
 *   - Owner + Employee: can create / edit standard fields
 *   - SuperAdmin: all fields including custom field schema
 *   - Employee: cannot edit retestDates (guarded in service layer & UI)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useCustomerStore from '../../store/customerStore';
import useAuth from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import { COLORS, FONTS, RADIUS } from '../../lib/tokens';
import { createCustomer, updateCustomer } from '../../lib/customerService';
import { logAudit, AUDIT_ACTIONS } from '../../lib/auditService';
import {
  Button, Input, Select, MultiSelect, Textarea, SectionDivider, Spinner, Card, Badge,
} from '../../components/ui/ui';

// ── Draft persistence key ─────────────────────────────────────────────────
const DRAFT_KEY = 'sg_customer_form_draft';

// ── Default form state ─────────────────────────────────────────────────────
const EMPTY = {
  // Step 1 — Personal
  name: '',
  phone: '',
  altPhone: '',
  // Step 2 — Vehicle
  vehicleNo: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  emissionCategory: '',
  // Step 3 — CNG
  cngKitBrand: '',
  cngKitModel: '',
  tankCapacity: '',
  advancers: [],
  addOns: [],
  // Step 4 — Installation
  installationDate: '',
  technicianName: '',
  notes: '',
  // Custom fields map
  customFields: {},
};

const STEPS = [
  { id: 1, label: 'Personal', icon: '👤' },
  { id: 2, label: 'Vehicle',  icon: '🚗' },
  { id: 3, label: 'CNG Kit',  icon: '⚡' },
  { id: 4, label: 'Install',  icon: '📅' },
  { id: 5, label: 'Custom',   icon: '🔧' },
];

// ── Validation per step ────────────────────────────────────────────────────
const validate = (step, data) => {
  const errs = {};
  if (step === 1) {
    if (!data.name.trim()) errs.name = 'Full name is required';
    if (!data.phone.trim()) errs.phone = 'Primary phone is required';
    else if (!/^\+?[\d\s\-()]{7,15}$/.test(data.phone)) errs.phone = 'Invalid phone number';
  }
  if (step === 2) {
    if (!data.vehicleNo.trim()) errs.vehicleNo = 'Vehicle registration number is required';
  }
  return errs;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerForm({ mode = 'create' }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isDark } = useTheme();
  const c = isDark ? COLORS.dark : COLORS.light;
  const { uid, displayName, isEmployee } = useAuth();

  const { dropdownOptions, customFields, loadSettings, activeCustomer, loadCustomer } = useCustomerStore();

  const [step, setStep] = useState(1);
  const [data, setData] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [loadingCustomer, setLoadingCustomer] = useState(mode === 'edit');

  const totalSteps = customFields.length > 0 ? 5 : 4;

  // ── Load settings (dropdown options, custom fields) ────────────────────────
  useEffect(() => { loadSettings(); }, []);

  // ── Load existing customer in edit mode ───────────────────────────────────
  useEffect(() => {
    if (mode === 'edit' && id) {
      setLoadingCustomer(true);
      loadCustomer(id).then(() => setLoadingCustomer(false));
    }
  }, [mode, id]);

  useEffect(() => {
    if (mode === 'edit' && activeCustomer) {
      setData({
        name:             activeCustomer.name || '',
        phone:            activeCustomer.phone || '',
        altPhone:         activeCustomer.altPhone || '',
        vehicleNo:        activeCustomer.vehicleNo || '',
        vehicleMake:      activeCustomer.vehicleMake || '',
        vehicleModel:     activeCustomer.vehicleModel || '',
        vehicleYear:      activeCustomer.vehicleYear || '',
        emissionCategory: activeCustomer.emissionCategory || '',
        cngKitBrand:      activeCustomer.cngKitBrand || '',
        cngKitModel:      activeCustomer.cngKitModel || '',
        tankCapacity:     activeCustomer.tankCapacity || '',
        advancers:        activeCustomer.advancers || [],
        addOns:           activeCustomer.addOns || [],
        installationDate: activeCustomer.installationDate || '',
        technicianName:   activeCustomer.technicianName || '',
        notes:            activeCustomer.notes || '',
        customFields:     activeCustomer.customFields || {},
      });
    }
  }, [activeCustomer]);

  // ── Draft persistence (create mode only) ──────────────────────────────────
  useEffect(() => {
    if (mode === 'create') {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        try { setData(JSON.parse(saved)); } catch (_) {}
      }
    }
  }, [mode]);

  const saveDraft = useCallback((newData) => {
    if (mode === 'create') {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(newData));
    }
  }, [mode]);

  // ── Field updater ─────────────────────────────────────────────────────────
  const set = (field, value) => {
    setData((prev) => {
      const next = { ...prev, [field]: value };
      // Reset kit model when brand changes
      if (field === 'cngKitBrand') next.cngKitModel = '';
      saveDraft(next);
      return next;
    });
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const setCustomField = (fieldId, value) => {
    setData((prev) => {
      const next = { ...prev, customFields: { ...prev.customFields, [fieldId]: value } };
      saveDraft(next);
      return next;
    });
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const next = () => {
    const errs = validate(step, data);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep((s) => Math.min(s + 1, totalSteps));
  };

  const prev = () => setStep((s) => Math.max(s - 1, 1));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validate(step, data);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setSaveError(null);
    try {
      if (mode === 'create') {
        const newId = await createCustomer({ ...data, createdBy: uid });
        await logAudit({
          action: AUDIT_ACTIONS.CUSTOMER_CREATED,
          userId: uid,
          userName: displayName,
          targetId: newId,
          targetCollection: 'customers',
          metadata: { name: data.name, vehicleNo: data.vehicleNo },
        });
        localStorage.removeItem(DRAFT_KEY);
        navigate(`/customers/${newId}`);
      } else {
        await updateCustomer(id, data);
        await logAudit({
          action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
          userId: uid,
          userName: displayName,
          targetId: id,
          targetCollection: 'customers',
          metadata: { name: data.name },
        });
        navigate(`/customers/${id}`);
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadingCustomer) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spinner size={36} />
      </div>
    );
  }

  return (
    <div style={{ background: c.appBg, minHeight: '100vh', fontFamily: FONTS.body }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: c.cardBg, borderBottom: `1px solid ${c.border}`, padding: '16px 16px 0', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.primary, fontSize: 20, padding: '0 4px', lineHeight: 1 }}
          >
            ←
          </button>
          <div>
            <h1 style={{ margin: 0, fontFamily: FONTS.heading, fontSize: 22, color: c.primary }}>
              {mode === 'create' ? 'New Customer' : 'Edit Customer'}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: c.textSecondary }}>
              {mode === 'create' ? 'Step ' + step + ' of ' + totalSteps : data.name}
            </p>
          </div>
        </div>

        {/* ── Step indicator ─────────────────────────────────────────── */}
        <StepBar steps={STEPS.slice(0, totalSteps)} currentStep={step} c={c} />
      </div>

      {/* ── Form body ──────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px 120px', maxWidth: 640, margin: '0 auto' }}>
        {step === 1 && <Step1 data={data} set={set} errors={errors} c={c} />}
        {step === 2 && <Step2 data={data} set={set} errors={errors} c={c} />}
        {step === 3 && <Step3 data={data} set={set} errors={errors} c={c} opts={dropdownOptions} />}
        {step === 4 && <Step4 data={data} set={set} errors={errors} c={c} opts={dropdownOptions} />}
        {step === 5 && customFields.length > 0 && (
          <Step5 data={data} setCustomField={setCustomField} customFields={customFields} c={c} />
        )}

        {saveError && (
          <div style={{ margin: '16px 0 0', padding: 12, background: c.statusRedBg, borderRadius: RADIUS.md, color: c.statusRedText, fontSize: 13 }}>
            ⚠ {saveError}
          </div>
        )}
      </div>

      {/* ── Bottom navigation ───────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: c.cardBg,
        borderTop: `1px solid ${c.border}`,
        padding: '12px 16px',
        display: 'flex', gap: 10,
        zIndex: 40,
      }}>
        {step > 1 && (
          <Button variant="secondary" onClick={prev} style={{ flex: 1 }}>
            ← Back
          </Button>
        )}
        {step < totalSteps ? (
          <Button onClick={next} style={{ flex: 2 }}>
            Next →
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={saving} style={{ flex: 2 }}>
            {mode === 'create' ? '✓ Save Customer' : '✓ Update Customer'}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP BAR
// ─────────────────────────────────────────────────────────────────────────────
function StepBar({ steps, currentStep, c }) {
  return (
    <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 1 }}>
      {steps.map((s, i) => {
        const active = s.id === currentStep;
        const done = s.id < currentStep;
        return (
          <div
            key={s.id}
            style={{
              flex: 1, padding: '8px 4px 10px',
              borderBottom: active ? `3px solid ${c.primary}` : done ? `3px solid ${c.statusGreenText}` : `3px solid transparent`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              transition: 'border-color 0.2s',
            }}
          >
            <span style={{ fontSize: 16 }}>{done ? '✓' : s.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
              color: active ? c.primary : done ? c.statusGreenText : c.textSecondary,
            }}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — PERSONAL INFO
// ─────────────────────────────────────────────────────────────────────────────
function Step1({ data, set, errors, c }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionDivider title="Personal Information" />
      <Input
        label="Full Name"
        required
        placeholder="e.g. Rahul Mehta"
        value={data.name}
        onChange={(e) => set('name', e.target.value)}
        error={errors.name}
        autoFocus
      />
      <Input
        label="Primary Phone"
        required
        type="tel"
        placeholder="e.g. 98765 43210"
        value={data.phone}
        onChange={(e) => set('phone', e.target.value)}
        error={errors.phone}
        inputMode="tel"
      />
      <Input
        label="Alternate Phone"
        type="tel"
        placeholder="Optional"
        value={data.altPhone}
        onChange={(e) => set('altPhone', e.target.value)}
        inputMode="tel"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — VEHICLE INFO
// ─────────────────────────────────────────────────────────────────────────────
function Step2({ data, set, errors, c }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionDivider title="Vehicle Information" />
      <Input
        label="Vehicle Registration Number"
        required
        placeholder="e.g. GJ01AB1234"
        value={data.vehicleNo}
        onChange={(e) => set('vehicleNo', e.target.value.toUpperCase())}
        error={errors.vehicleNo}
        style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input
          label="Vehicle Make / Company"
          placeholder="e.g. Maruti, Hyundai"
          value={data.vehicleMake}
          onChange={(e) => set('vehicleMake', e.target.value)}
        />
        <Input
          label="Vehicle Model"
          placeholder="e.g. Swift, i20"
          value={data.vehicleModel}
          onChange={(e) => set('vehicleModel', e.target.value)}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input
          label="Vehicle Year"
          type="number"
          placeholder="e.g. 2021"
          value={data.vehicleYear}
          onChange={(e) => set('vehicleYear', e.target.value)}
          inputMode="numeric"
          min="1990"
          max={new Date().getFullYear() + 1}
        />
        <Select
          label="Emission Category"
          placeholder="Select…"
          value={data.emissionCategory}
          onChange={(e) => set('emissionCategory', e.target.value)}
          options={['BS3', 'BS4', 'BS6', 'BS6 Phase 2']}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — CNG KIT DETAILS
// ─────────────────────────────────────────────────────────────────────────────
function Step3({ data, set, errors, c, opts }) {
  const kitModels = data.cngKitBrand && opts.cngKitModels?.[data.cngKitBrand]
    ? opts.cngKitModels[data.cngKitBrand]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionDivider title="CNG Kit Details" />
      <Select
        label="CNG Kit Brand"
        placeholder="Select brand…"
        value={data.cngKitBrand}
        onChange={(e) => set('cngKitBrand', e.target.value)}
        options={opts.cngKitBrands || []}
      />
      {data.cngKitBrand && (
        <Select
          label="CNG Kit Model"
          placeholder={kitModels.length ? 'Select model…' : 'Enter manually below'}
          value={data.cngKitModel}
          onChange={(e) => set('cngKitModel', e.target.value)}
          options={kitModels}
        />
      )}
      {(data.cngKitBrand === 'other' || !kitModels.length) && (
        <Input
          label={data.cngKitBrand === 'other' ? 'Kit Model (manual entry)' : 'Kit Model'}
          placeholder="Type kit model name"
          value={data.cngKitModel}
          onChange={(e) => set('cngKitModel', e.target.value)}
        />
      )}
      <Select
        label="Tank Capacity (Litres)"
        placeholder="Select capacity…"
        value={data.tankCapacity}
        onChange={(e) => set('tankCapacity', e.target.value)}
        options={(opts.tankCapacities || []).map((v) => ({ value: v, label: `${v} L` }))}
      />
      <MultiSelect
        label="Advancers"
        options={opts.advancers || []}
        value={data.advancers}
        onChange={(v) => set('advancers', v)}
      />
      <MultiSelect
        label="Add-Ons"
        options={opts.addOns || []}
        value={data.addOns}
        onChange={(v) => set('addOns', v)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — INSTALLATION INFO
// ─────────────────────────────────────────────────────────────────────────────
function Step4({ data, set, errors, c, opts }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionDivider title="Installation Details" />
      <Input
        label="Installation Date"
        type="date"
        value={data.installationDate}
        onChange={(e) => set('installationDate', e.target.value)}
        hint="This date is used to calculate CNG re-testing reminders."
      />
      <Select
        label="Technician Name"
        placeholder="Select technician…"
        value={data.technicianName}
        onChange={(e) => set('technicianName', e.target.value)}
        options={opts.technicians || []}
      />
      <Textarea
        label="Notes (internal)"
        placeholder="Any additional notes about this installation…"
        value={data.notes}
        onChange={(e) => set('notes', e.target.value)}
        rows={3}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — CUSTOM FIELDS (SuperAdmin-defined)
// ─────────────────────────────────────────────────────────────────────────────
function Step5({ data, setCustomField, customFields, c }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionDivider title="Additional Fields" />
      <p style={{ margin: 0, fontSize: 12, color: c.textSecondary }}>
        These fields were added by SuperAdmin and apply to all customers.
      </p>
      {customFields.map((field) => {
        const val = data.customFields?.[field.id] || '';
        if (field.type === 'select') {
          return (
            <Select
              key={field.id}
              label={field.label}
              placeholder="Select…"
              value={val}
              onChange={(e) => setCustomField(field.id, e.target.value)}
              options={field.options || []}
            />
          );
        }
        return (
          <Input
            key={field.id}
            label={field.label}
            type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
            value={val}
            onChange={(e) => setCustomField(field.id, e.target.value)}
          />
        );
      })}
    </div>
  );
}
