/**
 * DashboardHome.jsx  (Phase 10 replacement for the Phase 1 dashboard)
 * Role: Owner + Employee (widgets filtered by role).
 * All 4 summary widgets pull real data and navigate to the relevant screen.
 * Recent activity feed shows the last 8 audit entries.
 */

import { useNavigate } from 'react-router-dom';
import {
  FileText, Package, Bell, MessageCircle,
  TrendingUp, AlertTriangle, Clock, CheckCircle,
  ChevronRight, User, IndianRupee, RefreshCw,
} from 'lucide-react';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { buildAuditSummary, ACTION_COLOR } from '../../hooks/useAuditLog';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n || 0);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtShortDate() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Summary Widget Card ────────────────────────────────────────────────────

function Widget({ icon: Icon, label, value, sub, accent, bg, border, urgent, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 14,
        padding: '16px 18px',
        textAlign: 'left',
        cursor: 'pointer',
        position: 'relative',
        width: '100%',
        transition: 'transform 0.15s, box-shadow 0.15s',
        boxShadow: urgent
          ? '0 0 0 2px rgba(204,0,0,0.25), 0 4px 12px rgba(0,0,0,0.08)'
          : '0 2px 8px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = urgent ? '0 0 0 2px rgba(204,0,0,0.25), 0 4px 12px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.06)'; }}
    >
      {/* Urgent dot */}
      {urgent && (
        <span style={{
          position: 'absolute', top: 10, right: 10,
          width: 8, height: 8, borderRadius: '50%',
          background: '#CC0000',
          boxShadow: '0 0 0 2px #FFEBEE',
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} color={accent} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#888', fontFamily: 'system-ui', letterSpacing: 0.3 }}>
          {label.toUpperCase()}
        </span>
      </div>

      <p style={{ fontSize: 28, fontWeight: 800, color: accent, margin: 0, fontFamily: 'monospace', lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 12, color: '#888', margin: '6px 0 0', fontFamily: 'system-ui' }}>
        {sub}
      </p>

      <div style={{ position: 'absolute', bottom: 14, right: 14 }}>
        <ChevronRight size={14} color={accent} />
      </div>
    </button>
  );
}

// ── Quick Action Button ────────────────────────────────────────────────────

function QuickAction({ icon: Icon, label, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '14px 10px', borderRadius: 12,
        background: '#FFFFFF', border: '1.5px solid #E8E2DF',
        cursor: 'pointer', flex: 1, minWidth: 72,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#F5F0EE'}
      onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
    >
      <div style={{ width: 40, height: 40, borderRadius: 12, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={color} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#444', fontFamily: 'system-ui', textAlign: 'center', lineHeight: 1.2 }}>
        {label}
      </span>
    </button>
  );
}

// ── Activity Feed Item ─────────────────────────────────────────────────────

const ACTION_ICON = {
  invoice_created: FileText,  invoice_approved: CheckCircle,
  customer_created: User,     customer_updated: User,
  inventory_added: Package,   inventory_replenished: Package,
  quotation_created: FileText, reminder_sent: Bell,
  user_login: User,           followup_sent: MessageCircle,
};

function ActivityItem({ entry }) {
  const colorKey = ACTION_COLOR[entry.action] || 'gray';
  const colorMap = {
    green: '#1A7A1A', blue: '#0055CC', amber: '#CC6600', red: '#CC0000', gray: '#888888',
  };
  const color  = colorMap[colorKey];
  const IconC  = ACTION_ICON[entry.action] || TrendingUp;
  const summary = buildAuditSummary(entry);

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 0',
      borderBottom: '1px solid #F0ECE9',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>
        <IconC size={14} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: '#222', margin: 0, fontFamily: 'system-ui', lineHeight: 1.4 }}>
          {summary}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: '#888', fontFamily: 'system-ui' }}>
            {entry.userName || '—'}
          </span>
          <span style={{ fontSize: 11, color: '#CCCCCC' }}>·</span>
          <span style={{ fontSize: 11, color: '#888', fontFamily: 'system-ui' }}>
            {timeAgo(entry.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DashboardHome({ userName, userRole }) {
  const navigate = useNavigate();
  const { stats, recentActivity, loading } = useDashboardStats();

  const isOwner     = ['owner', 'superadmin'].includes((userRole || '').toLowerCase());
  const isEmployee  = (userRole || '').toLowerCase() === 'employee';

  return (
    <div style={{ paddingBottom: 80, background: '#CDCBC9', minHeight: '100vh' }}>
      {/* ── Greeting Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #661F1F 0%, #8B3A3A 100%)',
        padding: '28px 20px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 40, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <p style={{ color: '#F0BABA', fontSize: 13, margin: '0 0 4px', fontFamily: 'system-ui' }}>
          {fmtShortDate()}
        </p>
        <h1 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 800, margin: 0, fontFamily: 'system-ui', lineHeight: 1.2 }}>
          {greeting()}, {userName?.split(' ')[0] || 'there'} 👋
        </h1>
        <p style={{ color: '#F5D0D0', fontSize: 12, margin: '4px 0 0', fontFamily: 'system-ui' }}>
          Shree Ganesh Automobile
        </p>

        {loading && (
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <RefreshCw size={14} color="rgba(255,255,255,0.5)" style={{ animation: 'spin 1.5s linear infinite' }} />
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '20px 16px 0' }}>

        {/* ── Widget Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
          <Widget
            icon={FileText}
            label="Pending Invoices"
            value={stats.pendingInvoices}
            sub="Awaiting your approval"
            accent={stats.pendingInvoices > 0 ? '#6A1B9A' : '#1A7A1A'}
            bg={stats.pendingInvoices > 0 ? '#F3E5F5' : '#E8F5E9'}
            border={stats.pendingInvoices > 0 ? '#D8B8E8' : '#B8E0B8'}
            urgent={stats.pendingInvoices > 0}
            onClick={() => navigate('/reporting/pending-invoices')}
          />
          <Widget
            icon={Package}
            label="Low Stock"
            value={stats.lowStockItems}
            sub="Items below threshold"
            accent={stats.lowStockItems > 0 ? '#CC6600' : '#1A7A1A'}
            bg={stats.lowStockItems > 0 ? '#FFF3E0' : '#E8F5E9'}
            border={stats.lowStockItems > 0 ? '#FFD088' : '#B8E0B8'}
            urgent={stats.lowStockItems > 3}
            onClick={() => navigate('/inventory')}
          />
          <Widget
            icon={Bell}
            label="Reminders"
            value={stats.upcomingReminders}
            sub="Due in next 30 days"
            accent="#0055CC"
            bg="#E3F2FD"
            border="#B3D0F5"
            urgent={false}
            onClick={() => navigate('/customers')}
          />
          <Widget
            icon={MessageCircle}
            label="Follow-ups"
            value={stats.pendingFollowUps}
            sub="Pending follow-up messages"
            accent={stats.pendingFollowUps > 0 ? '#CC6600' : '#1A7A1A'}
            bg={stats.pendingFollowUps > 0 ? '#FFF3E0' : '#E8F5E9'}
            border={stats.pendingFollowUps > 0 ? '#FFD088' : '#B8E0B8'}
            urgent={false}
            onClick={() => navigate('/reporting/follow-ups')}
          />
        </div>

        {/* ── Outstanding Amount (Owner only) ── */}
        {isOwner && stats.outstandingAmount > 0 && (
          <button
            onClick={() => navigate('/reporting/pending-invoices')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: '#FFF3E0',
              border: '1.5px solid #FFD088', borderRadius: 12,
              padding: '14px 16px', marginBottom: 20,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IndianRupee size={18} color="#CC6600" />
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#CC6600', margin: 0, fontFamily: 'system-ui' }}>
                  OUTSTANDING BALANCE
                </p>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#CC0000', margin: 0, fontFamily: 'monospace' }}>
                  {fmt(stats.outstandingAmount)}
                </p>
              </div>
            </div>
            <ChevronRight size={16} color="#CC6600" />
          </button>
        )}

        {/* ── Quick Actions (Owner) ── */}
        {isOwner && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#661F1F', margin: '0 0 10px', fontFamily: 'system-ui', letterSpacing: 0.5 }}>
              QUICK ACTIONS
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
              <QuickAction icon={FileText}       label="New Invoice"   onClick={() => navigate('/invoices/new')}      color="#6A1B9A" />
              <QuickAction icon={User}           label="New Customer"  onClick={() => navigate('/customers/new')}     color="#0055CC" />
              <QuickAction icon={TrendingUp}     label="P&L Report"    onClick={() => navigate('/reporting/profit-loss')} color="#1A7A1A" />
              <QuickAction icon={AlertTriangle}  label="Audit Log"     onClick={() => navigate('/reporting/audit')}   color="#CC6600" />
            </div>
          </div>
        )}

        {/* ── Quick Actions (Employee) ── */}
        {isEmployee && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#661F1F', margin: '0 0 10px', fontFamily: 'system-ui', letterSpacing: 0.5 }}>
              QUICK ACTIONS
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <QuickAction icon={FileText} label="New Invoice"  onClick={() => navigate('/invoices/new')}    color="#6A1B9A" />
              <QuickAction icon={User}     label="New Customer" onClick={() => navigate('/customers/new')}   color="#0055CC" />
              <QuickAction icon={Package}  label="Inventory"    onClick={() => navigate('/inventory')}       color="#CC6600" />
            </div>
          </div>
        )}

        {/* ── Recent Activity ── */}
        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#222', margin: 0, fontFamily: 'system-ui' }}>
              Recent Activity
            </p>
            {isOwner && (
              <button
                onClick={() => navigate('/reporting/audit')}
                style={{ background: 'none', border: 'none', color: '#661F1F', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', gap: 3 }}
              >
                View all <ChevronRight size={12} />
              </button>
            )}
          </div>

          {recentActivity.length === 0 && (
            <p style={{ fontSize: 13, color: '#AAA', fontFamily: 'system-ui', margin: 0, padding: '16px 0', textAlign: 'center' }}>
              No recent activity.
            </p>
          )}

          {recentActivity.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} />
          ))}
        </div>

      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
