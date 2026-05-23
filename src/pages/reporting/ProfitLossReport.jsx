/**
 * ProfitLossReport.jsx
 * Owner-only. Shows per-item and per-invoice P&L pulled from
 * approved invoices vs inventory purchase prices.
 */

import { useState } from 'react';
import {
  TrendingUp, TrendingDown, Calendar, RefreshCw,
  ChevronDown, ChevronUp, BarChart2, FileText,
} from 'lucide-react';
import { useProfitLoss } from '../../hooks/useProfitLoss';
import { exportToCSV } from '../../lib/csvExport';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ProfitPill({ value }) {
  const isLoss = value < 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: isLoss ? '#FFEBEE' : '#E8F5E9',
      color: isLoss ? '#CC0000' : '#1A7A1A',
      border: `1px solid ${isLoss ? '#F0B8B8' : '#B8E0B8'}`,
      borderRadius: 20, padding: '2px 10px',
      fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
    }}>
      {isLoss ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
      {fmt(value)}
    </span>
  );
}

// ── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCards({ summary }) {
  const cards = [
    {
      label: 'Total Revenue',
      value: fmt(summary.totalRevenue),
      sub: 'From approved invoices',
      color: '#0055CC',
      bg: '#E3F2FD',
      border: '#B3D0F5',
    },
    {
      label: 'Total Cost',
      value: fmt(summary.totalCost),
      sub: 'Inventory purchase cost',
      color: '#CC6600',
      bg: '#FFF3E0',
      border: '#FFD088',
    },
    {
      label: 'Gross Profit',
      value: fmt(summary.grossProfit),
      sub: summary.grossProfit >= 0 ? 'Revenue − Cost' : 'Net Loss',
      color: summary.grossProfit >= 0 ? '#1A7A1A' : '#CC0000',
      bg: summary.grossProfit >= 0 ? '#E8F5E9' : '#FFEBEE',
      border: summary.grossProfit >= 0 ? '#B8E0B8' : '#F0B8B8',
    },
    {
      label: 'Profit Margin',
      value: `${summary.margin}%`,
      sub: 'Gross margin',
      color: summary.margin >= 20 ? '#1A7A1A' : summary.margin >= 10 ? '#CC6600' : '#CC0000',
      bg: summary.margin >= 20 ? '#E8F5E9' : summary.margin >= 10 ? '#FFF3E0' : '#FFEBEE',
      border: summary.margin >= 20 ? '#B8E0B8' : summary.margin >= 10 ? '#FFD088' : '#F0B8B8',
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: 12,
      padding: '16px',
      background: '#F5F0EE',
      borderBottom: '1px solid #E8E2DF',
    }}>
      {cards.map((c) => (
        <div key={c.label} style={{
          background: c.bg,
          border: `1.5px solid ${c.border}`,
          borderRadius: 12, padding: '14px 16px',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#666', margin: 0,
            fontFamily: 'system-ui', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {c.label}
          </p>
          <p style={{ fontSize: 20, fontWeight: 800, color: c.color,
            margin: '6px 0 2px', fontFamily: 'monospace' }}>
            {c.value}
          </p>
          <p style={{ fontSize: 11, color: '#888', margin: 0, fontFamily: 'system-ui' }}>
            {c.sub}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Date Range Picker ──────────────────────────────────────────────────────

function DateRangePicker({ startDate, endDate, onChange }) {
  const presets = [
    { label: 'This Month', fn: () => {
        const s = new Date(); s.setDate(1); s.setHours(0,0,0,0);
        onChange(s, new Date());
    }},
    { label: 'Last Month', fn: () => {
        const s = new Date(); s.setDate(1); s.setMonth(s.getMonth() - 1); s.setHours(0,0,0,0);
        const e = new Date(); e.setDate(0); e.setHours(23,59,59,999);
        onChange(s, e);
    }},
    { label: 'Last 90 Days', fn: () => {
        const s = new Date(Date.now() - 90 * 86400000);
        onChange(s, new Date());
    }},
    { label: 'This Year', fn: () => {
        const s = new Date(new Date().getFullYear(), 0, 1);
        onChange(s, new Date());
    }},
    { label: 'All Time', fn: () => onChange(null, null) },
  ];

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8E2DF' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Calendar size={14} color="#661F1F" />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#661F1F', fontFamily: 'system-ui' }}>
          DATE RANGE:
        </span>
        <input
          type="date"
          value={startDate ? startDate.toISOString().slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null, endDate)}
          style={dateInputStyle}
        />
        <span style={{ color: '#999', fontSize: 13 }}>→</span>
        <input
          type="date"
          value={endDate ? endDate.toISOString().slice(0, 10) : ''}
          onChange={(e) => onChange(startDate, e.target.value ? new Date(e.target.value) : null)}
          style={dateInputStyle}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 4 }}>
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={p.fn}
              style={{
                background: '#F5F0EE', color: '#661F1F',
                border: '1px solid #C8A0A0', borderRadius: 6,
                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'system-ui',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const dateInputStyle = {
  padding: '6px 10px', border: '1.5px solid #E8E2DF',
  borderRadius: 8, fontSize: 12, color: '#222',
  background: '#F5F0EE', fontFamily: 'system-ui', outline: 'none',
};

// ── Per-Item Table ─────────────────────────────────────────────────────────

function ItemProfitTable({ items, onExport }) {
  const [sortKey, setSortKey] = useState('grossProfit');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = [...items].sort((a, b) => {
    const va = a[sortKey]; const vb = b[sortKey];
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const cols = [
    { key: 'itemName',        label: 'Item',             numeric: false },
    { key: 'purchasePrice',   label: 'Buy Price',        numeric: true  },
    { key: 'avgSellingPrice', label: 'Avg Sell',         numeric: true  },
    { key: 'profitPerUnit',   label: 'Profit/Unit',      numeric: true  },
    { key: 'totalQtySold',    label: 'Qty Sold',         numeric: true  },
    { key: 'grossProfit',     label: 'Gross Profit',     numeric: true  },
    { key: 'invoiceCount',    label: 'Invoices',         numeric: true  },
  ];

  const SortIcon = ({ col }) => (
    sortKey === col
      ? (sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />)
      : null
  );

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px',
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#222', margin: 0, fontFamily: 'system-ui' }}>
          Per-Item Breakdown
        </h3>
        <button onClick={onExport} style={exportBtnStyle}>
          ↓ Export CSV
        </button>
      </div>

      {/* Loss warning banner */}
      {items.some(i => i.isLoss) && (
        <div style={{
          margin: '0 16px 12px', padding: '10px 14px',
          background: '#FFEBEE', border: '1px solid #F0B8B8',
          borderRadius: 8, fontSize: 12, color: '#CC0000',
          fontFamily: 'system-ui', display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <TrendingDown size={14} />
          {items.filter(i => i.isLoss).length} item(s) are being sold at a loss — highlighted in red below.
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'system-ui' }}>
          <thead>
            <tr style={{ background: '#E8E2DF' }}>
              {cols.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.numeric && toggleSort(col.key)}
                  style={{
                    padding: '10px 14px',
                    textAlign: col.numeric ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700,
                    color: sortKey === col.key ? '#661F1F' : '#555',
                    cursor: col.numeric ? 'pointer' : 'default',
                    letterSpacing: 0.5, userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {col.label.toUpperCase()} <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr
                key={item.itemName}
                style={{
                  background: item.isLoss
                    ? (i % 2 === 0 ? '#FFF5F5' : '#FFEFEF')
                    : (i % 2 === 0 ? '#FFFFFF' : '#FAF8F7'),
                  borderBottom: '1px solid #E8E2DF',
                }}
              >
                <td style={{ padding: '10px 14px', color: item.isLoss ? '#CC0000' : '#222', fontWeight: item.isLoss ? 700 : 400 }}>
                  {item.isLoss && <TrendingDown size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                  {item.itemName}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#444', fontFamily: 'monospace' }}>{fmt(item.purchasePrice)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#444', fontFamily: 'monospace' }}>{fmt(item.avgSellingPrice)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <ProfitPill value={item.profitPerUnit} />
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#222' }}>{item.totalQtySold}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <ProfitPill value={item.grossProfit} />
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#666' }}>{item.invoiceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontFamily: 'system-ui' }}>
            No item data for this period.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Per-Invoice Table ──────────────────────────────────────────────────────

function InvoiceProfitTable({ invoices, onExport }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px',
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#222', margin: 0, fontFamily: 'system-ui' }}>
          Per-Invoice Breakdown
        </h3>
        <button onClick={onExport} style={exportBtnStyle}>↓ Export CSV</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'system-ui' }}>
          <thead>
            <tr style={{ background: '#E8E2DF' }}>
              {['Invoice #', 'Customer', 'Vehicle', 'Date', 'Revenue', 'Parts Cost', 'Labour', 'Gross Profit', 'Margin'].map((h) => (
                <th key={h} style={{
                  padding: '10px 14px', textAlign: h === 'Invoice #' || h === 'Customer' || h === 'Vehicle' || h === 'Date' ? 'left' : 'right',
                  fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: 0.5,
                }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => (
              <tr key={inv.id} style={{
                background: inv.isLoss
                  ? (i % 2 === 0 ? '#FFF5F5' : '#FFEFEF')
                  : (i % 2 === 0 ? '#FFFFFF' : '#FAF8F7'),
                borderBottom: '1px solid #E8E2DF',
              }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0055CC', fontWeight: 700 }}>{inv.invoiceNo}</td>
                <td style={{ padding: '10px 14px', color: '#222' }}>{inv.customerName}</td>
                <td style={{ padding: '10px 14px', color: '#555', fontFamily: 'monospace' }}>{inv.vehicleNo}</td>
                <td style={{ padding: '10px 14px', color: '#666' }}>{fmtDate(inv.date)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#0055CC' }}>{fmt(inv.revenue)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#CC6600' }}>{fmt(inv.cost)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#444' }}>{fmt(inv.labour)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <ProfitPill value={inv.profit} />
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: inv.margin >= 0 ? '#1A7A1A' : '#CC0000', fontWeight: 700 }}>
                  {inv.margin}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontFamily: 'system-ui' }}>
            No approved invoices for this period.
          </div>
        )}
      </div>
    </div>
  );
}

const exportBtnStyle = {
  background: '#F5F0EE', color: '#661F1F',
  border: '1.5px solid #C8A0A0', borderRadius: 8,
  padding: '6px 14px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'system-ui',
};

// ── Main Component ─────────────────────────────────────────────────────────

export default function ProfitLossReport() {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate]     = useState(null);
  const [view, setView]           = useState('item'); // 'item' | 'invoice'

  const { data, loading, error, refetch } = useProfitLoss(startDate, endDate);

  const handleDateChange = (s, e) => {
    setStartDate(s);
    setEndDate(e);
  };

  const exportItems = () => {
    if (!data?.byItem?.length) return;
    exportToCSV(data.byItem.map(i => ({
      itemName:       i.itemName,
      purchasePrice:  i.purchasePrice,
      avgSellingPrice:i.avgSellingPrice,
      profitPerUnit:  i.profitPerUnit,
      totalQtySold:   i.totalQtySold,
      grossProfit:    i.grossProfit,
      invoiceCount:   i.invoiceCount,
      status:         i.isLoss ? 'LOSS' : 'PROFIT',
    })), 'sga_profit_loss_by_item');
  };

  const exportInvoices = () => {
    if (!data?.byInvoice?.length) return;
    exportToCSV(data.byInvoice.map(i => ({
      invoiceNo:    i.invoiceNo,
      customerName: i.customerName,
      vehicleNo:    i.vehicleNo,
      date:         fmtDate(i.date),
      revenue:      i.revenue,
      cost:         i.cost,
      labour:       i.labour,
      grossProfit:  i.profit,
      margin:       `${i.margin}%`,
    })), 'sga_profit_loss_by_invoice');
  };

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: '#661F1F', padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, margin: 0, fontFamily: 'system-ui' }}>
              Profit &amp; Loss Report
            </h2>
            <p style={{ color: '#F0BABA', fontSize: 12, margin: '2px 0 0', fontFamily: 'system-ui' }}>
              {data ? `${data.invoiceCount} approved invoices · ${data.byItem.length} items tracked` : 'Loading…'}
            </p>
          </div>
          <button
            onClick={refetch}
            style={{ background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'system-ui' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Date range */}
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onChange={handleDateChange}
      />

      {/* Summary cards */}
      {data && <SummaryCards summary={data.summary} />}

      {/* Loading / Error */}
      {loading && (
        <div style={{ padding: 60, textAlign: 'center', color: '#999', fontFamily: 'system-ui' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
          Calculating profit &amp; loss…
        </div>
      )}
      {error && (
        <div style={{ margin: 16, padding: 14, background: '#FFEBEE', border: '1px solid #F0B8B8', borderRadius: 8, color: '#CC0000', fontSize: 13, fontFamily: 'system-ui' }}>
          Error: {error}
        </div>
      )}

      {/* View toggle */}
      {data && !loading && (
        <>
          <div style={{
            display: 'flex', gap: 0,
            margin: '16px 16px 0',
            border: '1.5px solid #E8E2DF',
            borderRadius: 10, overflow: 'hidden',
          }}>
            {[
              { key: 'item',    label: '📦 By Item',    icon: BarChart2 },
              { key: 'invoice', label: '🧾 By Invoice', icon: FileText  },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                style={{
                  flex: 1, padding: '10px', border: 'none',
                  background: view === tab.key ? '#661F1F' : '#F5F0EE',
                  color: view === tab.key ? '#FFFFFF' : '#661F1F',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  fontFamily: 'system-ui',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ background: '#FFFFFF', margin: '12px 0 0', borderTop: '1px solid #E8E2DF' }}>
            {view === 'item' ? (
              <ItemProfitTable items={data.byItem} onExport={exportItems} />
            ) : (
              <InvoiceProfitTable invoices={data.byInvoice} onExport={exportInvoices} />
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
