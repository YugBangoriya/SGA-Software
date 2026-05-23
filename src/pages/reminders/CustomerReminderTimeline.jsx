/**
 * CustomerReminderTimeline.jsx
 * Phase 9 — Reminder history timeline embedded inside CustomerDetail (Phase 2).
 *
 * INTEGRATION: Import this component and add it near the bottom of your
 * existing CustomerDetail.jsx page, inside the customer's detail sections.
 *
 * Example (in CustomerDetail.jsx):
 *   import CustomerReminderTimeline from '../reminders/CustomerReminderTimeline';
 *   // then inside the JSX, after the CNG details section:
 *   <CustomerReminderTimeline customer={customer} />
 *
 * Props:
 *   customer   Object — full customer document from Firestore
 *              Required fields: id, installationDate, retestDates[], nextReminderDate,
 *                               nextReminderType, name, vehicleNo, vehicleCompany, vehicleModel
 *   onRetested (optional) — callback when owner records a new re-test date,
 *              receives the result from markCustomerRetested
 */

import { useEffect, useState }  from 'react';
import useTheme                 from '../../hooks/useTheme';
import useAuth                  from '../../hooks/useAuth';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../../lib/tokens';
import { Spinner }              from '../../components/ui/ui';
import {
  fmtDate,
  fmtDateTime,
  getReminderLabel,
  getReminderVariant,
  calcMilestones,
  getReferenceDate,
  addMonths,
} from '../../lib/reminderService';
import useReminderStore         from '../../store/reminderStore';
import MarkRetestedModal        from './MarkRetestedModal';

// ── Icons ─────────────────────────────────────────────────────────────────────
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.1 9 11.1"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <triangle points="10.29 3.86 1.82 18 22.18 18"><path d="M10.29 3.86L1.82 18h20.36z"/></triangle>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const CalendarCheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8"  y1="2" x2="8"  y2="6"/>
    <line x1="3"  y1="10" x2="21" y2="10"/>
    <polyline points="9 16 11 18 15 14"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBadgeColors(variant, c) {
  return {
    success: { bg: c.statusGreenBg,  text: c.statusGreenText  },
    info:    { bg: c.statusBlueBg,   text: c.statusBlueText   },
    warning: { bg: c.statusAmberBg,  text: c.statusAmberText  },
    danger:  { bg: c.statusRedBg,    text: c.statusRedText    },
    neutral: { bg: c.elevatedBg,     text: c.textSecondary    },
  }[variant] || { bg: c.elevatedBg, text: c.textSecondary };
}

// ── Next Reminder Countdown Card ──────────────────────────────────────────────
function NextReminderCard({ customer, c, isDark, onMarkRetested }) {
  const { isOwnerOrAbove } = useAuth();

  const refDate  = getReferenceDate(customer.installationDate, customer.retestDates);
  const next     = customer.nextReminderDate;
  const nextType = customer.nextReminderType;

  if (!customer.installationDate) return null;
  if (next === 'EXPIRED') {
    return (
      <div style={{
        background:   c.elevatedBg,
        borderRadius: RADIUS.md,
        padding:      '14px 16px',
        border:       `1px solid ${c.border}`,
        display:      'flex',
        alignItems:   'center',
        gap:          10,
        marginBottom: 16,
      }}>
        <span style={{ color: c.textSecondary, fontSize: 22 }}>🔒</span>
        <div>
          <p style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: c.textSecondary, margin: 0 }}>
            Cylinder Lifetime Expired
          </p>
          <p style={{ fontFamily: FONTS.body, fontSize: 12, color: c.textSecondary, margin: '2px 0 0' }}>
            15-year cylinder life reached. No further reminders will be sent.
          </p>
        </div>
      </div>
    );
  }

  if (!next || !nextType) {
    return (
      <div style={{
        background:   c.statusAmberBg,
        borderRadius: RADIUS.md,
        padding:      '12px 16px',
        border:       `1px solid ${c.statusAmberText}`,
        fontFamily:   FONTS.body,
        fontSize:     13,
        color:        c.statusAmberText,
        marginBottom: 16,
      }}>
        ⚠️ Next reminder date not yet calculated. It will be set automatically on the next daily scheduler run.
      </div>
    );
  }

  const today         = new Date().toISOString().slice(0, 10);
  const isPast        = next <= today;
  const isOverdue     = nextType === 'final' || nextType?.startsWith('overdue_');
  const milestones    = refDate ? calcMilestones(refDate) : null;
  const deadline      = milestones?.actualDeadline;

  // Days until next reminder
  const msUntil       = new Date(next) - new Date(today);
  const daysUntil     = Math.ceil(msUntil / (1000 * 60 * 60 * 24));

  const variant       = getReminderVariant(nextType);
  const colors        = getBadgeColors(variant, c);

  return (
    <div style={{
      background:   colors.bg,
      borderRadius: RADIUS.md,
      padding:      '14px 16px',
      border:       `1.5px solid ${colors.text}33`,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {isPast
              ? <span style={{ color: colors.text }}><AlertIcon /></span>
              : <span style={{ color: colors.text }}><ClockIcon /></span>
            }
            <span style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 700, color: colors.text }}>
              {isPast ? 'Reminder Due' : 'Next Reminder'}
            </span>
          </div>
          <p style={{ fontFamily: FONTS.body, fontSize: 13, color: colors.text, margin: '0 0 4px' }}>
            <strong>{getReminderLabel(nextType)}</strong>
            {' — '}
            {isPast
              ? `was scheduled for ${fmtDate(next)}`
              : daysUntil === 0
              ? 'sending today'
              : `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} (${fmtDate(next)})`
            }
          </p>
          {deadline && (
            <p style={{ fontFamily: FONTS.body, fontSize: 12, color: colors.text, margin: 0, opacity: 0.8 }}>
              Re-test deadline: {fmtDate(deadline)}
            </p>
          )}
        </div>

        {/* Mark Re-tested button — always visible on this card for owner */}
        {isOwnerOrAbove && (
          <button
            onClick={onMarkRetested}
            style={{
              background:   c.primary,
              color:        '#FFF',
              border:       'none',
              borderRadius: RADIUS.md,
              padding:      '8px 14px',
              fontSize:     12,
              fontWeight:   600,
              fontFamily:   FONTS.body,
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              whiteSpace:   'nowrap',
              minHeight:    36,
              flexShrink:   0,
            }}
          >
            <CheckCircleIcon />
            Mark as Re-tested
          </button>
        )}
      </div>
    </div>
  );
}

// ── Timeline Event ─────────────────────────────────────────────────────────────
function TimelineEvent({ event, c, isLast }) {
  const isDotGreen  = event.kind === 'retest';
  const isDotAmber  = event.kind === 'reminder' && event.status === 'pending';
  const isDotRed    = event.kind === 'reminder' && (event.reminderType === 'final' || event.reminderType?.startsWith('overdue_'));

  const dotColor = isDotGreen ? c.statusGreenText
                 : isDotRed   ? c.statusRedText
                 : isDotAmber ? c.statusAmberText
                 : c.primary;

  const dotBg    = isDotGreen ? c.statusGreenBg
                 : isDotRed   ? c.statusRedBg
                 : isDotAmber ? c.statusAmberBg
                 : isDark
                   ? 'rgba(102,31,31,0.25)'
                   : '#FFF0F0';

  return (
    <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
      {/* Dot + line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width:        32, height: 32,
          borderRadius: '50%',
          background:   dotBg,
          border:       `2px solid ${dotColor}`,
          display:      'flex', alignItems: 'center', justifyContent: 'center',
          color:        dotColor,
          flexShrink:   0,
          zIndex:       1,
        }}>
          {event.kind === 'retest'
            ? <CalendarCheckIcon />
            : event.kind === 'install'
            ? <span style={{ fontSize: 12 }}>🔧</span>
            : <BellIcon />
          }
        </div>
        {!isLast && (
          <div style={{ width: 2, flex: 1, background: `${c.border}`, minHeight: 20, margin: '4px 0' }} />
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        background:   c.cardBg,
        borderRadius: RADIUS.md,
        border:       `1px solid ${c.border}`,
        padding:      '10px 14px',
        marginBottom: isLast ? 0 : 10,
      }}>
        {event.kind === 'install' && (
          <>
            <p style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: c.textPrimary, margin: '0 0 2px' }}>
              CNG Kit Installed
            </p>
            <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: c.textSecondary, margin: 0 }}>
              {fmtDate(event.date)}
            </p>
          </>
        )}

        {event.kind === 'reminder' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
              <p style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: c.textPrimary, margin: 0 }}>
                WhatsApp Reminder Sent
              </p>
              <span style={{
                fontFamily: FONTS.body, fontSize: 10, fontWeight: 600,
                padding: '2px 8px', borderRadius: RADIUS.full,
                background: getBadgeColors(getReminderVariant(event.reminderType), c).bg,
                color:      getBadgeColors(getReminderVariant(event.reminderType), c).text,
              }}>
                {getReminderLabel(event.reminderType)}
              </span>
            </div>
            <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: c.textSecondary, margin: '0 0 2px' }}>
              Sent: {fmtDateTime(event.sentAt)}
            </p>
            {event.actualDueDate && (
              <p style={{ fontFamily: FONTS.body, fontSize: 12, color: c.textSecondary, margin: 0 }}>
                Deadline: {fmtDate(event.actualDueDate)}
              </p>
            )}
            {event.whatsappSuccess === false && (
              <p style={{ fontFamily: FONTS.body, fontSize: 12, color: c.statusRedText, margin: '4px 0 0', fontWeight: 600 }}>
                ⚠️ WhatsApp delivery failed
              </p>
            )}
            {event.status === 'completed' && event.retestDate && (
              <p style={{ fontFamily: FONTS.body, fontSize: 12, color: c.statusGreenText, margin: '4px 0 0', fontWeight: 600 }}>
                ✓ Re-tested on {fmtDate(event.retestDate)}
              </p>
            )}
          </>
        )}

        {event.kind === 'retest' && (
          <>
            <p style={{ fontFamily: FONTS.body, fontSize: 13, fontWeight: 600, color: c.statusGreenText, margin: '0 0 2px' }}>
              Re-test Recorded
            </p>
            <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: c.textSecondary, margin: 0 }}>
              {fmtDate(event.date)}
            </p>
            {event.notes && (
              <p style={{ fontFamily: FONTS.body, fontSize: 12, color: c.textSecondary, margin: '4px 0 0', fontStyle: 'italic' }}>
                {event.notes}
              </p>
            )}
            <p style={{ fontFamily: FONTS.body, fontSize: 11, color: c.textSecondary, margin: '4px 0 0' }}>
              Next reminder: {fmtDate(addMonths(event.date, 33))}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function CustomerReminderTimeline({ customer, onRetested }) {
  const { isDark }           = useTheme();
  const { isOwnerOrAbove }   = useAuth();
  const c                    = isDark ? COLORS.dark : COLORS.light;

  const loadCustomerReminders = useReminderStore((s) => s.loadCustomerReminders);
  const customerReminders     = useReminderStore((s) => s.customerReminders);
  const isLoadingMap          = useReminderStore((s) => s.isLoadingCustomerReminders);

  const [modalOpen, setModalOpen] = useState(false);

  const reminders  = customerReminders[customer?.id] || [];
  const isLoading  = isLoadingMap[customer?.id] || false;

  useEffect(() => {
    if (customer?.id) loadCustomerReminders(customer.id);
  }, [customer?.id, loadCustomerReminders]);

  if (!customer) return null;

  // ── Build timeline events: install + reminders + retests (chronological) ──
  const events = [];

  // Installation
  if (customer.installationDate) {
    events.push({ kind: 'install', date: customer.installationDate, ts: new Date(customer.installationDate).getTime() });
  }

  // Reminders from /reminderLog
  reminders.forEach((r) => {
    const ts = r.sentAt?.toDate ? r.sentAt.toDate().getTime() : new Date(r.sentAt || 0).getTime();
    events.push({ kind: 'reminder', ...r, ts });
  });

  // Re-test dates from customer record
  (customer.retestDates || []).forEach((rt) => {
    const ts = new Date(rt.retestDate || 0).getTime();
    events.push({ kind: 'retest', date: rt.retestDate, notes: rt.notes, recordedByName: rt.recordedByName, ts });
  });

  // Sort chronologically (oldest first — bottom of card is most recent)
  events.sort((a, b) => a.ts - b.ts);

  function handleRetestSuccess(result) {
    if (onRetested) onRetested(result);
    loadCustomerReminders(customer.id);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop: 24 }}>
      {/* Section header */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        justifyContent: 'space-between',
        marginBottom:  16,
        paddingBottom: 10,
        borderBottom:  `1px solid ${c.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: c.primary }}><BellIcon /></span>
          <h3 style={{ fontFamily: FONTS.heading, fontSize: 16, fontWeight: 600, color: c.textPrimary, margin: 0 }}>
            CNG Re-Testing History
          </h3>
        </div>
        {isOwnerOrAbove && (
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background:   c.primary,
              color:        '#FFF',
              border:       'none',
              borderRadius: RADIUS.md,
              padding:      '7px 14px',
              fontSize:     12,
              fontWeight:   600,
              fontFamily:   FONTS.body,
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              minHeight:    34,
            }}
          >
            <CheckCircleIcon />
            Mark as Re-tested
          </button>
        )}
      </div>

      {/* Next reminder card */}
      <NextReminderCard
        customer={customer}
        c={c}
        isDark={isDark}
        onMarkRetested={() => setModalOpen(true)}
      />

      {/* Timeline */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <Spinner size={28} color={c.primary} />
        </div>
      ) : events.length === 0 ? (
        <div style={{
          background:   c.elevatedBg,
          borderRadius: RADIUS.md,
          padding:      '20px',
          textAlign:    'center',
          fontFamily:   FONTS.body,
          fontSize:     13,
          color:        c.textSecondary,
        }}>
          No reminder history yet. The first reminder will be sent automatically at 2 years 9 months from the installation date.
        </div>
      ) : (
        <div style={{ paddingLeft: 4 }}>
          {events.map((ev, i) => (
            <TimelineEvent
              key={`${ev.kind}-${ev.ts}-${i}`}
              event={ev}
              c={c}
              isDark={isDark}
              isLast={i === events.length - 1}
            />
          ))}
        </div>
      )}

      {/* Full lifecycle preview (install date known) */}
      {customer.installationDate && (
        <LifecyclePreview customer={customer} c={c} />
      )}

      {/* Modal */}
      <MarkRetestedModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        customer={customer}
        onSuccess={handleRetestSuccess}
      />
    </div>
  );
}

// ── Full 15-year Lifecycle Preview ─────────────────────────────────────────────
function LifecyclePreview({ customer, c }) {
  const [expanded, setExpanded] = useState(false);

  const installDate = customer.installationDate;
  const retestDates = customer.retestDates || [];
  const today       = new Date().toISOString().slice(0, 10);

  // Build the 5-cycle projection from installation date (ignoring re-tests for this view)
  const cycles = [];
  let refDate  = installDate;
  for (let i = 0; i < 5; i++) {
    const deadline = addMonths(refDate, 36);
    // Check if this cycle has a corresponding re-test recorded
    const matchingRetest = retestDates[i];
    cycles.push({
      cycle:    i + 1,
      deadline,
      isDone:   matchingRetest ? true : deadline < today,
      retestDate: matchingRetest?.retestDate || null,
    });
    refDate = matchingRetest?.retestDate || deadline;
  }

  return (
    <div style={{ marginTop: 20 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: FONTS.body, fontSize: 12, color: c.textSecondary,
          padding: '4px 0', marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>{expanded ? '▾' : '▸'}</span>
        15-Year Cylinder Lifecycle Projection
      </button>

      {expanded && (
        <div style={{
          background:   c.elevatedBg,
          borderRadius: RADIUS.md,
          padding:      '14px 16px',
          border:       `1px solid ${c.border}`,
        }}>
          <p style={{ fontFamily: FONTS.body, fontSize: 11, color: c.textSecondary, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Projected cycle deadlines from installation date
          </p>
          {cycles.map(({ cycle, deadline, isDone, retestDate }) => (
            <div key={cycle} style={{
              display:       'flex',
              alignItems:    'center',
              justifyContent: 'space-between',
              padding:       '8px 0',
              borderBottom:  cycle < 5 ? `1px solid ${c.border}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: isDone ? c.statusGreenBg : c.elevatedBg,
                  border: `1.5px solid ${isDone ? c.statusGreenText : c.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: isDone ? c.statusGreenText : c.textSecondary,
                  flexShrink: 0,
                }}>
                  {isDone ? '✓' : cycle}
                </span>
                <span style={{ fontFamily: FONTS.body, fontSize: 13, color: c.textPrimary }}>
                  Cycle {cycle}
                  {retestDate && (
                    <span style={{ color: c.statusGreenText, marginLeft: 6, fontSize: 11 }}>
                      ✓ re-tested {fmtDate(retestDate)}
                    </span>
                  )}
                </span>
              </div>
              <span style={{
                fontFamily: FONTS.mono, fontSize: 12,
                color: isDone ? c.textSecondary : (deadline < today ? c.statusRedText : c.textPrimary),
                fontWeight: deadline < today && !isDone ? 600 : 400,
              }}>
                {fmtDate(deadline)}
                {deadline < today && !isDone && ' ⚠️'}
              </span>
            </div>
          ))}
          <p style={{ fontFamily: FONTS.body, fontSize: 11, color: c.textSecondary, margin: '10px 0 0' }}>
            Cylinder expires: <strong>{fmtDate(addMonths(installDate, 180))}</strong> (15 years from installation)
          </p>
        </div>
      )}
    </div>
  );
}
