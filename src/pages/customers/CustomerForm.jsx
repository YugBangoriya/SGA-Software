// SGA — Last updated: Vehicle Registration Number and Emission Category made optional (client request); removed required validation and * indicator for both fields
/**
 * CustomerForm.jsx — Shree Ganesh Automobile
 * Multi-step form for creating and editing customer records.
 *
 * Steps:
 *   1 — Personal Info (name, phones) + soft duplicate check against Firestore
 *   2 — Vehicle(s) — registration, car company/model from Car Repo (or manual), year, emission
 *       → Multiple vehicles supported: user can add additional vehicles before proceeding
 *   3 — CNG Kit (per vehicle) — 4 new fields: CNG Kit, CKP Advancer, Extras, Cylinder
 *       → Each field uses a dropdown from Settings → Dropdown Values + manual entry option
 *       → Emission category auto-shown from vehicle selected in Step 2
 *   4 — Installation (per vehicle) — date, technician, notes
 *   5 — Custom Fields (SuperAdmin-defined extra columns)
 *
 * DATA STRUCTURE:
 *   Form state uses `vehicles[]` array. On save:
 *   - `vehicles[]` written to Firestore
 *   - Flat legacy fields (vehicleNo, vehicleMake, vehicleModel, emissionCategory, installationDate,
 *     technicianName) mirrored from vehicles[0] for backward compat with CustomerDetail, InvoiceStep, etc.
 *
 * BACKWARD COMPAT (edit mode):
 *   If existing customer has no `vehicles` array, flat fields are migrated into vehicles[0] so
 *   the form always works in edit mode regardless of when the customer was created.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import useCustomerStore from '../../store/customerStore';
import useAuth from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import { COLORS, FONTS, RADIUS } from '../../lib/tokens';
import { createCustomer, updateCustomer } from '../../lib/customerService';
import { logAudit, AUDIT_ACTIONS } from '../../lib/auditService';
import { flagCarNotInRepository } from '../../lib/carRepositoryService';
import {
  Button, Input, Select, Textarea, SectionDivider, Spinner, Card,
} from '../../components/ui/ui';

// ─── Empty vehicle factory ─────────────────────────────────────────────────
const EMPTY_VEHICLE = () => ({
  _vid: `v_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
  vehicleNo:         '',
  vehicleCompany:    '',      // selected from Car Repo, or '' if manual
  vehicleModel:      '',
  vehicleYear:       '',
  emissionCategory:  '',
  isManualVehicle:   false,   // true when user chose "Not in list"
  notInListCompany:  '',
  notInListModel:    '',
  // CNG Kit
  cngKit:            '',
  cngKitIsManual:    false,
  ckpAdvancer:       '',
  ckpAdvancerIsManual: false,
  extras:            '',
  extrasIsManual:    false,
  cylinder:          '',
  cylinderIsManual:  false,
  // Installation
  installationDate:  '',
  technicianName:    '',
  notes:             '',
});

// ─── Map existing customer → form state ───────────────────────────────────
const mapCustomerToVehicles = (c) => {
  if (c.vehicles && Array.isArray(c.vehicles) && c.vehicles.length > 0) {
    return c.vehicles.map((v) => ({
      ...EMPTY_VEHICLE(),
      ...v,
      // ensure _vid exists
      _vid: v._vid || `v_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    }));
  }
  // Migrate flat fields to single vehicle
  const v0 = EMPTY_VEHICLE();
  return [{
    ...v0,
    vehicleNo:        c.vehicleNo         || '',
    vehicleCompany:   c.vehicleMake        || '',
    vehicleModel:     c.vehicleModel       || '',
    vehicleYear:      c.vehicleYear        || '',
    emissionCategory: c.emissionCategory   || '',
    isManualVehicle:  false,
    cngKit:           c.cngKitBrand        || '',
    ckpAdvancer:      Array.isArray(c.advancers) ? c.advancers[0] || '' : '',
    extras:           Array.isArray(c.addOns) ? c.addOns[0] || '' : '',
    cylinder:         '',
    installationDate: c.installationDate   || '',
    technicianName:   c.technicianName     || '',
    notes:            c.notes              || '',
  }];
};

const EMPTY_FORM = () => ({
  name:         '',
  phone:        '',
  altPhone:     '',
  vehicles:     [EMPTY_VEHICLE()],
  customFields: {},
});

const STEPS_BASE = [
  { id: 1, label: 'Personal',   icon: '👤' },
  { id: 2, label: 'Vehicle',    icon: '🚗' },
  { id: 3, label: 'CNG Kit',    icon: '⚡' },
  { id: 4, label: 'Install',    icon: '📅' },
];

// ─── Helper: get display name for a vehicle ─────────────────────────────────
const vehicleLabel = (v, idx) => {
  const reg = v.vehicleNo || v.notInListCompany || `Vehicle ${idx + 1}`;
  const model = v.vehicleModel || v.notInListModel || '';
  return model ? `${reg} — ${model}` : reg;
};

// ─── Dropdown with manual entry option ────────────────────────────────────
// DropdownOrManual — now accepts `c` (computed dark/light color object) so all
// borders, backgrounds and text colours respond correctly to dark mode.
function DropdownOrManual({ label, hint, options = [], value, isManual, onValueChange, onIsManualChange, placeholder = 'Select…', required, c }) {
  // Fallback to light-mode tokens when `c` is not provided (shouldn't happen
  // in practice but keeps the component safe when used standalone).
  const border         = c?.border         || '#E8E2DF';
  const primary        = c?.primary        || '#661F1F';
  const cardBg         = c?.cardBg         || '#F5F0EE';
  const textPrimary    = c?.textPrimary    || '#222222';
  const textSecondary  = c?.textSecondary  || '#666666';

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: FONTS.sans }}>
          {label}{required && <span style={{ color: '#CC0000', marginLeft: 2 }}>*</span>}
        </label>
        <button
          type="button"
          onClick={() => onIsManualChange(!isManual)}
          style={{ background: 'none', border: 'none', fontSize: 11, color: primary, cursor: 'pointer', fontFamily: FONTS.sans, fontWeight: 600, padding: 0 }}
        >
          {isManual ? '← Use dropdown' : '✏ Enter manually'}
        </button>
      </div>
      {isManual ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={`Type ${label.toLowerCase()} name…`}
          autoFocus
          style={{
            width: '100%', padding: '10px 12px',
            border: `1.5px solid ${primary}`,
            borderRadius: RADIUS.md, fontSize: 14, fontFamily: FONTS.sans,
            background: cardBg, color: textPrimary,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      ) : (
        <select
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px',
            border: `1.5px solid ${border}`,
            borderRadius: RADIUS.md, fontSize: 14, fontFamily: FONTS.sans,
            background: cardBg, color: value ? textPrimary : textSecondary,
            outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: textSecondary, fontFamily: FONTS.sans }}>{hint}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function CustomerForm() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const mode      = id ? 'edit' : 'create';
  const { user }  = useAuth();
  const { isDark } = useTheme();

  const { loadSettings, dropdownOptions, customFields, loadCustomer, activeCustomer, isLoadingCustomer } = useCustomerStore();

  // ── Form state ────────────────────────────────────────────────────────────
  const [data,   setData]   = useState(EMPTY_FORM());
  const [step,   setStep]   = useState(1);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Duplicate check state ──────────────────────────────────────────────────
  const [dupName,  setDupName]  = useState(null);  // { id, name, phone }[]
  const [dupPhone, setDupPhone] = useState(null);
  const [dupChecking, setDupChecking] = useState(false);
  const dupTimerRef = useRef(null);

  // ── Car repository state ──────────────────────────────────────────────────
  const [carRepo, setCarRepo] = useState([]);  // [{ id, name, models: [{id, name, ...}] }]
  const [carRepoLoading, setCarRepoLoading] = useState(false);

  // ── Active vehicle for steps 3 & 4 ────────────────────────────────────────
  const [activeVIdx, setActiveVIdx] = useState(0);

  // ── Colors ────────────────────────────────────────────────────────────────
  const c = isDark
    ? { cardBg: '#2A2A2A', border: '#3A3A3A', primary: '#8B3A3A', textSecondary: '#999999', textPrimary: '#E8E8E8', statusRedBg: '#2E1010', statusRedText: '#EF5350', divider: '#3A3A3A', bg: '#1A1A1A', elevatedBg: '#333333', statusAmberBg: '#2E2010', statusAmberText: '#FFA726', }
    : { cardBg: '#F5F0EE', border: '#E8E2DF', primary: '#661F1F', textSecondary: '#666666', textPrimary: '#222222', statusRedBg: '#FFEBEE', statusRedText: '#CC0000', divider: '#E0D8D4', bg: '#CDCBC9', elevatedBg: '#E8E2DF', statusAmberBg: '#FFF3E0', statusAmberText: '#CC6600', };

  const opts = dropdownOptions;

  // ── Calculate steps ──────────────────────────────────────────────────────
  const hasCustomFields = customFields.length > 0;
  const STEPS = hasCustomFields ? [...STEPS_BASE, { id: 5, label: 'More', icon: '📋' }] : STEPS_BASE;
  const totalSteps = STEPS.length;

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    loadSettings();
    fetchCarRepository();
    if (mode === 'edit' && id) {
      loadCustomer(id);
    }
  }, [id]); // eslint-disable-line

  useEffect(() => {
    if (mode === 'edit' && activeCustomer) {
      setData({
        name:         activeCustomer.name         || '',
        phone:        activeCustomer.phone        || '',
        altPhone:     activeCustomer.altPhone     || '',
        vehicles:     mapCustomerToVehicles(activeCustomer),
        customFields: activeCustomer.customFields || {},
      });
    }
  }, [activeCustomer, mode]);

  const fetchCarRepository = async () => {
    setCarRepoLoading(true);
    try {
      const q = query(collection(db, 'carRepository'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setCarRepo(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('[CustomerForm] Car repo fetch error:', err);
    } finally {
      setCarRepoLoading(false);
    }
  };

  // ── Soft duplicate check (debounced, Step 1 only) ─────────────────────────
  const checkDuplicate = useCallback((field, value) => {
    if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
    if (!value?.trim() || value.trim().length < 3) {
      if (field === 'name')  setDupName(null);
      if (field === 'phone') setDupPhone(null);
      return;
    }
    dupTimerRef.current = setTimeout(async () => {
      setDupChecking(true);
      try {
        const q = query(
          collection(db, 'customers'),
          where(field, '==', value.trim()),
          limit(3)
        );
        const snap = await getDocs(q);
        const matches = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .filter((c) => mode === 'create' || c.id !== id);
        if (field === 'name')  setDupName(matches.length  > 0 ? matches : null);
        if (field === 'phone') setDupPhone(matches.length > 0 ? matches : null);
      } catch (_) {}
      finally { setDupChecking(false); }
    }, 600);
  }, [mode, id]);

  // ── Field setters ─────────────────────────────────────────────────────────
  const set = (field, value) => {
    setData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'name')  checkDuplicate('name',  value);
    if (field === 'phone') checkDuplicate('phone', value);
  };

  // Update a specific vehicle field
  const setVehicle = (vIdx, field, value) => {
    setData((prev) => {
      const vehicles = prev.vehicles.map((v, i) =>
        i === vIdx ? { ...v, [field]: value } : v
      );
      return { ...prev, vehicles };
    });
  };

  const setCustomField = (fieldId, value) => {
    setData((prev) => ({
      ...prev,
      customFields: { ...prev.customFields, [fieldId]: value },
    }));
  };

  // Add a new vehicle
  const addVehicle = () => {
    setData((prev) => ({ ...prev, vehicles: [...prev.vehicles, EMPTY_VEHICLE()] }));
  };

  // Remove a vehicle (min 1)
  const removeVehicle = (vIdx) => {
    if (data.vehicles.length <= 1) return;
    setData((prev) => ({ ...prev, vehicles: prev.vehicles.filter((_, i) => i !== vIdx) }));
    if (activeVIdx >= vIdx && activeVIdx > 0) setActiveVIdx((i) => i - 1);
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (step === 1) {
      // Personal details are optional — client decision.
      // The duplicate check still runs as a soft warning but never blocks submission.
    }
    if (step === 2) {
      // Vehicle registration number and emission category are optional — client decision.
      // No validation required on these fields.
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    if (step < totalSteps) setStep((s) => s + 1);
  };
  const prev = () => {
    if (step > 1) setStep((s) => s - 1);
    setErrors({});
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError('');
    try {
      const firstV = data.vehicles[0] || {};

      // Build the Firestore payload
      const payload = {
        name:     data.name.trim(),
        phone:    data.phone.trim(),
        altPhone: data.altPhone.trim(),
        vehicles: data.vehicles,
        customFields: data.customFields,

        // ── Flat legacy fields from vehicles[0] (backward compat) ──
        vehicleNo:        firstV.vehicleNo        || '',
        vehicleMake:      firstV.isManualVehicle ? (firstV.notInListCompany || '') : (firstV.vehicleCompany || ''),
        vehicleModel:     firstV.isManualVehicle ? (firstV.notInListModel   || '') : (firstV.vehicleModel   || ''),
        vehicleYear:      firstV.vehicleYear      || '',
        emissionCategory: firstV.emissionCategory || '',
        installationDate: firstV.installationDate || '',
        technicianName:   firstV.technicianName   || '',
        notes:            firstV.notes            || '',
        // Legacy CNG fields (from redesigned fields)
        cngKitBrand:      firstV.cngKit            || '',
        cngKitModel:      '',
        tankCapacity:     '',
        advancers:        firstV.ckpAdvancer ? [firstV.ckpAdvancer] : [],
        addOns:           firstV.extras     ? [firstV.extras]       : [],
      };

      let customerId;
      if (mode === 'create') {
        customerId = await createCustomer(payload, user);
      } else {
        await updateCustomer(id, payload, user);
        customerId = id;
      }

      // Notify SuperAdmin for any manually-entered vehicles not in Car Repo
      for (const v of data.vehicles) {
        if (v.isManualVehicle && (v.notInListCompany || v.notInListModel)) {
          try {
            await flagCarNotInRepository({
              vehicleCompany: v.notInListCompany || v.vehicleCompany,
              vehicleModel:   v.notInListModel   || v.vehicleModel,
              quotationId:    null,
              quotationNumber: null,
              createdBy:      user.uid,
              createdByName:  user.displayName || user.email,
            });
          } catch (_) {}
        }
      }

      try {
        await logAudit({
          action:           mode === 'create' ? AUDIT_ACTIONS.CUSTOMER_CREATED : AUDIT_ACTIONS.CUSTOMER_UPDATED,
          userId:           user.uid,
          userName:         user.displayName || user.email,
          targetId:         customerId,
          targetCollection: 'customers',
          metadata:         { name: data.name, phone: data.phone, vehicleCount: data.vehicles.length },
        });
      } catch (_) {}

      navigate(mode === 'create' ? `/customers/${customerId}` : `/customers/${id}`);
    } catch (err) {
      setSaveError(err.message || 'Failed to save customer. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading (edit mode) ───────────────────────────────────────────────────
  if (mode === 'edit' && isLoadingCustomer) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ background: isDark ? '#1A1A1A' : '#CDCBC9', minHeight: '100vh' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: c.cardBg, borderBottom: `1px solid ${c.border}`, padding: '16px 16px 0', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.primary, fontSize: 20, padding: '0 4px', lineHeight: 1 }}>←</button>
          <div>
            <h1 style={{ margin: 0, fontFamily: FONTS.heading, fontSize: 22, color: c.primary }}>
              {mode === 'create' ? 'New Customer' : 'Edit Customer'}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: c.textSecondary }}>
              {mode === 'create' ? `Step ${step} of ${totalSteps}` : data.name}
            </p>
          </div>
        </div>

        {/* Step bar */}
        <StepBar steps={STEPS.slice(0, totalSteps)} currentStep={step} c={c} />
      </div>

      {/* ── Form body ──────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px 120px', maxWidth: 640, margin: '0 auto' }}>
        {step === 1 && (
          <Step1
            data={data} set={set} errors={errors} c={c}
            dupName={dupName} dupPhone={dupPhone} dupChecking={dupChecking}
          />
        )}
        {step === 2 && (
          <Step2
            data={data} setVehicle={setVehicle} addVehicle={addVehicle}
            removeVehicle={removeVehicle} errors={errors} c={c}
            carRepo={carRepo} carRepoLoading={carRepoLoading}
            opts={opts}
          />
        )}
        {step === 3 && (
          <Step3
            data={data} setVehicle={setVehicle} c={c}
            opts={opts} activeVIdx={activeVIdx} setActiveVIdx={setActiveVIdx}
          />
        )}
        {step === 4 && (
          <Step4
            data={data} setVehicle={setVehicle} c={c}
            opts={opts} activeVIdx={activeVIdx} setActiveVIdx={setActiveVIdx}
          />
        )}
        {step === 5 && hasCustomFields && (
          <Step5 data={data} setCustomField={setCustomField} customFields={customFields} c={c} />
        )}

        {saveError && (
          <div style={{ margin: '16px 0 0', padding: 12, background: c.statusRedBg, borderRadius: RADIUS.md, color: c.statusRedText, fontSize: 13 }}>
            ⚠ {saveError}
          </div>
        )}
      </div>

      {/* ── Bottom navigation ─────────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: c.cardBg, borderTop: `1px solid ${c.border}`, padding: '12px 16px', display: 'flex', gap: 10, zIndex: 40 }}>
        {step > 1 && (
          <Button variant="secondary" onClick={prev} style={{ flex: 1 }}>← Back</Button>
        )}
        {step < totalSteps ? (
          <Button onClick={next} style={{ flex: 2 }}>Next →</Button>
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
      {steps.map((s) => {
        const active = s.id === currentStep;
        const done   = s.id < currentStep;
        return (
          <div key={s.id} style={{ flex: 1, padding: '8px 4px 10px', borderBottom: active ? `3px solid ${c.primary}` : done ? '3px solid #1A7A1A' : '3px solid transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transition: 'border-color 0.2s' }}>
            <span style={{ fontSize: 16 }}>{done ? '✓' : s.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3, color: active ? c.primary : done ? '#1A7A1A' : c.textSecondary }}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — PERSONAL INFO + DUPLICATE CHECK
// ─────────────────────────────────────────────────────────────────────────────
function Step1({ data, set, errors, c, dupName, dupPhone, dupChecking }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionDivider title="Personal Information" />
      <div>
        <Input
          label="Full Name"
          placeholder="e.g. Rahul Mehta"
          value={data.name}
          onChange={(e) => set('name', e.target.value)}
          autoFocus
        />
        {dupChecking && data.name.length >= 3 && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: c.textSecondary }}>Checking for existing records…</p>
        )}
        {dupName && dupName.length > 0 && (
          <DupWarning matches={dupName} label="name" />
        )}
      </div>
      <div>
        <Input
          label="Primary Phone"
          type="tel"
          placeholder="e.g. 98765 43210"
          value={data.phone}
          onChange={(e) => set('phone', e.target.value)}
          inputMode="tel"
        />
        {dupPhone && dupPhone.length > 0 && (
          <DupWarning matches={dupPhone} label="phone number" />
        )}
      </div>
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

function DupWarning({ matches, label }) {
  return (
    <div style={{ marginTop: 6, padding: '8px 12px', background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 8, fontSize: 12, color: '#7A5200' }}>
      ⚠ A customer with this {label} may already exist:
      {matches.map((m) => (
        <div key={m.id} style={{ marginTop: 4, fontWeight: 600 }}>
          {m.name} — {m.phone}
        </div>
      ))}
      <div style={{ marginTop: 4, opacity: 0.8 }}>You can still proceed — this is a warning, not a block.</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — VEHICLE MANAGEMENT (multiple vehicles supported)
// ─────────────────────────────────────────────────────────────────────────────
function Step2({ data, setVehicle, addVehicle, removeVehicle, errors, c, carRepo, carRepoLoading, opts }) {
  // Track which vehicle's form is open for editing in the list
  const [editVIdx, setEditVIdx] = useState(0);

  const activeV = data.vehicles[editVIdx] || data.vehicles[0];
  const activeIdx = Math.min(editVIdx, data.vehicles.length - 1);

  // Company names from Car Repo
  const companyNames = carRepo.map((co) => co.name);
  // Models for selected company
  const selectedCompany = carRepo.find((co) => co.name === activeV.vehicleCompany);
  const modelNames = selectedCompany ? (selectedCompany.models || []).map((m) => m.name) : [];

  const setV = (field, value) => setVehicle(activeIdx, field, value);

  const handleCompanyChange = (company) => {
    setV('vehicleCompany', company);
    setV('vehicleModel', '');   // reset model when company changes
    setV('isManualVehicle', false);
  };

  const handleNotInList = () => {
    setV('isManualVehicle', true);
    setV('vehicleCompany', '');
    setV('vehicleModel', '');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SectionDivider title={`Vehicle ${activeIdx + 1} Information`} />

      {/* Vehicle Registration Number */}
      <div style={{ marginBottom: 16 }}>
        <Input
          label="Vehicle Registration Number"
          placeholder="e.g. GJ01AB1234"
          value={activeV.vehicleNo}
          onChange={(e) => setV('vehicleNo', e.target.value.toUpperCase())}
          style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1 }}
          autoFocus
        />
      </div>

      {/* Vehicle Company from Car Repo */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Vehicle Make / Company
          </label>
          {!activeV.isManualVehicle && (
            <button type="button" onClick={handleNotInList} style={{ background: 'none', border: 'none', fontSize: 11, color: c.primary, cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              + Not in list (manual)
            </button>
          )}
          {activeV.isManualVehicle && (
            <button type="button" onClick={() => { setV('isManualVehicle', false); setV('notInListCompany', ''); setV('notInListModel', ''); }} style={{ background: 'none', border: 'none', fontSize: 11, color: c.primary, cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              ← Use Car Repository
            </button>
          )}
        </div>
        {activeV.isManualVehicle ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '8px 12px', background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 8, fontSize: 12, color: '#7A5200' }}>
              ⚠ Car not in repository — SuperAdmin will be notified to add it.
            </div>
            <input
              type="text"
              placeholder="Company / Make (e.g. Kia)"
              value={activeV.notInListCompany}
              onChange={(e) => setV('notInListCompany', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${c.border}`, borderRadius: RADIUS.md, fontSize: 14, background: c.cardBg, color: c.textPrimary, outline: 'none', boxSizing: 'border-box' }}
            />
            <input
              type="text"
              placeholder="Model (e.g. Sonet)"
              value={activeV.notInListModel}
              onChange={(e) => setV('notInListModel', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${c.border}`, borderRadius: RADIUS.md, fontSize: 14, background: c.cardBg, color: c.textPrimary, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {carRepoLoading ? (
              <div style={{ padding: '10px 12px', color: c.textSecondary, fontSize: 13 }}>Loading car repository…</div>
            ) : (
              <select
                value={activeV.vehicleCompany}
                onChange={(e) => handleCompanyChange(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${c.border}`, borderRadius: RADIUS.md, fontSize: 14, background: c.cardBg, color: activeV.vehicleCompany ? c.textPrimary : c.textSecondary, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <option value="">{carRepo.length === 0 ? 'No companies in repository yet' : '— Select company —'}</option>
                {companyNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
            {activeV.vehicleCompany && (
              <select
                value={activeV.vehicleModel}
                onChange={(e) => setV('vehicleModel', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${c.border}`, borderRadius: RADIUS.md, fontSize: 14, background: c.cardBg, color: activeV.vehicleModel ? c.textPrimary : c.textSecondary, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <option value="">{modelNames.length === 0 ? 'No models in repository' : '— Select model —'}</option>
                {modelNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Year + Emission */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Vehicle Year</label>
          <input
            type="number"
            placeholder="e.g. 2021"
            value={activeV.vehicleYear}
            onChange={(e) => setV('vehicleYear', e.target.value)}
            min="1990" max={new Date().getFullYear() + 1}
            style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${c.border}`, borderRadius: RADIUS.md, fontSize: 14, background: c.cardBg, color: c.textPrimary, outline: 'none', boxSizing: 'border-box', fontFamily: 'JetBrains Mono, monospace' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
            Emission Category
          </label>
          <select
            value={activeV.emissionCategory}
            onChange={(e) => setV('emissionCategory', e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${c.border}`, borderRadius: RADIUS.md, fontSize: 14, background: c.cardBg, color: activeV.emissionCategory ? c.textPrimary : c.textSecondary, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
          >
            <option value="">Select…</option>
            {(opts.emissionCategories || ['BS3', 'BS4', 'BS6', 'BS6 Phase 2']).map((ec) => (
              <option key={ec} value={ec}>{ec}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Multi-vehicle management */}
      {data.vehicles.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Vehicles Added
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.vehicles.map((v, idx) => (
              <div key={v._vid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: idx === activeIdx ? `${c.primary}15` : c.elevatedBg, border: `1.5px solid ${idx === activeIdx ? c.primary : c.border}`, borderRadius: RADIUS.md, cursor: 'pointer' }} onClick={() => setEditVIdx(idx)}>
                <span style={{ fontSize: 20 }}>🚗</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: idx === activeIdx ? c.primary : c.textPrimary }}>
                  {vehicleLabel(v, idx)}
                </span>
                {idx === activeIdx && <span style={{ fontSize: 10, background: c.primary, color: '#FFF', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>EDITING</span>}
                {data.vehicles.length > 1 && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeVehicle(idx); }} style={{ background: 'none', border: 'none', color: '#CC0000', cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 4, lineHeight: 1 }}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Another Vehicle */}
      <button
        type="button"
        onClick={addVehicle}
        style={{ width: '100%', padding: '12px 0', background: 'none', border: `2px dashed ${c.border}`, borderRadius: RADIUS.md, color: c.primary, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'border-color 0.15s' }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.primary)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = c.border)}
      >
        + Add Another Vehicle
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — CNG KIT (per vehicle)
// ─────────────────────────────────────────────────────────────────────────────
function Step3({ data, setVehicle, c, opts, activeVIdx, setActiveVIdx }) {
  const v = data.vehicles[activeVIdx] || data.vehicles[0];
  const idx = Math.min(activeVIdx, data.vehicles.length - 1);

  const setV = (field, value) => setVehicle(idx, field, value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Vehicle selector tabs (if multiple vehicles) */}
      {data.vehicles.length > 1 && (
        <VehicleTabs vehicles={data.vehicles} activeIdx={idx} setActiveIdx={setActiveVIdx} c={c} />
      )}

      <SectionDivider title="CNG Kit Details" />

      {/* Emission Category badge — auto from Step 2 */}
      {v.emissionCategory && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: c.textSecondary }}>Emission category:</span>
          <span style={{ fontSize: 13, fontWeight: 700, background: c.primary, color: '#FFF', padding: '3px 10px', borderRadius: RADIUS.full }}>
            {v.emissionCategory}
          </span>
        </div>
      )}

      {/* CNG Kit */}
      <DropdownOrManual
        label="CNG Kit"
        placeholder="Select CNG Kit…"
        options={opts.cngKits || []}
        value={v.cngKit}
        isManual={v.cngKitIsManual}
        onValueChange={(val) => setV('cngKit', val)}
        onIsManualChange={(manual) => { setV('cngKitIsManual', manual); setV('cngKit', ''); }}
        c={c}
      />

      {/* CKP Advancer */}
      <DropdownOrManual
        label="CKP Advancer"
        placeholder="Select CKP Advancer…"
        options={opts.ckpAdvancers || []}
        value={v.ckpAdvancer}
        isManual={v.ckpAdvancerIsManual}
        onValueChange={(val) => setV('ckpAdvancer', val)}
        onIsManualChange={(manual) => { setV('ckpAdvancerIsManual', manual); setV('ckpAdvancer', ''); }}
        c={c}
      />

      {/* Extras */}
      <DropdownOrManual
        label="Extras"
        placeholder="Select extras…"
        options={opts.extraItems || []}
        value={v.extras}
        isManual={v.extrasIsManual}
        onValueChange={(val) => setV('extras', val)}
        onIsManualChange={(manual) => { setV('extrasIsManual', manual); setV('extras', ''); }}
        c={c}
      />

      {/* Cylinder */}
      <DropdownOrManual
        label="Cylinder"
        placeholder="Select cylinder…"
        options={opts.cylinders || []}
        value={v.cylinder}
        isManual={v.cylinderIsManual}
        onValueChange={(val) => setV('cylinder', val)}
        onIsManualChange={(manual) => { setV('cylinderIsManual', manual); setV('cylinder', ''); }}
        c={c}
      />

      {(opts.cngKits || []).length === 0 && (opts.ckpAdvancers || []).length === 0 && (
        <div style={{ marginTop: 8, padding: '10px 14px', background: '#E3F2FD', border: '1px solid #B3CCF0', borderRadius: RADIUS.md, fontSize: 12, color: '#1A4A8A' }}>
          ℹ No options configured yet. Go to <strong>Settings → Dropdown Values</strong> to add CNG Kits, CKP Advancers, Extras, and Cylinders, or use the "Enter manually" option for each field.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — INSTALLATION INFO (per vehicle)
// ─────────────────────────────────────────────────────────────────────────────
function Step4({ data, setVehicle, c, opts, activeVIdx, setActiveVIdx }) {
  const v = data.vehicles[activeVIdx] || data.vehicles[0];
  const idx = Math.min(activeVIdx, data.vehicles.length - 1);
  const setV = (field, value) => setVehicle(idx, field, value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {data.vehicles.length > 1 && (
        <VehicleTabs vehicles={data.vehicles} activeIdx={idx} setActiveIdx={setActiveVIdx} c={c} />
      )}
      <SectionDivider title="Installation Details" />
      <Input
        label="Installation Date"
        type="date"
        value={v.installationDate}
        onChange={(e) => setV('installationDate', e.target.value)}
        hint="Used to calculate CNG re-testing reminders."
      />
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Technician Name</label>
        <select
          value={v.technicianName}
          onChange={(e) => setV('technicianName', e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${c.border}`, borderRadius: RADIUS.md, fontSize: 14, background: c.cardBg, color: v.technicianName ? c.textPrimary : c.textSecondary, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          <option value="">Select technician…</option>
          {(opts.technicians || []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <Textarea
        label="Notes (internal)"
        placeholder="Any additional notes about this installation…"
        value={v.notes}
        onChange={(e) => setV('notes', e.target.value)}
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
            <Select key={field.id} label={field.label} placeholder="Select…" value={val}
              onChange={(e) => setCustomField(field.id, e.target.value)}
              options={field.options || []}
            />
          );
        }
        return (
          <Input key={field.id} label={field.label}
            type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
            value={val} onChange={(e) => setCustomField(field.id, e.target.value)}
          />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE TABS (used in Step 3 and Step 4 when multiple vehicles)
// ─────────────────────────────────────────────────────────────────────────────
function VehicleTabs({ vehicles, activeIdx, setActiveIdx, c }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, marginBottom: 8 }}>
      {vehicles.map((v, idx) => (
        <button
          key={v._vid}
          type="button"
          onClick={() => setActiveIdx(idx)}
          style={{
            padding: '6px 14px', borderRadius: RADIUS.full, fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${idx === activeIdx ? c.primary : c.border}`,
            background: idx === activeIdx ? c.primary : c.cardBg,
            color: idx === activeIdx ? '#FFF' : c.textSecondary,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          🚗 {vehicleLabel(v, idx)}
        </button>
      ))}
    </div>
  );
}