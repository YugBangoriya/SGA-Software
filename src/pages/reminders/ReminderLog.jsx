/**
 * ReminderLog.jsx
 * Phase 9 — CNG Re-Testing Reminder Log Screen (Owner only)
 *
 * Shows all reminders ever sent, with:
 *   - Search by customer name / vehicle number / phone
 *   - Filter by status (pending / completed) and type (3m / 2m / 1m / final / overdue)
 *   - Each entry: customer name, vehicle, date sent, milestone type, re-test status
 *   - "Mark as Re-tested" CTA on pending entries
 *   - Tap customer name → navigate to CustomerDetail
 *
 * Route: /reminders  (add to your router in Phase 1's App.jsx)
 * Access: Owner + SuperAdmin only
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate }   from 'react-router-dom';
import useTheme          from '../../hooks/useTheme';
import useAuth           from '../../hooks/useAuth';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../../lib/tokens';
import { Spinner, EmptyState, Badge } from '../../components/ui/ui';
import { fmtDate, fmtDateTime, getReminderLabel, getReminderVariant }
  from '../../lib/reminderService';
import useReminderStore  from '../../store/reminderStore';
import MarkRetestedModal from './MarkRetestedModal';

// ── Icons ─────────────────────────────────────────────────────────────────────
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);
const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const CarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/>
    <circle cx="7.5" cy="17.5" r="2.5"/>
    <circle cx="17.5" cy="17.5" r="2.5"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

// ── Badge variant → theme colors ─────────────────────────────────────────────
function getBadgeColors(variant, c) {
  const map = {
    success: { bg: c.statusGreenBg,  text: c.statusGreenText  },
    info:    { bg: c.statusBlueBg,   text: c.statusBlueText   },
    warning: { bg: c.statusAmberBg,  text: c.statusAmberText  },
    danger:  { bg: c.statusRedBg,    text: c.statusRedText    },
    neutral: { bg: c.elevatedBg,     text: c.textSecondary    },
  };
  return map[variant] || map.info;
}

// ── Reminder Type Pill ────────────────────────────────────────────────────────
function TypePill({ type, c }) {
  const variant = getReminderVariant(type);
  const colors  = getBadgeColors(variant, c);
  const label   = getReminderLabel(type);
  return (
    <span style={{
      display:      'inline-block',
      padding:      '3px 9px',
      borderRadius: RADIUS.full,
      fontSize:     11,
      fontWeight:   600,
      fontFamily:   FONTS.body,
      letterSpacing: 0.3,
      background:   colors.bg,
      color:        colors.text,
      whiteSpace:   'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Status Pill ───────────────────────────────────────────────────────────────
function StatusPill({ status, c }) {
  const isPending = status === 'pending';
  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          4,
      padding:      '3px 9px',
      borderRadius: RADIUS.full,
      fontSize:     11,
      fontWeight:   600,
      fontFamily:   FONTS.body,
      background:   isPending ? c.statusAmberBg  : c.statusGreenBg,
      color:        isPending ? c.statusAmberText : c.statusGreenText,
    }}>
      {isPending ? <ClockIcon /> : <CheckIcon />}
      {isPending ? 'Pending' : 'Completed'}
    </span>
  );
}

// ── Reminder Row Card ─────────────────────────────────────────────────────────
function ReminderCard({ reminder, c, onMarkRetested, onViewCustomer }) {
  const isPending  = reminder.status === 'pending';
  const isOverdue  = reminder.reminderType === 'final' ||
                     reminder.reminderType?.startsWith('overdue_');

  const borderColor = isPending && isOverdue
    ? c.statusRedText
    : isPending
    ? c.statusAmberText
    : c.border;

  return (
    <div style={{
      background:   c.cardBg,
      borderRadius: RADIUS.lg,
      border:       `1.5px solid ${borderColor}`,
      boxShadow:    SHADOWS.card,
      marginBottom: 12,
      overflow:     'hidden',
    }}>
      {/* ── Card Header ──────────────────────────────────────────────────── */}
      <div style={{
        padding:       '14px 16px 10px',
        display:       'flex',
        alignItems:    'flex-start',
        gap:           10,
        flexWrap:      'wrap',
        justifyContent: 'space-between',
      }}>
        {/* Left: customer + vehicle */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <button
            onClick={() => onViewCustomer(reminder.customerId)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
            }}
          >
            <span style={{ color: c.textSecondary }}><UserIcon /></span>
            <span style={{
              fontFamily: FONTS.body, fontSize: 15, fontWeight: 600,
              color: c.primary, textDecoration: 'underline', textDecorationStyle: 'dotted',
            }}>
              {reminder.customerName || '—'}
            </span>
            <ChevronRightIcon color={c.primary} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: c.textSecondary }}><CarIcon /></span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: c.textSecondary }}>
              {[reminder.vehicleCompany, reminder.vehicleModel].filter(Boolean).join(' ')}
              {reminder.vehicleNo ? ` · ${reminder.vehicleNo}` : ''}
            </span>
          </div>
        </div>

        {/* Right: type + status pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <TypePill   type={reminder.reminderType} c={c} />
          <StatusPill status={reminder.status}     c={c} />
        </div>
      </div>

      {/* ── Card Body ────────────────────────────────────────────────────── */}
      <div style={{
        padding:       '0 16px 14px',
        display:       'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap:           8,
      }}>
        <InfoItem icon={<ClockIcon />} label="Reminder Sent" value={fmtDateTime(reminder.sentAt)} c={c} />
        <InfoItem icon={null}          label="Re-test Deadline" value={fmtDate(reminder.actualDueDate)} c={c} />
        {reminder.status === 'completed' && reminder.retestDate && (
          <InfoItem icon={<CheckIcon />} label="Re-tested On" value={fmtDate(reminder.retestDate)} c={c} />
        )}
        {reminder.whatsappSuccess === false && (
          <InfoItem icon={null} label="WA Status" value="Send failed" c={c} isError />
        )}
      </div>

      {/* ── Mark as Re-tested CTA (pending only) ─────────────────────────── */}
      {isPending && (
        <div style={{
          padding:    '10px 16px',
          background: isOverdue ? c.statusRedBg : c.statusAmberBg,
          borderTop:  `1px solid ${c.border}`,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: FONTS.body, fontSize: 12, color: isOverdue ? c.statusRedText : c.statusAmberText }}>
            {isOverdue
              ? '⚠️ Customer is overdue — please follow up'
              : 'Waiting for re-test to be completed'}
          </span>
          <button
            onClick={() => onMarkRetested(reminder)}
            style={{
              background:   c.primary,
              color:        '#FFF',
              border:       'none',
              borderRadius: RADIUS.md,
              padding:      '8px 16px',
              fontSize:     12,
              fontWeight:   600,
              fontFamily:   FONTS.body,
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              minHeight:    36,
            }}
          >
            <CheckIcon /> Mark as Re-tested
          </button>
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon, label, value, c, isError }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        {icon && <span style={{ color: c.textSecondary }}>{icon}</span>}
        <span style={{ fontFamily: FONTS.body, fontSize: 11, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {label}
        </span>
      </div>
      <span style={{
        fontFamily: FONTS.mono, fontSize: 13,
        color: isError ? c.statusRedText : c.textPrimary,
        fontWeight: isError ? 600 : 400,
      }}>
        {value || '—'}
      </span>
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────
function FilterBar({ c }) {
  const searchQuery  = useReminderStore((s) => s.searchQuery);
  const filterStatus = useReminderStore((s) => s.filterStatus);
  const filterType   = useReminderStore((s) => s.filterType);
  const setSearch    = useReminderStore((s) => s.setSearchQuery);
  const setStatus    = useReminderStore((s) => s.setFilterStatus);
  const setType      = useReminderStore((s) => s.setFilterType);
  const clearFilters = useReminderStore((s) => s.clearFilters);

  const hasFilters = filterStatus || filterType || searchQuery;

  const selectStyle = {
    background:   c.cardBg,
    color:        c.textPrimary,
    border:       `1.5px solid ${c.border}`,
    borderRadius: RADIUS.md,
    padding:      '8px 12px',
    fontFamily:   FONTS.body,
    fontSize:     13,
    cursor:       'pointer',
    outline:      'none',
    minWidth:     140,
  };

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: c.textSecondary }}>
          <SearchIcon />
        </span>
        <input
          type="text"
          placeholder="Search by name, vehicle number or phone..."
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 14px 10px 38px',
            fontFamily: FONTS.body, fontSize: 14,
            color: c.textPrimary, background: c.cardBg,
            border: `1.5px solid ${c.border}`, borderRadius: RADIUS.md,
            outline: 'none',
          }}
        />
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: c.textSecondary }}><FilterIcon /></span>

        <select value={filterStatus} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>

        <select value={filterType} onChange={(e) => setType(e.target.value)} style={selectStyle}>
          <option value="">All Types</option>
          <option value="warning_3m">3 Months Warning</option>
          <option value="warning_2m">2 Months Warning</option>
          <option value="warning_1m">1 Month Warning</option>
          <option value="final">Final Deadline</option>
          <option value="overdue">Overdue</option>
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            style={{
              background: 'none', border: `1px solid ${c.border}`,
              borderRadius: RADIUS.md, padding: '8px 12px',
              fontFamily: FONTS.body, fontSize: 12,
              color: c.textSecondary, cursor: 'pointer',
            }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

// ── Summary Strip ─────────────────────────────────────────────────────────────
function SummaryStrip({ c }) {
  const summary          = useReminderStore((s) => s.summary);
  const isLoadingSummary = useReminderStore((s) => s.isLoadingSummary);

  const items = [
    { label: 'Total Sent',     value: summary.total,   color: c.textPrimary  },
    { label: 'Pending Re-test', value: summary.pending, color: c.statusAmberText },
    { label: 'Overdue',        value: summary.overdue,  color: c.statusRedText   },
  ];

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{
          flex:         '1 1 100px',
          background:   c.cardBg,
          borderRadius: RADIUS.md,
          padding:      '12px 16px',
          boxShadow:    SHADOWS.card,
          border:       `1px solid ${c.border}`,
        }}>
          <div style={{ fontFamily: FONTS.body, fontSize: 11, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            {label}
          </div>
          <div style={{ fontFamily: FONTS.heading, fontSize: 24, fontWeight: 700, color }}>
            {isLoadingSummary ? '—' : value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ReminderLog() {
  const navigate      = useNavigate();
  const { isDark }    = useTheme();
  const { isOwnerOrAbove } = useAuth();
  const c             = isDark ? COLORS.dark : COLORS.light;

  const loadReminders      = useReminderStore((s) => s.loadReminders);
  const loadSummary        = useReminderStore((s) => s.loadSummary);
  const isLoadingList      = useReminderStore((s) => s.isLoadingList);
  const listError          = useReminderStore((s) => s.listError);
  const getFilteredReminders = useReminderStore((s) => s.getFilteredReminders);

  // Modal state
  const [modalOpen,       setModalOpen]      = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);

  // Derived: the customer object needed by MarkRetestedModal
  const [customers, setCustomers] = useState({});

  // Load on mount
  useEffect(() => {
    loadReminders();
    loadSummary();
  }, [loadReminders, loadSummary]);

  const filteredReminders = getFilteredReminders();

  // Open modal — build minimal customer object from reminder data
  function handleMarkRetested(reminder) {
    setSelectedReminder({
      id:              reminder.customerId,
      name:            reminder.customerName,
      vehicleNo:       reminder.vehicleNo,
      vehicleCompany:  reminder.vehicleCompany,
      vehicleModel:    reminder.vehicleModel,
      // These fields need fresh fetch for full data — we store what we have
      installationDate: reminder.referenceDate, // approximate — modal won't block
      retestDates:      [],
    });
    setModalOpen(true);
  }

  function handleModalSuccess() {
    loadReminders();
    loadSummary();
  }

  if (!isOwnerOrAbove) {
    return (
      <div style={{ padding: 32, fontFamily: FONTS.body, color: c.textSecondary, textAlign: 'center' }}>
        Access restricted to Owner and SuperAdmin.
      </div>
    );
  }

  return (
    <div style={{ background: c.appBg, minHeight: '100vh', padding: '0 0 80px' }}>

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div style={{
        background:   c.cardBg,
        padding:      '20px 20px 16px',
        borderBottom: `1px solid ${c.border}`,
        position:     'sticky',
        top:          0,
        zIndex:       50,
        boxShadow:    SHADOWS.card,
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: c.primary }}><BellIcon /></span>
              <div>
                <h1 style={{ fontFamily: FONTS.heading, fontSize: 22, fontWeight: 700, color: c.textPrimary, margin: 0 }}>
                  CNG Reminder Log
                </h1>
                <p style={{ fontFamily: FONTS.body, fontSize: 12, color: c.textSecondary, margin: '2px 0 0' }}>
                  All re-testing reminders sent to customers
                </p>
              </div>
            </div>
            <button
              onClick={() => { loadReminders(); loadSummary(); }}
              disabled={isLoadingList}
              title="Refresh"
              style={{
                background: 'none', border: `1px solid ${c.border}`,
                borderRadius: RADIUS.md, padding: 8,
                color: c.textSecondary, cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              <RefreshIcon />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 760, margin: '20px auto 0', padding: '0 16px' }}>

        {/* Summary counts */}
        <SummaryStrip c={c} />

        {/* Filter bar */}
        <FilterBar c={c} />

        {/* List */}
        {isLoadingList ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Spinner size={36} color={c.primary} />
          </div>
        ) : listError ? (
          <div style={{
            background: c.statusRedBg, borderRadius: RADIUS.md,
            padding: '16px 20px',
            fontFamily: FONTS.body, fontSize: 14, color: c.statusRedText,
          }}>
            Failed to load reminders: {listError}
          </div>
        ) : filteredReminders.length === 0 ? (
          <EmptyState
            icon={<BellIcon />}
            title="No reminders found"
            description={
              useReminderStore.getState().searchQuery ||
              useReminderStore.getState().filterStatus ||
              useReminderStore.getState().filterType
                ? 'Try adjusting your search or filters.'
                : 'Reminder messages sent to customers will appear here.'
            }
          />
        ) : (
          <>
            <p style={{ fontFamily: FONTS.body, fontSize: 12, color: c.textSecondary, marginBottom: 12 }}>
              Showing {filteredReminders.length} reminder{filteredReminders.length !== 1 ? 's' : ''}
            </p>
            {filteredReminders.map((r) => (
              <ReminderCard
                key={r.id}
                reminder={r}
                c={c}
                onMarkRetested={handleMarkRetested}
                onViewCustomer={(id) => navigate(`/customers/${id}`)}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Mark Re-tested Modal ────────────────────────────────────────────── */}
      <MarkRetestedModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        customer={selectedReminder}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
