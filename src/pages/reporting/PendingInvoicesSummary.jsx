// SGA — Last updated: Added HomeButton to header for consistent navigation across all report pages
/**
 * PendingInvoicesSummary.jsx
 * Owner-only. Two sections:
 *   1. Invoices awaiting approval (approvalStatus === 'PENDING')
 *   2. Invoices with payment issues (PARTIALLY_PAID, UNPAID, EMI, LOAN)
 * Both sorted oldest-first. Total outstanding amount shown at top.
 */

import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Clock, AlertCircle, RefreshCw, CheckCircle, IndianRupee } from 'lucide-react';
import HomeButton from '../../components/ui/HomeButton';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n || 0);
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function daysSince(ts) {
  if (!ts) return 0;
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

const PAYMENT_STATUS_STYLE = {
  UNPAID:         { bg: '#FFEBEE', text: '#CC0000', border: '#F0B8B8' },
  PARTIALLY_PAID: { bg: '#FFF3E0', text: '#CC6600', border: '#FFD088' },
  EMI:            { bg: '#E3F2FD', text: '#0055CC', border: '#B3D0F5' },
  LOAN:           { bg: '#E3F2FD', text: '#0055CC', border: '#B3D0F5' },
  PENDING:        { bg: '#F3E5F5', text: '#6A1B9A', border: '#D8B8E8' },
};

function StatusBadge({ status }) {
  const s = PAYMENT_STATUS_STYLE[status] || PAYMENT_STATUS_STYLE.UNPAID;
  return (
    <span style={{
      background: s.bg, color: s.text,
      border: `1px solid ${s.border}`,
      borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 700,
      fontFamily: 'system-ui', whiteSpace: 'nowrap',
    }}>
      {status?.replace('_', ' ')}
    </span>
  );
}

function AgeBadge({ days }) {
  const color = days >= 30 ? '#CC0000' : days >= 14 ? '#CC6600' : '#1A7A1A';
  const bg    = days >= 30 ? '#FFEBEE' : days >= 14 ? '#FFF3E0' : '#E8F5E9';
  return (
    <span style={{
      background: bg, color, borderRadius: 20,
      padding: '2px 8px', fontSize: 10, fontWeight: 700,
      fontFamily: 'system-ui', whiteSpace: 'nowrap',
    }}>
      {days}d old
    </span>
  );
}

// ── Invoice Row ────────────────────────────────────────────────────────────

function InvoiceRow({ inv, showBalance, onNavigate }) {
  const days = daysSince(inv.date);

  return (
    <div
      onClick={() => onNavigate && onNavigate(inv.id)}
      style={{
        padding: '14px 16px',
        borderBottom: '1px solid #E8E2DF',
        cursor: onNavigate ? 'pointer' : 'default',
        background: '#FFFFFF',
        transition: 'background 0.15s',
        display: 'grid',
        gridTemplateColumns: '100px 1fr auto',
        gap: 12,
        alignItems: 'center',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#FAF8F7'}
      onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
    >
      {/* Invoice number + date */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0055CC', margin: 0, fontFamily: 'monospace' }}>
          {inv.invoiceNo || '—'}
        </p>
        <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0', fontFamily: 'system-ui' }}>
          {fmtDate(inv.date)}
        </p>
      </div>

      {/* Customer + vehicle + extra info */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#222', margin: 0, fontFamily: 'system-ui' }}>
            {inv.customerName || '—'}
          </p>
          <AgeBadge days={days} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>
            {inv.vehicleNo || '—'}
          </span>
          {inv.paymentMethod && (
            <span style={{ fontSize: 11, color: '#555', fontFamily: 'system-ui' }}>
              · {inv.paymentMethod}
            </span>
          )}
          {inv.loanProvider && (
            <span style={{ fontSize: 11, color: '#555', fontFamily: 'system-ui' }}>
              · {inv.loanProvider}
            </span>
          )}
          {inv.expectedCompletionDate && (
            <span style={{ fontSize: 11, color: '#CC6600', fontFamily: 'system-ui' }}>
              · Due: {fmtDate(inv.expectedCompletionDate)}
            </span>
          )}
        </div>
      </div>

      {/* Amount + status */}
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: '#CC0000', margin: 0, fontFamily: 'monospace' }}>
          {showBalance ? fmt(inv.balanceDue) : fmt(inv.totalAmount)}
        </p>
        {showBalance && inv.totalAmount && (
          <p style={{ fontSize: 10, color: '#888', margin: '2px 0 4px', fontFamily: 'system-ui' }}>
            of {fmt(inv.totalAmount)}
          </p>
        )}
        <StatusBadge status={inv.paymentStatus || 'PENDING'} />
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, icon: Icon, count, totalAmount, invoices, showBalance, emptyMessage, borderColor, onNavigate }) {
  return (
    <div style={{ marginBottom: 8 }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px 10px',
        background: '#F5F0EE',
        borderTop: `3px solid ${borderColor}`,
        borderBottom: '1px solid #E8E2DF',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={16} color={borderColor} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#222', fontFamily: 'system-ui' }}>
            {title}
          </span>
          <span style={{
            background: borderColor, color: '#FFFFFF',
            borderRadius: 20, padding: '1px 8px',
            fontSize: 11, fontWeight: 700, fontFamily: 'system-ui',
          }}>
            {count}
          </span>
        </div>
        {totalAmount > 0 && (
          <span style={{ fontSize: 14, fontWeight: 800, color: borderColor, fontFamily: 'monospace' }}>
            {fmt(totalAmount)}
          </span>
        )}
      </div>

      {invoices.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#999', fontFamily: 'system-ui', fontSize: 13, background: '#FFFFFF' }}>
          <CheckCircle size={20} color="#B8E0B8" style={{ marginBottom: 6, display: 'block', margin: '0 auto 6px' }} />
          {emptyMessage}
        </div>
      ) : (
        invoices.map((inv) => (
          <InvoiceRow
            key={inv.id}
            inv={inv}
            showBalance={showBalance}
            onNavigate={onNavigate}
          />
        ))
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PendingInvoicesSummary({ onNavigateToInvoice }) {
  const [pendingApproval, setPendingApproval] = useState([]);
  const [pendingPayment,  setPendingPayment]  = useState([]);
  const [loading, setLoading]                = useState(true);

  useEffect(() => {
    // 1. Pending approval (oldest first)
    const q1 = query(
      collection(db, 'invoices'),
      where('approvalStatus', '==', 'PENDING'),
      orderBy('date', 'asc')
    );
    // 2. Payment issues (oldest first)
    const q2 = query(
      collection(db, 'invoices'),
      where('paymentStatus', 'in', ['PARTIALLY_PAID', 'UNPAID', 'EMI', 'LOAN']),
      orderBy('date', 'asc')
    );

    let loaded = 0;
    const checkDone = () => { if (++loaded === 2) setLoading(false); };

    const unsub1 = onSnapshot(q1, (snap) => {
      setPendingApproval(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      checkDone();
    }, console.error);

    const unsub2 = onSnapshot(q2, (snap) => {
      setPendingPayment(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      checkDone();
    }, console.error);

    return () => { unsub1(); unsub2(); };
  }, []);

  // Total outstanding (balanceDue on payment-issue invoices)
  const totalOutstanding = pendingPayment.reduce(
    (sum, inv) => sum + (Number(inv.balanceDue) || 0), 0
  );

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: '#661F1F', padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HomeButton />
          <div>
            <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, margin: 0, fontFamily: 'system-ui' }}>
              Pending Invoices
            </h2>
            <p style={{ color: '#F0BABA', fontSize: 12, margin: '4px 0 0', fontFamily: 'system-ui' }}>
          {loading ? 'Loading…' : (
            <>
              {pendingApproval.length} awaiting approval
              {pendingPayment.length > 0 && ` · ${pendingPayment.length} with outstanding payments`}
            </>
          )}
            </p>
          </div>
        </div>
      </div>

      {/* Outstanding amount banner */}
      {!loading && totalOutstanding > 0 && (
        <div style={{
          background: '#FFF3E0', borderBottom: '2px solid #FFD088',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <IndianRupee size={18} color="#CC6600" />
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#CC6600', margin: 0, fontFamily: 'system-ui', letterSpacing: 0.5 }}>
              TOTAL OUTSTANDING BALANCE
            </p>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#CC0000', margin: 0, fontFamily: 'monospace' }}>
              {fmt(totalOutstanding)}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: 60, textAlign: 'center', color: '#999', fontFamily: 'system-ui' }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
          Loading invoices…
        </div>
      )}

      {/* Sections */}
      {!loading && (
        <>
          <Section
            title="Awaiting Approval"
            icon={Clock}
            count={pendingApproval.length}
            totalAmount={pendingApproval.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0)}
            invoices={pendingApproval}
            showBalance={false}
            emptyMessage="No invoices awaiting approval."
            borderColor="#6A1B9A"
            onNavigate={onNavigateToInvoice}
          />
          <Section
            title="Outstanding Payments"
            icon={AlertCircle}
            count={pendingPayment.length}
            totalAmount={totalOutstanding}
            invoices={pendingPayment}
            showBalance={true}
            emptyMessage="All invoices have been paid. Well done!"
            borderColor="#CC6600"
            onNavigate={onNavigateToInvoice}
          />
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}