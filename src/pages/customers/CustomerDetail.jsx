/**
 * CustomerDetail.jsx
 * Route: /customers/:id
 * Full customer profile page with:
 *   - Personal + vehicle + CNG info in organized card sections
 *   - Re-test date history table
 *   - Owner can add/edit re-test dates
 *   - Custom fields section (if any)
 *   - Edit button (Owner/Employee)
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useCustomerStore from '../../store/customerStore';
import useAuth from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../../lib/tokens';
import { addRetestDate, updateRetestDates } from '../../lib/customerService';
import { logAudit, AUDIT_ACTIONS } from '../../lib/auditService';
import {
  Button, Badge, Card, Modal, Input, Textarea, SectionDivider, Spinner, EmptyState,
} from '../../components/ui/ui';

// ── Icons ──────────────────────────────────────────────────────────────────
const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);
const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
);
const AddIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
);
const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);

// ── Formatters ──────────────────────────────────────────────────────────────
const fmt = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const addMonths = (dateStr, months) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d;
};

const nextRetestDate = (retestDates = [], installDate) => {
  if (retestDates.length > 0) {
    const sorted = [...retestDates].sort((a, b) => new Date(b.retestDate) - new Date(a.retestDate));
    return addMonths(sorted[0].retestDate, 33);
  }
  return addMonths(installDate, 33);
};

const retestStatusInfo = (next) => {
  if (!next) return null;
  const now = new Date();
  const diff = Math.round((next - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { variant: 'danger', label: `Overdue by ${Math.abs(diff)} days` };
  if (diff < 30) return { variant: 'warning', label: `Due in ${diff} days` };
  if (diff < 90) return { variant: 'info', label: `Due in ${Math.round(diff / 30)} months` };
  return { variant: 'success', label: `Due ${fmt(next)}` };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const c = isDark ? COLORS.dark : COLORS.light;
  const { uid, displayName, isOwnerOrAbove, isEmployee } = useAuth();

  const { activeCustomer, isLoadingCustomer, customerError, loadCustomer, customFields, loadSettings, refreshActiveCustomer } = useCustomerStore();

  const [showRetestModal, setShowRetestModal] = useState(false);
  const [editingRetest, setEditingRetest] = useState(null); // index of entry being edited

  useEffect(() => {
    loadCustomer(id);
    loadSettings();
  }, [id]);

  const customer = activeCustomer;
  const retestDates = customer?.retestDates || [];
  const nextRetest = nextRetestDate(retestDates, customer?.installationDate);
  const retestStatus = retestStatusInfo(nextRetest);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoadingCustomer) {
    return (
      <div style={{ background: c.appBg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={40} />
      </div>
    );
  }

  if (customerError || !customer) {
    return (
      <div style={{ background: c.appBg, minHeight: '100vh', padding: 24 }}>
        <EmptyState icon="⚠️" title="Customer not found" description={customerError || 'This record may have been deleted.'} action={<Button onClick={() => navigate('/customers')}>Back to Customers</Button>} />
      </div>
    );
  }

  return (
    <div style={{ background: c.appBg, minHeight: '100vh', fontFamily: FONTS.body }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: c.cardBg, borderBottom: `1px solid ${c.border}`, padding: '16px 16px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate('/customers')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.primary, display: 'flex', alignItems: 'center' }}>
              <BackIcon />
            </button>
            <div>
              <h1 style={{ margin: 0, fontFamily: FONTS.heading, fontSize: 20, color: c.textPrimary, lineHeight: 1.2 }}>{customer.name}</h1>
              <p style={{ margin: 0, fontSize: 12, color: c.textSecondary }}>{customer.phone}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={<EditIcon />} onClick={() => navigate(`/customers/${id}/edit`)}>
            Edit
          </Button>
        </div>
      </div>

      <div style={{ padding: '16px 16px 100px', maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Re-test Alert Banner ──────────────────────────────────────── */}
        {retestStatus && (
          <div style={{
            padding: '12px 16px',
            background: retestStatus.variant === 'danger' ? c.statusRedBg : retestStatus.variant === 'warning' ? c.statusAmberBg : c.statusGreenBg,
            borderRadius: RADIUS.md,
            borderLeft: `4px solid ${retestStatus.variant === 'danger' ? c.statusRedText : retestStatus.variant === 'warning' ? c.statusAmberText : c.statusGreenText}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: retestStatus.variant === 'danger' ? c.statusRedText : retestStatus.variant === 'warning' ? c.statusAmberText : c.statusGreenText }}>
                🔔 CNG Re-Test: {retestStatus.label}
              </div>
              {nextRetest && (
                <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>
                  Next reminder: {fmt(nextRetest)}
                </div>
              )}
            </div>
            {isOwnerOrAbove && (
              <Button size="sm" variant="secondary" onClick={() => { setEditingRetest(null); setShowRetestModal(true); }}>
                + Add Date
              </Button>
            )}
          </div>
        )}

        {/* ── Personal Info ─────────────────────────────────────────────── */}
        <InfoCard title="Personal Information" c={c}>
          <InfoGrid>
            <InfoRow label="Full Name" value={customer.name} c={c} />
            <InfoRow label="Primary Phone" value={customer.phone} mono c={c} />
            {customer.altPhone && <InfoRow label="Alt. Phone" value={customer.altPhone} mono c={c} />}
          </InfoGrid>
        </InfoCard>

        {/* ── Vehicle Info ──────────────────────────────────────────────── */}
        <InfoCard title="Vehicle Details" c={c}>
          <InfoGrid>
            <InfoRow label="Registration No." value={customer.vehicleNo} mono c={c} highlight />
            <InfoRow label="Make / Company" value={customer.vehicleMake} c={c} />
            <InfoRow label="Model" value={customer.vehicleModel} c={c} />
            <InfoRow label="Year" value={customer.vehicleYear} c={c} />
            <InfoRow
              label="Emission Category"
              value={customer.emissionCategory}
              c={c}
              badge={{ variant: 'info', text: customer.emissionCategory }}
            />
          </InfoGrid>
        </InfoCard>

        {/* ── CNG Kit Info ──────────────────────────────────────────────── */}
        <InfoCard title="CNG Kit Details" c={c}>
          <InfoGrid>
            <InfoRow label="Kit Brand" value={customer.cngKitBrand} c={c} />
            <InfoRow label="Kit Model" value={customer.cngKitModel} c={c} />
            <InfoRow label="Tank Capacity" value={customer.tankCapacity ? `${customer.tankCapacity} Litres` : null} c={c} />
          </InfoGrid>
          {customer.advancers?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span style={{ fontSize: 12, color: c.textSecondary, display: 'block', marginBottom: 6 }}>Advancers</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {customer.advancers.map((a) => <Badge key={a} variant="info">{a}</Badge>)}
              </div>
            </div>
          )}
          {customer.addOns?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span style={{ fontSize: 12, color: c.textSecondary, display: 'block', marginBottom: 6 }}>Add-Ons</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {customer.addOns.map((a) => <Badge key={a} variant="warning">{a}</Badge>)}
              </div>
            </div>
          )}
        </InfoCard>

        {/* ── Installation Info ─────────────────────────────────────────── */}
        <InfoCard title="Installation Details" c={c}>
          <InfoGrid>
            <InfoRow label="Installation Date" value={fmt(customer.installationDate)} c={c} />
            <InfoRow label="Technician" value={customer.technicianName} c={c} />
          </InfoGrid>
          {customer.notes && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: c.elevatedBg, borderRadius: RADIUS.md }}>
              <span style={{ fontSize: 11, color: c.textSecondary, display: 'block', marginBottom: 4 }}>Notes</span>
              <p style={{ margin: 0, fontSize: 13, color: c.textPrimary, lineHeight: 1.5 }}>{customer.notes}</p>
            </div>
          )}
        </InfoCard>

        {/* ── Custom Fields ─────────────────────────────────────────────── */}
        {customFields.length > 0 && Object.keys(customer.customFields || {}).length > 0 && (
          <InfoCard title="Additional Information" c={c}>
            <InfoGrid>
              {customFields.map((field) => (
                customer.customFields?.[field.id] !== undefined && (
                  <InfoRow key={field.id} label={field.label} value={customer.customFields[field.id]} c={c} />
                )
              ))}
            </InfoGrid>
          </InfoCard>
        )}

        {/* ── Re-Test Date History ──────────────────────────────────────── */}
        <RetestHistory
          retestDates={retestDates}
          installationDate={customer.installationDate}
          isOwnerOrAbove={isOwnerOrAbove}
          c={c}
          onAddDate={() => { setEditingRetest(null); setShowRetestModal(true); }}
          onEditDate={(idx) => { setEditingRetest(idx); setShowRetestModal(true); }}
        />

      </div>

      {/* ── Re-Test Date Modal ────────────────────────────────────────────── */}
      <RetestModal
        open={showRetestModal}
        onClose={() => { setShowRetestModal(false); setEditingRetest(null); }}
        editingEntry={editingRetest !== null ? retestDates[editingRetest] : null}
        onSave={async (entry) => {
          try {
            if (editingRetest !== null) {
              // Replace that entry
              const updated = retestDates.map((r, i) => i === editingRetest ? { ...r, ...entry } : r);
              await updateRetestDates(id, updated);
              await logAudit({ action: AUDIT_ACTIONS.RETEST_DATE_UPDATED, userId: uid, userName: displayName, targetId: id, targetCollection: 'customers', metadata: entry });
            } else {
              await addRetestDate(id, { ...entry, recordedBy: uid });
              await logAudit({ action: AUDIT_ACTIONS.RETEST_DATE_ADDED, userId: uid, userName: displayName, targetId: id, targetCollection: 'customers', metadata: entry });
            }
            await refreshActiveCustomer();
            setShowRetestModal(false);
            setEditingRetest(null);
          } catch (err) {
            alert('Failed to save: ' + err.message);
          }
        }}
        c={c}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RE-TEST HISTORY SECTION
// ─────────────────────────────────────────────────────────────────────────────
function RetestHistory({ retestDates, installationDate, isOwnerOrAbove, c, onAddDate, onEditDate }) {
  const sorted = [...retestDates].sort((a, b) => new Date(b.retestDate) - new Date(a.retestDate));

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${c.border}` }}>
        <div>
          <h3 style={{ margin: 0, fontFamily: FONTS.heading, fontSize: 16, color: c.textPrimary }}>CNG Re-Test History</h3>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: c.textSecondary }}>
            Reminder cycle: every 2 years 9 months · Cylinder lifetime: ~15 years
          </p>
        </div>
        {isOwnerOrAbove && (
          <Button size="sm" icon={<AddIcon />} onClick={onAddDate}>Add Date</Button>
        )}
      </div>

      {/* Timeline */}
      {sorted.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
          <p style={{ margin: 0, color: c.textSecondary, fontSize: 13 }}>
            No re-test dates recorded yet.{' '}
            {installationDate && `First reminder due: ${fmt(nextRetestFromInstall(installationDate))}`}
          </p>
        </div>
      ) : (
        <div style={{ padding: '8px 0' }}>
          {sorted.map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: i < sorted.length - 1 ? `1px solid ${c.border}` : 'none', alignItems: 'flex-start' }}>
              {/* Timeline dot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2, flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? c.primary : c.textSecondary }} />
                {i < sorted.length - 1 && <div style={{ width: 1, height: 24, background: c.border, marginTop: 2 }} />}
              </div>
              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, fontFamily: FONTS.mono }}>
                      {fmt(entry.retestDate)}
                    </div>
                    <div style={{ fontSize: 11, color: c.textSecondary, marginTop: 2 }}>
                      Recorded {fmt(entry.recordedAt)} · Cycle {sorted.length - i}
                    </div>
                  </div>
                  {isOwnerOrAbove && i === 0 && (
                    <button
                      onClick={() => onEditDate(retestDates.indexOf(sorted[i]))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textSecondary, fontSize: 12, padding: '2px 6px' }}
                    >
                      Edit
                    </button>
                  )}
                </div>
                {entry.notes && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: c.textSecondary, lineHeight: 1.4 }}>{entry.notes}</p>
                )}
                {/* Next reminder from this date */}
                {i === 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: c.statusAmberText, fontWeight: 600 }}>
                    → Next reminder due: {fmt(addMonthsStr(entry.retestDate, 33))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function nextRetestFromInstall(dateStr) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 33);
  return d;
}

function addMonthsStr(dateStr, months) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// RE-TEST MODAL
// ─────────────────────────────────────────────────────────────────────────────
function RetestModal({ open, onClose, editingEntry, onSave, c }) {
  const [retestDate, setRetestDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRetestDate(editingEntry?.retestDate || '');
      setNotes(editingEntry?.notes || '');
    }
  }, [open, editingEntry]);

  const handleSave = async () => {
    if (!retestDate) return;
    setSaving(true);
    await onSave({ retestDate, notes });
    setSaving(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingEntry ? 'Edit Re-Test Date' : 'Add Re-Test Date'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!retestDate}>
            {editingEntry ? 'Update' : 'Save Date'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input
          label="Re-Test Date"
          required
          type="date"
          value={retestDate}
          onChange={(e) => setRetestDate(e.target.value)}
          hint="The date when the cylinder was physically re-tested."
        />
        <Textarea
          label="Notes (optional)"
          placeholder="e.g. Re-tested at Bilimora RTO, passed."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function InfoCard({ title, children, c }) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', background: c.elevatedBg + '60', borderBottom: `1px solid ${c.border}` }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: c.primary, letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: FONTS.body }}>
          {title}
        </h3>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </Card>
  );
}

function InfoGrid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px 20px' }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, highlight, badge, c }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <div style={{ fontSize: 11, color: c.textSecondary, fontFamily: FONTS.body, marginBottom: 2 }}>{label}</div>
      {badge ? (
        <Badge variant={badge.variant}>{badge.text}</Badge>
      ) : (
        <div style={{
          fontSize: 14,
          color: highlight ? c.primary : c.textPrimary,
          fontFamily: mono || highlight ? FONTS.mono : FONTS.body,
          fontWeight: highlight ? 700 : 400,
          letterSpacing: mono ? 0.5 : 0,
        }}>
          {value}
        </div>
      )}
    </div>
  );
}
