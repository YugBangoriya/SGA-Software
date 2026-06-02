// SGA — Last updated: Added HomeButton to header for consistent navigation across all report pages
/**
 * FollowUpTracker.jsx
 * Owner-only. Shows all /followUps documents.
 * Statuses: Pending | Sent | Customer Replied | No Response
 * Overdue follow-ups (status=Pending AND scheduledDate < now) highlighted.
 * Quick actions: Reschedule | Cancel
 */

import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import HomeButton from '../../components/ui/HomeButton';
import {
  Clock, Send, MessageCircle, XCircle, RefreshCw,
  CheckCircle, AlertTriangle, Calendar, Search,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function isOverdue(fu) {
  if (fu.status !== 'Pending') return false;
  const d = fu.scheduledDate?.toDate ? fu.scheduledDate.toDate() : new Date(fu.scheduledDate);
  return d.getTime() < Date.now();
}

const STATUS_STYLE = {
  'Pending':          { bg: '#FFF3E0', text: '#CC6600', border: '#FFD088', icon: Clock },
  'Sent':             { bg: '#E3F2FD', text: '#0055CC', border: '#B3D0F5', icon: Send },
  'Customer Replied': { bg: '#E8F5E9', text: '#1A7A1A', border: '#B8E0B8', icon: CheckCircle },
  'No Response':      { bg: '#F5F5F5', text: '#757575', border: '#CCCCCC', icon: XCircle },
};

const PLATFORM_SHORT = { whatsapp: 'WA', instagram: 'IG', facebook: 'FB' };

// ── Reschedule Modal ───────────────────────────────────────────────────────

function RescheduleModal({ followUp, onSave, onClose }) {
  const [date, setDate] = useState(
    followUp.scheduledDate
      ? (followUp.scheduledDate.toDate ? followUp.scheduledDate.toDate() : new Date(followUp.scheduledDate))
          .toISOString().slice(0, 16)
      : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!date) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'followUps', followUp.id), {
        scheduledDate: Timestamp.fromDate(new Date(date)),
        status: 'Pending',
      });
      onSave();
    } catch (e) {
      alert('Error rescheduling: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 16, padding: 24,
        width: '100%', maxWidth: 380,
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#222', margin: '0 0 4px', fontFamily: 'system-ui' }}>
          Reschedule Follow-Up
        </h3>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px', fontFamily: 'system-ui' }}>
          For: {followUp.customerName}
        </p>

        <label style={{ fontSize: 12, fontWeight: 700, color: '#661F1F', display: 'block', marginBottom: 6, fontFamily: 'system-ui' }}>
          NEW SCHEDULED DATE & TIME
        </label>
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={new Date().toISOString().slice(0, 16)}
          style={{
            width: '100%', padding: '10px 12px',
            border: '1.5px solid #E8E2DF', borderRadius: 8,
            fontSize: 13, color: '#222', background: '#F5F0EE',
            fontFamily: 'system-ui', outline: 'none', boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: 12, border: '1.5px solid #E8E2DF',
              borderRadius: 8, background: '#F5F0EE', color: '#444',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !date}
            style={{
              flex: 1, padding: 12, border: 'none',
              borderRadius: 8, background: saving ? '#999' : '#661F1F',
              color: '#FFFFFF', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'system-ui',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cancel Confirm ─────────────────────────────────────────────────────────

async function cancelFollowUp(id) {
  if (!window.confirm('Cancel this follow-up?')) return;
  await updateDoc(doc(db, 'followUps', id), { status: 'No Response' });
}

// ── Follow-up Row ──────────────────────────────────────────────────────────

function FollowUpRow({ fu, onReschedule }) {
  const ovd   = isOverdue(fu);
  const ss    = STATUS_STYLE[fu.status] || STATUS_STYLE['Pending'];
  const Icon  = ss.icon;
  const plat  = PLATFORM_SHORT[(fu.platform || '').toLowerCase()] || fu.platform;

  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: '1px solid #E8E2DF',
      background: ovd ? '#FFF8F8' : '#FFFFFF',
      borderLeft: `4px solid ${ovd ? '#CC0000' : ss.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {/* Left: customer + details */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#222', fontFamily: 'system-ui' }}>
              {fu.customerName || '—'}
            </span>
            {plat && (
              <span style={{ background: '#E3F2FD', color: '#0055CC', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, fontFamily: 'system-ui' }}>
                {plat}
              </span>
            )}
            {ovd && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#FFEBEE', color: '#CC0000', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700, fontFamily: 'system-ui' }}>
                <AlertTriangle size={9} /> Overdue
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#666', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} />
              Scheduled: {fmtDate(fu.scheduledDate)}
            </span>
            {fu.sentAt && (
              <span style={{ fontSize: 12, color: '#1A7A1A', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Send size={11} />
                Sent: {fmtDateTime(fu.sentAt)}
              </span>
            )}
            {fu.templateId && (
              <span style={{ fontSize: 11, color: '#888', fontFamily: 'system-ui' }}>
                Template: {fu.templateId}
              </span>
            )}
          </div>
        </div>

        {/* Right: status + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: ovd ? '#FFEBEE' : ss.bg,
            color: ovd ? '#CC0000' : ss.text,
            border: `1px solid ${ovd ? '#F0B8B8' : ss.border}`,
            borderRadius: 20, padding: '3px 10px',
            fontSize: 11, fontWeight: 700, fontFamily: 'system-ui',
          }}>
            <Icon size={11} />
            {ovd ? 'Overdue' : fu.status}
          </span>

          {/* Actions: only for Pending */}
          {fu.status === 'Pending' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => onReschedule(fu)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: '#F5F0EE', color: '#661F1F',
                  border: '1.5px solid #C8A0A0', borderRadius: 6,
                  padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'system-ui',
                }}
              >
                <RefreshCw size={10} /> Reschedule
              </button>
              <button
                onClick={() => cancelFollowUp(fu.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: '#FFEBEE', color: '#CC0000',
                  border: '1.5px solid #F0B8B8', borderRadius: 6,
                  padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'system-ui',
                }}
              >
                <XCircle size={10} /> Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function FollowUpTracker() {
  const [followUps, setFollowUps]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [rescheduling, setRescheduling]   = useState(null); // followUp being rescheduled

  useEffect(() => {
    const q = query(
      collection(db, 'followUps'),
      orderBy('scheduledDate', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setFollowUps(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error('FollowUpTracker error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const overdueCount = followUps.filter(isOverdue).length;

  const filtered = followUps
    .filter((fu) => {
      if (statusFilter === 'overdue')   return isOverdue(fu);
      if (statusFilter === 'pending')   return fu.status === 'Pending' && !isOverdue(fu);
      if (statusFilter === 'sent')      return fu.status === 'Sent';
      if (statusFilter === 'replied')   return fu.status === 'Customer Replied';
      if (statusFilter === 'no-response') return fu.status === 'No Response';
      return true;
    })
    .filter((fu) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (fu.customerName || '').toLowerCase().includes(s)
        || (fu.platform || '').toLowerCase().includes(s);
    });

  // Overdue first within results
  const sorted = [...filtered].sort((a, b) => {
    const ao = isOverdue(a) ? 0 : 1;
    const bo = isOverdue(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    const at = a.scheduledDate?.seconds || 0;
    const bt = b.scheduledDate?.seconds || 0;
    return at - bt;
  });

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: '#661F1F', padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HomeButton />
          <div>
            <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, margin: 0, fontFamily: 'system-ui' }}>
              Follow-up Tracker
            </h2>
            <p style={{ color: '#F0BABA', fontSize: 12, margin: '4px 0 0', fontFamily: 'system-ui' }}>
              {loading ? 'Loading…' : `${followUps.length} follow-ups`}
              {overdueCount > 0 && (
                <span style={{ color: '#FFAAAA', fontWeight: 700 }}> · {overdueCount} overdue</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && !loading && (
        <div style={{
          background: '#FFEBEE', borderBottom: '2px solid #F0B8B8',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={16} color="#CC0000" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#CC0000', fontFamily: 'system-ui' }}>
            {overdueCount} follow-up{overdueCount > 1 ? 's are' : ' is'} overdue — action required.
          </span>
        </div>
      )}

      {/* Search + filters */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8E2DF' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#F5F0EE', border: '1.5px solid #E8E2DF',
          borderRadius: 10, padding: '0 12px', marginBottom: 10,
        }}>
          <Search size={14} color="#999" />
          <input
            type="text"
            placeholder="Search by customer name or platform…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '10px 0', fontSize: 13, color: '#222', fontFamily: 'system-ui', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'all',         label: 'All' },
            { key: 'overdue',     label: `⚠ Overdue (${overdueCount})` },
            { key: 'pending',     label: '⏳ Pending' },
            { key: 'sent',        label: '✉ Sent' },
            { key: 'replied',     label: '↩ Replied' },
            { key: 'no-response', label: '🔕 No Response' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              style={{
                padding: '5px 12px', borderRadius: 20,
                border: '1.5px solid',
                borderColor: statusFilter === tab.key ? '#661F1F' : '#E8E2DF',
                background: statusFilter === tab.key ? '#661F1F' : '#F5F0EE',
                color: statusFilter === tab.key ? '#FFFFFF' : '#444',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
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
          Loading follow-ups…
        </div>
      )}

      {/* Empty state */}
      {!loading && sorted.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: '#999', fontFamily: 'system-ui' }}>
          <MessageCircle size={28} color="#CCC" style={{ display: 'block', margin: '0 auto 8px' }} />
          <p style={{ fontSize: 14, margin: 0 }}>No follow-ups match this filter.</p>
        </div>
      )}

      {/* Rows */}
      {!loading && sorted.map((fu) => (
        <FollowUpRow key={fu.id} fu={fu} onReschedule={setRescheduling} />
      ))}

      {/* Reschedule modal */}
      {rescheduling && (
        <RescheduleModal
          followUp={rescheduling}
          onSave={() => setRescheduling(null)}
          onClose={() => setRescheduling(null)}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}