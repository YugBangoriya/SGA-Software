/**
 * ReportingHub.jsx
 * Owner + SuperAdmin. Navigation screen for all reporting & analytics views.
 * Accessible from the "More / Menu" bottom nav tab.
 */

import { useNavigate } from 'react-router-dom';
import {
  FileText, TrendingUp, AlertCircle, Users, MessageCircle,
  Shield, ChevronRight, BarChart2,
} from 'lucide-react';

const REPORTS = [
  {
    id: 'audit',
    title: 'Audit Log',
    description: 'Full activity trail — every login, change, and action with timestamps.',
    icon: Shield,
    accent: '#661F1F',
    bg: '#FFF5F5',
    border: '#F0BABA',
    roles: ['owner', 'superadmin'],
    path: '/reporting/audit',
  },
  {
    id: 'profit-loss',
    title: 'Profit & Loss Report',
    description: 'Per-item and per-invoice gross profit, cost analysis, and loss flags.',
    icon: TrendingUp,
    accent: '#1A7A1A',
    bg: '#F0FAF0',
    border: '#B8E0B8',
    roles: ['owner', 'superadmin'],
    path: '/reporting/profit-loss',
  },
  {
    id: 'pending-invoices',
    title: 'Pending Invoices',
    description: 'Invoices awaiting approval and all outstanding payment balances.',
    icon: AlertCircle,
    accent: '#CC6600',
    bg: '#FFF8F0',
    border: '#FFD088',
    roles: ['owner', 'superadmin'],
    path: '/reporting/pending-invoices',
  },
  {
    id: 'pipeline',
    title: 'Customer Acquisition Pipeline',
    description: 'Active leads from all inbox platforms with quotation and follow-up status.',
    icon: Users,
    accent: '#0055CC',
    bg: '#F0F5FF',
    border: '#B3D0F5',
    roles: ['owner', 'superadmin'],
    path: '/reporting/pipeline',
  },
  {
    id: 'follow-ups',
    title: 'Follow-up Tracker',
    description: 'All scheduled follow-ups with overdue indicators and quick reschedule actions.',
    icon: MessageCircle,
    accent: '#6A1B9A',
    bg: '#F8F0FF',
    border: '#D8B8E8',
    roles: ['owner', 'superadmin'],
    path: '/reporting/follow-ups',
  },
];

export default function ReportingHub({ userRole }) {
  const navigate = useNavigate();
  const role = (userRole || '').toLowerCase();

  const available = REPORTS.filter((r) => r.roles.includes(role));

  return (
    <div style={{ background: '#CDCBC9', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #661F1F 0%, #8B3A3A 100%)',
        padding: '24px 20px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={22} color="#FFFFFF" />
          </div>
          <div>
            <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 800, margin: 0, fontFamily: 'system-ui' }}>
              Reports &amp; Analytics
            </h2>
            <p style={{ color: '#F0BABA', fontSize: 12, margin: '2px 0 0', fontFamily: 'system-ui' }}>
              {available.length} reports available
            </p>
          </div>
        </div>
      </div>

      {/* Report cards */}
      <div style={{ padding: '16px' }}>
        {available.map((report) => {
          const Icon = report.icon;
          return (
            <button
              key={report.id}
              onClick={() => navigate(report.path)}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: 14,
                background: '#FFFFFF',
                border: '1.5px solid #E8E2DF',
                borderLeft: `4px solid ${report.accent}`,
                borderRadius: 12,
                padding: '16px',
                marginBottom: 10,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'box-shadow 0.15s, transform 0.15s',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: report.bg,
                border: `1.5px solid ${report.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} color={report.accent} />
              </div>

              {/* Text */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#222', margin: '0 0 3px', fontFamily: 'system-ui' }}>
                  {report.title}
                </p>
                <p style={{ fontSize: 12, color: '#777', margin: 0, fontFamily: 'system-ui', lineHeight: 1.4 }}>
                  {report.description}
                </p>
              </div>

              <ChevronRight size={16} color="#CCBBBB" style={{ flexShrink: 0 }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
