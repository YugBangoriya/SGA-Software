/**
 * AuditLogViewer.jsx
 * Full audit trail viewer for Owner and SuperAdmin.
 * Features: filter by user / action type / date range, search, CSV export.
 */

import { useState, useMemo } from 'react';
import {
  Search, Download, Filter, X, ChevronDown, ChevronUp,
  Clock, User, Activity, FileText, Shield, RefreshCw,
} from 'lucide-react';
import {
  useAuditLog,
  AUDIT_ACTION_TYPES,
  ACTION_COLOR,
  buildAuditSummary,
} from '../../hooks/useAuditLog';
import { exportToCSV, formatTimestampForCSV } from '../../lib/csvExport';

// ── Helpers ────────────────────────────────────────────────────────────────

const COLORS = {
  green: { bg: '#E8F5E9', text: '#1A7A1A', border: '#B8E0B8' },
  blue:  { bg: '#E3F2FD', text: '#0055CC', border: '#B3D0F5' },
  amber: { bg: '#FFF3E0', text: '#CC6600', border: '#FFD088' },
  red:   { bg: '#FFEBEE', text: '#CC0000', border: '#F0B8B8' },
  gray:  { bg: '#F0F0F0', text: '#555555', border: '#CCCCCC' },
};

function ActionBadge({ action }) {
  const colorKey = ACTION_COLOR[action] || 'gray';
  const c = COLORS[colorKey];
  const label = AUDIT_ACTION_TYPES.find((a) => a.value === action)?.label
    || action?.replace(/_/g, ' ') || '—';
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        borderRadius: 20,
        padding: '2px 10px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {label}
    </span>
  );
}

function RoleBadge({ role }) {
  const map = {
    superadmin: { bg: '#661F1F', text: '#FFD0D0' },
    owner:      { bg: '#1A3A6A', text: '#C8DEFF' },
    employee:   { bg: '#1A5A3A', text: '#B6EDD0' },
  };
  const c = map[role?.toLowerCase()] || { bg: '#3A3A3A', text: '#E0E0E0' };
  return (
    <span style={{
      background: c.bg, color: c.text,
      borderRadius: 20, padding: '1px 8px',
      fontSize: 10, fontWeight: 700,
      letterSpacing: 0.5, fontFamily: 'system-ui, sans-serif',
      textTransform: 'uppercase',
    }}>
      {role || '—'}
    </span>
  );
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ── Filter Bar ─────────────────────────────────────────────────────────────

function FilterBar({ filters, setFilters, users, onClear }) {
  const [open, setOpen] = useState(false);
  const hasActive =
    filters.userId || filters.action || filters.startDate || filters.endDate;

  // Group actions for the <select>
  const groups = useMemo(() => {
    const g = {};
    AUDIT_ACTION_TYPES.forEach((a) => {
      if (!g[a.group]) g[a.group] = [];
      g[a.group].push(a);
    });
    return g;
  }, []);

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: hasActive ? '#661F1F' : '#F5F0EE',
          color: hasActive ? '#FFFFFF' : '#661F1F',
          border: '1.5px solid #661F1F',
          borderRadius: 8, padding: '8px 14px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <Filter size={14} />
        Filters {hasActive ? '(active)' : ''}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div style={{
          marginTop: 10,
          background: '#FFFFFF',
          border: '1.5px solid #E8E2DF',
          borderRadius: 12,
          padding: '16px 18px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {/* User filter */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#661F1F', display: 'block', marginBottom: 4, fontFamily: 'system-ui' }}>
              USER
            </label>
            <select
              value={filters.userId || ''}
              onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value || null }))}
              style={selectStyle}
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* Action type filter */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#661F1F', display: 'block', marginBottom: 4, fontFamily: 'system-ui' }}>
              ACTION TYPE
            </label>
            <select
              value={filters.action || ''}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value || null }))}
              style={selectStyle}
            >
              <option value="">All actions</option>
              {Object.entries(groups).map(([group, actions]) => (
                <optgroup key={group} label={group}>
                  {actions.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#661F1F', display: 'block', marginBottom: 4, fontFamily: 'system-ui' }}>
              FROM DATE
            </label>
            <input
              type="date"
              value={filters.startDate ? filters.startDate.toISOString().slice(0, 10) : ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  startDate: e.target.value ? new Date(e.target.value) : null,
                }))
              }
              style={inputStyle}
            />
          </div>

          {/* End date */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#661F1F', display: 'block', marginBottom: 4, fontFamily: 'system-ui' }}>
              TO DATE
            </label>
            <input
              type="date"
              value={filters.endDate ? filters.endDate.toISOString().slice(0, 10) : ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  endDate: e.target.value ? new Date(e.target.value) : null,
                }))
              }
              style={inputStyle}
            />
          </div>

          {/* Clear button */}
          {hasActive && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={onClear}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#FFEBEE', color: '#CC0000',
                  border: '1.5px solid #F0B8B8', borderRadius: 8,
                  padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'system-ui',
                }}
              >
                <X size={14} /> Clear Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  width: '100%', padding: '8px 10px',
  border: '1.5px solid #E8E2DF', borderRadius: 8,
  fontSize: 13, color: '#222222',
  background: '#F5F0EE', fontFamily: 'system-ui, sans-serif',
  outline: 'none',
};

const inputStyle = {
  ...selectStyle,
};

// ── Entry Row ──────────────────────────────────────────────────────────────

function AuditEntry({ entry, index }) {
  const [expanded, setExpanded] = useState(false);
  const summary = buildAuditSummary(entry);

  return (
    <div
      style={{
        background: index % 2 === 0 ? '#FFFFFF' : '#FAF8F7',
        borderBottom: '1px solid #E8E2DF',
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{
        padding: '12px 16px',
        display: 'grid',
        gridTemplateColumns: '160px 1fr auto auto',
        gap: 12,
        alignItems: 'center',
      }}>
        {/* Timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={12} color="#999" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#666', fontFamily: 'monospace', lineHeight: 1.4 }}>
            {formatTimestamp(entry.timestamp)}
          </span>
        </div>

        {/* Summary + user */}
        <div>
          <p style={{ fontSize: 13, color: '#222', margin: 0, fontFamily: 'system-ui', lineHeight: 1.4 }}>
            {summary}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <User size={10} color="#999" />
            <span style={{ fontSize: 11, color: '#666', fontFamily: 'system-ui' }}>
              {entry.userName || '—'}
            </span>
            <RoleBadge role={entry.userRole} />
          </div>
        </div>

        {/* Action badge */}
        <ActionBadge action={entry.action} />

        {/* Expand chevron */}
        <span style={{ color: '#999', fontSize: 14 }}>
          {expanded ? '▴' : '▾'}
        </span>
      </div>

      {/* Expanded metadata */}
      {expanded && Object.keys(entry.metadata || {}).length > 0 && (
        <div style={{
          padding: '0 16px 12px 16px',
          background: '#F5F0EE',
          borderTop: '1px solid #E8E2DF',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#661F1F', margin: '8px 0 4px', fontFamily: 'system-ui', letterSpacing: 0.5 }}>
            METADATA
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(entry.metadata || {}).map(([k, v]) => (
              <span key={k} style={{
                background: '#E8E2DF', color: '#444',
                borderRadius: 6, padding: '2px 8px',
                fontSize: 11, fontFamily: 'monospace',
              }}>
                <strong>{k}:</strong> {String(v)}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#999', margin: '6px 0 0', fontFamily: 'monospace' }}>
            Collection: {entry.targetCollection || '—'} · ID: {entry.targetId || '—'} · Entry ID: {entry.id}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AuditLogViewer({ userRole }) {
  const [filters, setFilters] = useState({
    userId: null,
    action: null,
    startDate: null,
    endDate: null,
    search: '',
  });

  const { entries, allEntries, loading, error, users } = useAuditLog(filters);

  const handleExport = () => {
    const exportData = entries.map((e) => ({
      timestamp:    formatTimestampForCSV(e.timestamp),
      userName:     e.userName || '',
      userRole:     e.userRole || '',
      action:       e.action || '',
      summary:      buildAuditSummary(e),
      targetCollection: e.targetCollection || '',
      targetId:     e.targetId || '',
      metadata:     JSON.stringify(e.metadata || {}),
    }));

    exportToCSV(exportData, 'shreeganesh_audit_log', [
      { key: 'timestamp',        label: 'Timestamp' },
      { key: 'userName',         label: 'User Name' },
      { key: 'userRole',         label: 'User Role' },
      { key: 'action',           label: 'Action' },
      { key: 'summary',          label: 'Description' },
      { key: 'targetCollection', label: 'Collection' },
      { key: 'targetId',         label: 'Record ID' },
      { key: 'metadata',         label: 'Metadata (JSON)' },
    ]);
  };

  return (
    <div style={{ padding: '0 0 60px' }}>
      {/* ── Page Header ── */}
      <div style={{
        background: '#661F1F',
        padding: '20px 20px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, margin: 0, fontFamily: 'system-ui' }}>
            Audit Log
          </h2>
          <p style={{ color: '#F0BABA', fontSize: 12, margin: '2px 0 0', fontFamily: 'system-ui' }}>
            {loading ? 'Loading…' : `${allEntries.length} total entries`}
            {filters.search || filters.userId || filters.action ? ` · ${entries.length} shown` : ''}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={loading || entries.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: entries.length > 0 ? '#F5F0EE' : 'rgba(255,255,255,0.2)',
            color: entries.length > 0 ? '#661F1F' : '#999',
            border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            cursor: entries.length > 0 ? 'pointer' : 'not-allowed',
            fontFamily: 'system-ui',
          }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* ── Search + Filters ── */}
      <div style={{ padding: '16px 16px 0' }}>
        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#F5F0EE', border: '1.5px solid #E8E2DF',
          borderRadius: 10, padding: '0 12px', marginBottom: 10,
        }}>
          <Search size={15} color="#999" />
          <input
            type="text"
            placeholder="Search by user name, action, or record…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              padding: '10px 0', fontSize: 13, color: '#222',
              fontFamily: 'system-ui', outline: 'none',
            }}
          />
          {filters.search && (
            <button onClick={() => setFilters((f) => ({ ...f, search: '' }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>

        <FilterBar
          filters={filters}
          setFilters={setFilters}
          users={users}
          onClear={() => setFilters({ userId: null, action: null, startDate: null, endDate: null, search: '' })}
        />
      </div>

      {/* ── Results ── */}
      <div style={{ padding: '0 0', marginTop: 4 }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '160px 1fr auto auto',
          gap: 12,
          padding: '8px 16px',
          background: '#E8E2DF',
          borderTop: '1px solid #D0C8C4',
          borderBottom: '1px solid #D0C8C4',
        }}>
          {['Timestamp', 'Action & User', 'Type', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 700, color: '#661F1F', fontFamily: 'system-ui', letterSpacing: 0.5 }}>
              {h}
            </span>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontFamily: 'system-ui', fontSize: 14 }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <br />Loading audit log…
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: 20, color: '#CC0000', fontFamily: 'system-ui', fontSize: 13, background: '#FFEBEE', margin: 16, borderRadius: 8 }}>
            Error loading audit log: {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && entries.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: '#999', fontFamily: 'system-ui' }}>
            <Activity size={32} color="#CCC" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 15, margin: 0 }}>No audit entries found</p>
            <p style={{ fontSize: 12, margin: '4px 0 0' }}>Try adjusting your filters</p>
          </div>
        )}

        {/* Entries */}
        {!loading && entries.map((entry, i) => (
          <AuditEntry key={entry.id} entry={entry} index={i} />
        ))}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
