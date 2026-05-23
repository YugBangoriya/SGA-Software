/**
 * CustomerAcquisitionPipeline.jsx
 * Owner-only. Reads /followUps (linked to conversations from Phase 8)
 * and /quotations to build a per-lead pipeline view.
 *
 * Each row represents an active conversation (lead).
 * Shows: customer name, platform, last message date,
 *        follow-up status, quotation sent/not, last price quoted,
 *        overdue follow-up indicator.
 */

import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, getDocs,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  MessageCircle, Search,
  AlertTriangle, CheckCircle, Clock, Send, RefreshCw,
} from 'lucide-react';

// ── Brand SVG Icons (lucide-react v1.11.0 removed brand icons) ─────────────
function InstagramIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function FacebookIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) {
  return n
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
    : '—';
}

function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function isOverdue(scheduledTs) {
  if (!scheduledTs) return false;
  const d = scheduledTs?.toDate ? scheduledTs.toDate() : new Date(scheduledTs);
  return d.getTime() < Date.now();
}

// ── Platform Icon ──────────────────────────────────────────────────────────

function PlatformIcon({ platform }) {
  const p = (platform || '').toLowerCase();
  if (p === 'whatsapp') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#E8F5E9', color: '#1A7A1A', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'system-ui' }}>
      <MessageCircle size={11} /> WA
    </span>
  );
  if (p === 'instagram') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FCE4EC', color: '#AD1457', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'system-ui' }}>
      <InstagramIcon size={11} /> IG
    </span>
  );
  if (p === 'facebook') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#E3F2FD', color: '#0055CC', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'system-ui' }}>
      <FacebookIcon size={11} /> FB
    </span>
  );
  return (
    <span style={{ background: '#F0F0F0', color: '#666', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'system-ui' }}>
      {platform || '?'}
    </span>
  );
}

// ── Follow-up Status Badge ─────────────────────────────────────────────────

function FollowUpBadge({ status, isOvd }) {
  if (!status) return <span style={{ color: '#999', fontSize: 12, fontFamily: 'system-ui' }}>None</span>;

  const map = {
    Pending:          { bg: isOvd ? '#FFEBEE' : '#FFF3E0', text: isOvd ? '#CC0000' : '#CC6600', label: isOvd ? '⚠ Overdue' : '⏳ Pending' },
    Sent:             { bg: '#E3F2FD', text: '#0055CC', label: '✉ Sent' },
    'Customer Replied': { bg: '#E8F5E9', text: '#1A7A1A', label: '↩ Replied' },
    'No Response':    { bg: '#F5F5F5', text: '#757575', label: '🔕 No Response' },
  };

  const s = map[status] || { bg: '#F0F0F0', text: '#666', label: status };
  return (
    <span style={{
      background: s.bg, color: s.text,
      borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 700, fontFamily: 'system-ui',
    }}>
      {s.label}
    </span>
  );
}

// ── Pipeline Row ───────────────────────────────────────────────────────────

function PipelineRow({ lead, isOvd }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: '1px solid #E8E2DF',
      background: isOvd ? '#FFF8F8' : '#FFFFFF',
      borderLeft: isOvd ? '4px solid #CC0000' : '4px solid transparent',
      transition: 'background 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = isOvd ? '#FFF2F2' : '#FAF8F7'}
      onMouseLeave={e => e.currentTarget.style.background = isOvd ? '#FFF8F8' : '#FFFFFF'}
    >
      {/* Row 1: Name + platform + last message */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#222', fontFamily: 'system-ui' }}>
            {lead.customerName || 'Unknown'}
          </span>
          <PlatformIcon platform={lead.platform} />
          {isOvd && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#FFEBEE', color: '#CC0000', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700, fontFamily: 'system-ui' }}>
              <AlertTriangle size={9} /> Follow-up Overdue
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#888', fontFamily: 'system-ui' }}>
          <Clock size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
          {timeAgo(lead.lastMessageDate)}
        </span>
      </div>

      {/* Row 2: Quotation + follow-up */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        {/* Quotation chip */}
        {lead.quotationNo ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#E8F5E9', color: '#1A7A1A', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'system-ui' }}>
            <Send size={10} /> Quotation: {lead.quotationNo}
          </span>
        ) : (
          <span style={{ color: '#AAA', fontSize: 11, fontFamily: 'system-ui' }}>No quotation sent</span>
        )}

        {/* Last price */}
        {lead.lastPriceQuoted > 0 && (
          <span style={{ fontSize: 12, color: '#444', fontFamily: 'monospace' }}>
            Last price: <strong>{fmt(lead.lastPriceQuoted)}</strong>
          </span>
        )}

        {/* Follow-up badge */}
        <FollowUpBadge status={lead.followUpStatus} isOvd={isOvd} />
      </div>
    </div>
  );
}

// ── Stats Bar ──────────────────────────────────────────────────────────────

function StatsBar({ leads }) {
  const total     = leads.length;
  const withQuote = leads.filter(l => l.quotationNo).length;
  const overdue   = leads.filter(l => l._isOverdue).length;
  const replied   = leads.filter(l => l.followUpStatus === 'Customer Replied').length;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      background: '#F5F0EE', borderBottom: '1px solid #E8E2DF',
    }}>
      {[
        { label: 'Total Leads',    value: total,     color: '#222' },
        { label: 'Quotations Sent',value: withQuote, color: '#1A7A1A' },
        { label: 'Overdue',        value: overdue,   color: '#CC0000' },
        { label: 'Replied',        value: replied,   color: '#0055CC' },
      ].map((s) => (
        <div key={s.label} style={{ padding: '12px 16px', borderRight: '1px solid #E8E2DF', textAlign: 'center' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: 0, fontFamily: 'monospace' }}>{s.value}</p>
          <p style={{ fontSize: 10, color: '#888', margin: '2px 0 0', fontFamily: 'system-ui', letterSpacing: 0.3 }}>
            {s.label.toUpperCase()}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CustomerAcquisitionPipeline() {
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all'); // all | overdue | no-quotation | replied

  useEffect(() => {
    // 1. Fetch all follow-ups (represents active conversations)
    const q = query(
      collection(db, 'followUps'),
      orderBy('scheduledDate', 'asc')
    );

    const unsub = onSnapshot(q, async (snap) => {
      const followUps = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Fetch all quotations to link by conversationId or customerName
      const quotationSnap = await getDocs(collection(db, 'quotations'));
      const quotations    = quotationSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Build a map: customerId → latest quotation
      const quotationMap = {};
      quotations.forEach((q) => {
        const key = q.customerId || q.customerName;
        if (!quotationMap[key] || q.date?.seconds > quotationMap[key].date?.seconds) {
          quotationMap[key] = q;
        }
      });

      // 3. Merge into lead objects
      const merged = followUps.map((fu) => {
        const customerKey = fu.customerId || fu.customerName;
        const latestQuote = quotationMap[customerKey];
        const ovd = fu.status === 'Pending' && isOverdue(fu.scheduledDate);

        return {
          id:              fu.id,
          conversationId:  fu.conversationId,
          customerName:    fu.customerName || '—',
          platform:        fu.platform     || '—',
          lastMessageDate: fu.lastMessageDate || fu.scheduledDate,
          followUpStatus:  fu.status,
          scheduledDate:   fu.scheduledDate,
          quotationNo:     latestQuote?.quotationNo || null,
          lastPriceQuoted: latestQuote?.totalAmount  || 0,
          _isOverdue:      ovd,
        };
      });

      setLeads(merged);
      setLoading(false);
    }, (err) => {
      console.error('CustomerAcquisitionPipeline error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Filter + search
  const displayed = leads
    .filter((l) => {
      if (filter === 'overdue')       return l._isOverdue;
      if (filter === 'no-quotation')  return !l.quotationNo;
      if (filter === 'replied')       return l.followUpStatus === 'Customer Replied';
      return true;
    })
    .filter((l) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (l.customerName || '').toLowerCase().includes(s) ||
        (l.platform || '').toLowerCase().includes(s) ||
        (l.quotationNo || '').toLowerCase().includes(s)
      );
    });

  const overdueFirst = [...displayed].sort((a, b) => (b._isOverdue ? 1 : 0) - (a._isOverdue ? 1 : 0));

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: '#661F1F', padding: '20px 20px 16px' }}>
        <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, margin: 0, fontFamily: 'system-ui' }}>
          Customer Acquisition Pipeline
        </h2>
        <p style={{ color: '#F0BABA', fontSize: 12, margin: '4px 0 0', fontFamily: 'system-ui' }}>
          {loading ? 'Loading…' : `${leads.length} active leads`}
        </p>
      </div>

      {/* Stats bar */}
      {!loading && <StatsBar leads={leads} />}

      {/* Search + filter */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8E2DF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F5F0EE', border: '1.5px solid #E8E2DF', borderRadius: 10, padding: '0 12px', marginBottom: 10 }}>
          <Search size={14} color="#999" />
          <input
            type="text"
            placeholder="Search by customer name, platform, quotation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '10px 0', fontSize: 13, color: '#222', fontFamily: 'system-ui', outline: 'none' }}
          />
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { key: 'all',          label: 'All Leads' },
            { key: 'overdue',      label: '⚠ Overdue Follow-ups' },
            { key: 'no-quotation', label: 'No Quotation Sent' },
            { key: 'replied',      label: 'Customer Replied' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '6px 14px', borderRadius: 20,
                border: '1.5px solid',
                borderColor: filter === tab.key ? '#661F1F' : '#E8E2DF',
                background: filter === tab.key ? '#661F1F' : '#F5F0EE',
                color: filter === tab.key ? '#FFFFFF' : '#444',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'system-ui',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: 60, textAlign: 'center', color: '#999', fontFamily: 'system-ui' }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
          Loading pipeline…
        </div>
      )}

      {/* Rows */}
      {!loading && overdueFirst.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: '#999', fontFamily: 'system-ui' }}>
          <CheckCircle size={28} color="#B8E0B8" style={{ display: 'block', margin: '0 auto 8px' }} />
          <p style={{ fontSize: 14, margin: 0 }}>No leads match this filter.</p>
        </div>
      )}

      {!loading && overdueFirst.map((lead) => (
        <PipelineRow key={lead.id} lead={lead} isOvd={lead._isOverdue} />
      ))}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}