/**
 * MarkRetestedModal.jsx
 * Modal that appears when the Owner taps "Mark as Re-tested".
 *
 * Can be opened from:
 *   A) ReminderLog screen — reminder entry row
 *   B) CustomerDetail screen — reminder timeline card
 *
 * On save:
 *   - Writes new retestDate to /customers/{id}.retestDates[]
 *   - Recalculates nextReminderDate (retestDate + 33 months)
 *   - Marks all pending reminderLog entries for this customer as 'completed'
 *   - Emits onSuccess({ updatedRetestDates, nextReminderDate }) to parent
 *
 * Props:
 *   isOpen        boolean
 *   onClose       () => void
 *   customer      { id, name, vehicleNo, installationDate, retestDates[] }
 *   onSuccess     (result) => void
 */

import { useState } from 'react';
import useTheme    from '../../hooks/useTheme';
import useAuth     from '../../hooks/useAuth';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../../lib/tokens';
import { Modal, Button, Input, Textarea, Badge } from '../../components/ui/ui';
import { addMonths, fmtDate, getReferenceDate, calcMilestones }
  from '../../lib/reminderService';
import useReminderStore from '../../store/reminderStore';

// ── Icons ─────────────────────────────────────────────────────────────────────
const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.1 9 11.1"/>
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8"  y1="2" x2="8"  y2="6"/>
    <line x1="3"  y1="10" x2="21" y2="10"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8"  x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

// ── Main Component ────────────────────────────────────────────────────────────

export default function MarkRetestedModal({ isOpen, onClose, customer, onSuccess }) {
  const { isDark }      = useTheme();
  const { uid, displayName } = useAuth();
  const c               = isDark ? COLORS.dark : COLORS.light;

  const markRetested     = useReminderStore((s) => s.markRetested);
  const isLoading        = useReminderStore((s) => s.isMarkingRetested);
  const markRetestError  = useReminderStore((s) => s.markRetestError);

  const today = new Date().toISOString().slice(0, 10);

  const [retestDate, setRetestDate] = useState(today);
  const [notes,      setNotes]      = useState('');
  const [dateError,  setDateError]  = useState('');
  const [submitted,  setSubmitted]  = useState(false);

  if (!customer) return null;

  // ── Derived data ────────────────────────────────────────────────────────────
  const refDate   = getReferenceDate(customer.installationDate, customer.retestDates);
  const milestones = refDate ? calcMilestones(refDate) : null;

  // New milestones preview (based on what the owner is about to enter)
  const newMilestones = retestDate ? calcMilestones(retestDate) : null;

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate() {
    if (!retestDate) {
      setDateError('Re-test date is required');
      return false;
    }
    if (retestDate > today) {
      setDateError('Re-test date cannot be in the future');
      return false;
    }
    if (customer.installationDate && retestDate < customer.installationDate) {
      setDateError('Re-test date cannot be before the installation date');
      return false;
    }
    setDateError('');
    return true;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validate()) return;

    try {
      const result = await markRetested({
        customerId:          customer.id,
        retestDate,
        notes,
        uid,
        displayName,
        currentRetestDates:  customer.retestDates || [],
        installationDate:    customer.installationDate,
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setRetestDate(today);
        setNotes('');
        if (onSuccess) onSuccess(result);
        onClose();
      }, 1800);

    } catch (_) {
      // Error is in markRetestError from store
    }
  }

  function handleClose() {
    if (isLoading) return;
    setRetestDate(today);
    setNotes('');
    setDateError('');
    setSubmitted(false);
    onClose();
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const label = {
    display:    'block',
    fontFamily: FONTS.body,
    fontSize:   12,
    fontWeight: 500,
    color:      c.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  };

  const infoRow = {
    display:       'flex',
    justifyContent: 'space-between',
    alignItems:    'center',
    padding:       '8px 0',
    borderBottom:  `1px solid ${c.border}`,
    fontFamily:    FONTS.body,
  };

  const previewBox = {
    background:   isDark ? 'rgba(102,31,31,0.15)' : '#FFF5F5',
    border:       `1px solid ${isDark ? '#8B3A3A' : '#F0B8B8'}`,
    borderRadius: RADIUS.md,
    padding:      '12px 14px',
    marginTop:    16,
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Mark as Re-tested">
      {submitted ? (

        /* ── Success State ─────────────────────────────────────────────────── */
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: c.statusGreenBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            color: c.statusGreenText,
          }}>
            <CheckCircleIcon />
          </div>
          <p style={{ fontFamily: FONTS.body, fontSize: 16, fontWeight: 600, color: c.textPrimary, margin: '0 0 6px' }}>
            Re-test Recorded!
          </p>
          <p style={{ fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary, margin: 0 }}>
            Next reminder cycle starts from {fmtDate(retestDate)}.
          </p>
        </div>

      ) : (
        <>
          {/* ── Customer Info Strip ─────────────────────────────────────────── */}
          <div style={{
            background:   c.elevatedBg,
            borderRadius: RADIUS.md,
            padding:      '12px 14px',
            marginBottom: 20,
          }}>
            <p style={{ fontFamily: FONTS.body, fontSize: 15, fontWeight: 600, color: c.textPrimary, margin: '0 0 4px' }}>
              {customer.name}
            </p>
            <p style={{ fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary, margin: 0 }}>
              {[customer.vehicleCompany, customer.vehicleModel].filter(Boolean).join(' ')}
              {customer.vehicleNo ? ` · ${customer.vehicleNo}` : ''}
            </p>
          </div>

          {/* ── Current Cycle Info ──────────────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={infoRow}>
              <span style={{ fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary }}>
                Installation Date
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: c.textPrimary }}>
                {fmtDate(customer.installationDate)}
              </span>
            </div>
            {refDate !== customer.installationDate && (
              <div style={infoRow}>
                <span style={{ fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary }}>
                  Last Re-test Date
                </span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: c.textPrimary }}>
                  {fmtDate(refDate)}
                </span>
              </div>
            )}
            {milestones && (
              <div style={{ ...infoRow, borderBottom: 'none' }}>
                <span style={{ fontFamily: FONTS.body, fontSize: 13, color: c.textSecondary }}>
                  Current Deadline
                </span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: c.statusRedText }}>
                  {fmtDate(milestones.actualDeadline)}
                </span>
              </div>
            )}
          </div>

          {/* ── Re-test Date Input ──────────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <label style={label}>
              <span style={{ color: c.statusRedText }}>* </span>
              Date of Re-testing
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                value={retestDate}
                max={today}
                min={customer.installationDate || '2000-01-01'}
                onChange={(e) => { setRetestDate(e.target.value); setDateError(''); }}
                style={{
                  width:        '100%',
                  boxSizing:    'border-box',
                  padding:      '10px 14px 10px 40px',
                  fontFamily:   FONTS.mono,
                  fontSize:     14,
                  color:        c.textPrimary,
                  background:   c.cardBg,
                  border:       `1.5px solid ${dateError ? c.statusRedText : c.border}`,
                  borderRadius: RADIUS.md,
                  outline:      'none',
                  cursor:       'pointer',
                }}
              />
              <span style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: c.textSecondary,
                pointerEvents: 'none',
              }}>
                <CalendarIcon />
              </span>
            </div>
            {dateError && (
              <p style={{ fontFamily: FONTS.body, fontSize: 12, color: c.statusRedText, margin: '4px 0 0' }}>
                {dateError}
              </p>
            )}
          </div>

          {/* ── Notes Input ─────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Notes (Optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Tested at RTO Rajkot, Certificate valid until..."
              rows={3}
            />
          </div>

          {/* ── New Cycle Preview ───────────────────────────────────────────── */}
          {newMilestones && retestDate && (
            <div style={previewBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <InfoIcon color={c.primary} />
                <span style={{ fontFamily: FONTS.body, fontSize: 12, fontWeight: 600, color: c.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  New Reminder Cycle Preview
                </span>
              </div>
              {[
                { label: '3-month warning',    date: newMilestones.warning_3m },
                { label: '2-month warning',    date: newMilestones.warning_2m },
                { label: '1-month warning',    date: newMilestones.warning_1m },
                { label: 'Final deadline',     date: newMilestones.final },
              ].map(({ label: lbl, date }) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: FONTS.body }}>
                  <span style={{ fontSize: 12, color: c.textSecondary }}>{lbl}</span>
                  <span style={{ fontSize: 12, fontFamily: FONTS.mono, color: c.textPrimary, fontWeight: 500 }}>
                    {fmtDate(date)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Error ───────────────────────────────────────────────────────── */}
          {markRetestError && (
            <div style={{
              background: c.statusRedBg, borderRadius: RADIUS.md,
              padding: '10px 14px', marginTop: 12,
              fontFamily: FONTS.body, fontSize: 13, color: c.statusRedText,
            }}>
              {markRetestError}
            </div>
          )}

          {/* ── Actions ─────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <Button variant="secondary" onClick={handleClose} disabled={isLoading} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={isLoading}
              icon={<CheckCircleIcon />}
              style={{ flex: 2 }}
            >
              Save Re-test Date
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
