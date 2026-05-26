// SGA — Last updated: Added select-mode + 2-step DELETE confirmation for individual customer deletion
/**
 * CustomerList.jsx
 * Route: /customers
 * Shows all customer records. Searchable + filterable.
 * Accessible to: SuperAdmin, Owner, Employee
 *
 * NEW: Owner/SuperAdmin can enter "Select Mode" via the Trash icon in the
 * header. In select mode, each card shows a small checkbox. Selecting one
 * or more records reveals a bottom delete bar. Deleting requires typing
 * "DELETE" in a confirmation dialog (2-step protection against accidents).
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
import HomeButton from '../../components/ui/HomeButton';

// ── Lucide icons (inline SVG fallback) ────────────────────────────────────────
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
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
);
const XIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
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
    last.setMonth(last.getMonth() + 33);
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
// DELETE CONFIRMATION MODAL
// Two-step: user must type "DELETE" before the button activates.
// ─────────────────────────────────────────────────────────────────────────────
function DeleteConfirmModal({ count, onConfirm, onCancel, isDeleting }) {
  const [typed, setTyped] = useState('');
  const confirmed = typed.trim() === 'DELETE';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
      onClick={onCancel}
    >
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '28px 24px',
        maxWidth: 360,
        width: '100%',
        boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
      }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#FFEBEE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrashIcon style={{ color: '#CC0000' }} />
          </div>
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#222', textAlign: 'center', fontFamily: FONTS.body }}>
          Delete {count} Customer Record{count !== 1 ? 's' : ''}?
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 1.5, fontFamily: FONTS.body }}>
          This action is <strong>permanent</strong> and cannot be undone. All data for the selected record{count !== 1 ? 's' : ''} will be deleted.
        </p>

        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#444', fontFamily: FONTS.body }}>
          Type <strong style={{ color: '#CC0000' }}>DELETE</strong> to confirm:
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type DELETE here"
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            border: `1.5px solid ${confirmed ? '#CC0000' : '#E8E2DF'}`,
            borderRadius: 8,
            fontSize: 14,
            fontFamily: FONTS.mono,
            outline: 'none',
            marginBottom: 16,
            letterSpacing: 1,
            boxSizing: 'border-box',
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && confirmed) onConfirm(); }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            style={{
              flex: 1, padding: '11px 0',
              background: 'none',
              border: '1.5px solid #E8E2DF',
              borderRadius: 8,
              color: '#444', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: FONTS.body,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || isDeleting}
            style={{
              flex: 1, padding: '11px 0',
              background: confirmed && !isDeleting ? '#CC0000' : '#E0C4C4',
              border: 'none', borderRadius: 8,
              color: '#FFFFFF', fontSize: 14, fontWeight: 700,
              cursor: confirmed && !isDeleting ? 'pointer' : 'not-allowed',
              fontFamily: FONTS.body,
              transition: 'background 0.2s',
            }}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
    listVersion,
    getFilteredCustomers,
    dropdownOptions,
    deleteCustomers,
  } = useCustomerStore();

  const [showFilters, setShowFilters]   = useState(false);
  const [viewMode,    setViewMode]      = useState('list');

  // ── Select / Delete state ────────────────────────────────────────────────
  const [selectMode,     setSelectMode]     = useState(false);
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting,     setIsDeleting]     = useState(false);

  useEffect(() => {
    loadCustomers();
    loadSettings();
    return () => clearCustomers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered   = getFilteredCustomers();
  const hasFilters = filterEmission || filterTechnician;

  // Exit select mode when search/filters change (avoids confusing state)
  useEffect(() => {
    if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); }
  }, [searchQuery, filterEmission, filterTechnician]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true);
    try {
      await deleteCustomers([...selectedIds]);
    } catch (err) {
      console.error('[CustomerList] delete failed:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectMode(false);
      setSelectedIds(new Set());
    }
  };

  // ── Skeleton loader ────────────────────────────────────────────────────────
  if (isLoadingList) {
    return (
      <PageShell c={c}>
        <Header
          c={c} isOwnerOrAbove={isOwnerOrAbove} navigate={navigate}
          selectMode={false} onToggleSelect={() => {}}
        />
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
      <Header
        c={c}
        isOwnerOrAbove={isOwnerOrAbove}
        navigate={navigate}
        selectMode={selectMode}
        onToggleSelect={isOwnerOrAbove ? toggleSelectMode : null}
      />

      {/* ── Select Mode Banner ───────────────────────────────────────────── */}
      {selectMode && (
        <div style={{
          background: '#661F1F',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <span style={{ fontFamily: FONTS.body, fontSize: 13, color: '#FFF', fontWeight: 600 }}>
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Tap a record to select it'}
          </span>
          <button
            onClick={toggleSelectMode}
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: 'none', borderRadius: 6,
              color: '#FFF', fontSize: 12, fontWeight: 600,
              padding: '5px 10px', cursor: 'pointer',
              fontFamily: FONTS.body,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <XIcon /> Cancel
          </button>
        </div>
      )}

      {/* ── Search + Filter Bar ─────────────────────────────────────────── */}
      {!selectMode && (
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
            <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)} icon={<FilterIcon />} />
          </div>
          {showFilters && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Select
                label="Emission Category"
                value={filterEmission}
                onChange={(e) => setFilterEmission(e.target.value)}
                options={dropdownOptions.emissionCategories}
              />
              <Select
                label="Technician"
                value={filterTechnician}
                onChange={(e) => setFilterTechnician(e.target.value)}
                options={dropdownOptions.technicians}
              />
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
              )}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONTS.body, fontSize: 12, color: c.textSecondary }}>
              {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

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
      <div style={{ padding: '8px 16px 120px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            c={c}
            selectMode={selectMode}
            selected={selectedIds.has(customer.id)}
            onSelect={() => toggleSelect(customer.id)}
            onClick={() => {
              if (selectMode) { toggleSelect(customer.id); return; }
              navigate(`/customers/${customer.id}`);
            }}
          />
        ))}
      </div>

      {/* ── FAB for mobile (new customer) ───────────────────────────────── */}
      {isOwnerOrAbove && !selectMode && (
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

      {/* ── Delete Bottom Bar (shown in select mode when items selected) ─── */}
      {selectMode && selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#CC0000',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
          zIndex: 60,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.25)',
        }}>
          <span style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 700, color: '#FFF' }}>
            {selectedIds.size} record{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{
              background: '#FFFFFF',
              color: '#CC0000',
              border: 'none', borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONTS.body,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <TrashIcon /> Delete {selectedIds.size}
          </button>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      {showDeleteModal && (
        <DeleteConfirmModal
          count={selectedIds.size}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
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

function Header({ c, isOwnerOrAbove, navigate, selectMode, onToggleSelect }) {
  return (
    <div style={{
      background: c.cardBg,
      borderBottom: `1px solid ${c.border}`,
      padding: '16px 16px 12px',
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HomeButton variant="light" />
          <div>
            <h1 style={{ margin: 0, fontFamily: FONTS.heading, fontSize: 24, color: c.primary, fontWeight: 700 }}>
              Customers
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: c.textSecondary }}>
              CNG Installation Records
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Trash / select-mode toggle — Owner+ only */}
          {onToggleSelect && !selectMode && (
            <button
              onClick={onToggleSelect}
              title="Select records to delete"
              style={{
                background: 'none',
                border: `1.5px solid ${c.border}`,
                borderRadius: 8,
                padding: '7px 9px',
                cursor: 'pointer',
                color: c.textSecondary,
                display: 'flex', alignItems: 'center',
              }}
            >
              <TrashIcon />
            </button>
          )}
          {isOwnerOrAbove && !selectMode && (
            <Button icon={<PlusIcon />} size="sm" onClick={() => navigate('/customers/new')}>
              Add
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerCard({ customer, c, onClick, selectMode, selected, onSelect }) {
  const nextRetest = getNextRetest(customer.retestDates, customer.installationDate);
  const rs = retestStatus(nextRetest);

  return (
    <div style={{ position: 'relative' }}>
      <Card hoverable onClick={onClick} style={{ padding: 0, overflow: 'hidden', opacity: selectMode && !selected ? 0.75 : 1 }}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              {/* Small checkbox in select mode */}
              {selectMode && (
                <div
                  onClick={(e) => { e.stopPropagation(); onSelect(); }}
                  style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${selected ? '#CC0000' : '#CCBBBB'}`,
                    background: selected ? '#CC0000' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {selected && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              )}
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
              {customer.emissionCategory && <Badge variant="info">{customer.emissionCategory}</Badge>}
              {rs && <Badge variant={rs.variant}>{rs.label}</Badge>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <InfoChip icon={<CarIcon />} text={customer.vehicleNo || '—'} c={c} />
            <InfoChip icon={null} text={[customer.vehicleMake, customer.vehicleModel].filter(Boolean).join(' ') || '—'} c={c} />
            {customer.installationDate && (
              <InfoChip icon={null} text={`Installed ${fmt(customer.installationDate)}`} c={c} />
            )}
          </div>
        </div>
        <div style={{ padding: '8px 16px', background: c.elevatedBg + '80', borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: c.textSecondary }}>
            {customer.cngKitBrand || 'CNG Kit'}{customer.tankCapacity ? ` · ${customer.tankCapacity}L` : ''}
          </span>
          {!selectMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: c.primary }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>View</span>
              <ChevronRightIcon />
            </div>
          )}
        </div>
      </Card>
    </div>
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