/**
 * CustomerList.jsx
 * Route: /customers
 * Shows all customer records. Searchable + filterable.
 * Accessible to: SuperAdmin, Owner, Employee
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG 3 FIX — Blank Customer page (infinite re-render loop):
 *
 *   ROOT CAUSE (in the previous version):
 *     useEffect had [listVersion] as its dependency array and returned
 *     clearCustomers() as its cleanup. clearCustomers() bumped listVersion,
 *     which caused the effect to re-run, which registered a new cleanup,
 *     which fired clearCustomers() again — creating an infinite loop.
 *     The visible symptom was a blank gray page (PageShell background only)
 *     because customers was always reset to [] before it could render.
 *
 *   FIX applied here — ONE targeted change to the useEffect block:
 *
 *   BEFORE (broken):
 *     useEffect(() => {
 *       loadCustomers();
 *       loadSettings();
 *       return () => clearCustomers();   ← cleanup bumped listVersion
 *     }, [listVersion]);                 ← bump re-triggered this effect → loop
 *
 *   AFTER (fixed):
 *     useEffect(() => {
 *       loadCustomers();
 *       loadSettings();
 *       return () => clearCustomers();   ← cleanup only clears data (no bump)
 *     }, []);                            ← runs once on mount, no re-trigger
 *
 *   The matching fix in customerStore.js makes clearCustomers() NOT bump
 *   listVersion, breaking the circular dependency entirely.
 *
 *   Behaviour after fix:
 *   - Component mounts → loadCustomers() fetches fresh data from Firestore.
 *   - Component unmounts (navigate away) → clearCustomers() wipes stale list.
 *   - Component remounts (navigate back) → loadCustomers() fetches again.
 *   - No stale data shown, no infinite loop, no blank page.
 *
 *   The listVersion value is still pulled from the store and kept available
 *   for any future manual refresh button (e.g. key={listVersion} on this
 *   component to force a full remount), but it is no longer in the
 *   useEffect dependency array.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCustomerStore from '../../store/customerStore';
import useAuth from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../../lib/tokens';
import {
  Button, Card, Badge, Spinner, EmptyState, Input, Select, Skeleton,
} from '../../components/ui/ui';

// ── Lucide icons (inline SVG fallback if lucide-react not installed) ──────────
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
);
const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
);
const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const CarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
);
const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
);

// ── Formatters ─────────────────────────────────────────────────────────────
const fmt = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getNextRetest = (retestDates = [], installDate) => {
  if (retestDates.length > 0) {
    const sorted = [...retestDates].sort((a, b) => new Date(b.retestDate) - new Date(a.retestDate));
    const last = new Date(sorted[0].retestDate);
    last.setMonth(last.getMonth() + 33); // 2y 9m
    return last;
  }
  if (installDate) {
    const d = new Date(installDate);
    d.setMonth(d.getMonth() + 33);
    return d;
  }
  return null;
};

const retestStatus = (nextRetest) => {
  if (!nextRetest) return null;
  const now = new Date();
  const diff = (nextRetest - now) / (1000 * 60 * 60 * 24);
  if (diff < 0)  return { variant: 'danger',  label: 'Overdue'  };
  if (diff < 30) return { variant: 'warning', label: 'Due Soon' };
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerList() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const c = isDark ? COLORS.dark : COLORS.light;
  const { isOwnerOrAbove } = useAuth();

  const {
    isLoadingList, listError,
    searchQuery, filterEmission, filterTechnician,
    setSearchQuery, setFilterEmission, setFilterTechnician, clearFilters,
    loadCustomers, loadSettings, clearCustomers,
    // listVersion kept available for future use (e.g. manual refresh via key prop)
    // but intentionally NOT used as a useEffect dependency — see fix notes above.
    listVersion,
    getFilteredCustomers,
    dropdownOptions,
  } = useCustomerStore();

  const [showFilters, setShowFilters] = useState(false);
  const [viewMode,    setViewMode]    = useState('list'); // 'list' | 'grid'

  // BUG 3 FIX:
  //   Dependency array changed from [listVersion] to [].
  //
  //   WHY [listVersion] was the bug:
  //     clearCustomers() (the cleanup) was bumping listVersion, which caused
  //     this effect to re-run, which registered the cleanup again, which
  //     fired clearCustomers() again — an infinite loop that kept customers
  //     empty and rendered a blank page.
  //
  //   WHY [] is now correct:
  //     loadCustomers() always fetches fresh data from Firestore on mount.
  //     clearCustomers() (in customerStore.js) no longer bumps listVersion,
  //     so the cleanup does not re-trigger this effect.
  //     The result: mount → fetch, unmount → clear, remount → fetch again.
  //     Clean, predictable, no loop.
  useEffect(() => {
    loadCustomers();
    loadSettings();
    return () => clearCustomers(); // wipe stale list on unmount (no version bump)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered   = getFilteredCustomers();
  const hasFilters = filterEmission || filterTechnician;

  // ── Skeleton loader ────────────────────────────────────────────────────────
  if (isLoadingList) {
    return (
      <PageShell c={c}>
        <Header c={c} isOwnerOrAbove={isOwnerOrAbove} navigate={navigate} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 16px' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} style={{ padding: 16 }}>
              <Skeleton height={18} width="60%" style={{ marginBottom: 8 }} />
              <Skeleton height={14} width="40%" style={{ marginBottom: 6 }} />
              <Skeleton height={14} width="55%" />
            </Card>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell c={c}>
      {/* ── Top Header ─────────────────────────────────────────────────── */}
      <Header c={c} isOwnerOrAbove={isOwnerOrAbove} navigate={navigate} />

      {/* ── Search + Filter Bar ─────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Input
              placeholder="Search name, phone, vehicle…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<SearchIcon />}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              height: 44, width: 44, borderRadius: RADIUS.md, flexShrink: 0,
              border: `1.5px solid ${hasFilters ? c.primary : c.border}`,
              background: hasFilters ? c.primary : c.cardBg,
              color: hasFilters ? '#fff' : c.textSecondary,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Filters"
          >
            <FilterIcon />
          </button>
        </div>

        {/* ── Expandable filter row ───────────────────────────────────── */}
        {showFilters && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderTop: `1px solid ${c.border}` }}>
            <div style={{ minWidth: 160, flex: 1 }}>
              <Select
                placeholder="All Emission Types"
                value={filterEmission}
                onChange={(e) => setFilterEmission(e.target.value)}
                options={dropdownOptions.emissionCategories}
              />
            </div>
            <div style={{ minWidth: 160, flex: 1 }}>
              <Select
                placeholder="All Technicians"
                value={filterTechnician}
                onChange={(e) => setFilterTechnician(e.target.value)}
                options={dropdownOptions.technicians}
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        )}

        {/* ── Results count ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONTS.body, fontSize: 12, color: c.textSecondary }}>
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {listError && (
        <div style={{ margin: 16, padding: 12, background: c.statusRedBg, borderRadius: RADIUS.md, color: c.statusRedText, fontFamily: FONTS.body, fontSize: 13 }}>
          ⚠ Failed to load customers: {listError}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!listError && filtered.length === 0 && (
        <EmptyState
          icon="🚗"
          title={searchQuery || hasFilters ? 'No results found' : 'No customers yet'}
          description={
            searchQuery || hasFilters
              ? 'Try a different search or clear filters.'
              : 'Start by adding your first customer record.'
          }
          action={
            isOwnerOrAbove && !searchQuery && !hasFilters ? (
              <Button icon={<PlusIcon />} onClick={() => navigate('/customers/new')}>
                Add First Customer
              </Button>
            ) : null
          }
        />
      )}

      {/* ── Customer list ───────────────────────────────────────────────── */}
      <div style={{ padding: '8px 16px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            c={c}
            onClick={() => navigate(`/customers/${customer.id}`)}
          />
        ))}
      </div>

      {/* ── FAB for mobile ──────────────────────────────────────────────── */}
      {isOwnerOrAbove && (
        <button
          onClick={() => navigate('/customers/new')}
          style={{
            position: 'fixed', bottom: 80, right: 20,
            width: 56, height: 56, borderRadius: '50%',
            background: c.primary,
            color: '#fff',
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(102,31,31,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 300,
            transition: 'transform 0.15s',
            zIndex: 50,
          }}
          title="Add Customer"
        >
          +
        </button>
      )}
    </PageShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PageShell({ children, c }) {
  return (
    <div style={{ background: c.appBg, minHeight: '100vh', fontFamily: FONTS.body }}>
      {children}
    </div>
  );
}

function Header({ c, isOwnerOrAbove, navigate }) {
  return (
    <div style={{
      background: c.cardBg,
      borderBottom: `1px solid ${c.border}`,
      padding: '16px 16px 12px',
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: FONTS.heading, fontSize: 24, color: c.primary, fontWeight: 700 }}>
            Customers
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: c.textSecondary }}>
            CNG Installation Records
          </p>
        </div>
        {isOwnerOrAbove && (
          <Button icon={<PlusIcon />} size="sm" onClick={() => navigate('/customers/new')}>
            Add
          </Button>
        )}
      </div>
    </div>
  );
}

function CustomerCard({ customer, c, onClick }) {
  const nextRetest = getNextRetest(customer.retestDates, customer.installationDate);
  const rs = retestStatus(nextRetest);

  return (
    <Card hoverable onClick={onClick} style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px' }}>
        {/* Row 1: Name + badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: c.primary + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: c.primary, fontWeight: 700, fontSize: 15 }}>
                {customer.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: c.textPrimary, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {customer.name}
              </div>
              <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 1 }}>{customer.phone}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {customer.emissionCategory && (
              <Badge variant="info">{customer.emissionCategory}</Badge>
            )}
            {rs && <Badge variant={rs.variant}>{rs.label}</Badge>}
          </div>
        </div>

        {/* Row 2: Vehicle info */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <InfoChip icon={<CarIcon />} text={customer.vehicleNo || '—'} c={c} />
          <InfoChip icon={null} text={[customer.vehicleMake, customer.vehicleModel].filter(Boolean).join(' ') || '—'} c={c} />
          {customer.installationDate && (
            <InfoChip icon={null} text={`Installed ${fmt(customer.installationDate)}`} c={c} />
          )}
        </div>
      </div>

      {/* Footer stripe */}
      <div style={{ padding: '8px 16px', background: c.elevatedBg + '80', borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: c.textSecondary }}>
          {customer.cngKitBrand || 'CNG Kit'}{customer.tankCapacity ? ` · ${customer.tankCapacity}L` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: c.primary }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>View</span>
          <ChevronRightIcon />
        </div>
      </div>
    </Card>
  );
}

function InfoChip({ icon, text, c }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon && <span style={{ color: c.textSecondary }}>{icon}</span>}
      <span style={{ fontSize: 12, color: c.textSecondary, fontFamily: FONTS.mono }}>{text}</span>
    </div>
  );
}