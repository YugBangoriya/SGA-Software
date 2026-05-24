// SGA — Last updated: Added HomeButton to header for quick home navigation
/**
 * CarRepositoryAdmin.jsx
 * Shree Ganesh Automobile — Phase 6: Car Repository
 * SuperAdmin-only: Full CRUD for companies, models, and media links.
 * Design: Design Document colors, Inter typography, mobile-first.
 */

import { useState, useRef } from 'react';
import { useCarRepository } from '../../hooks/useCarRepository';
import { useCarRepoNotifications } from '../../hooks/useCarRepository';

// ─── Design tokens (from Design Document) ────────────────────────────────────
const C = {
  primary: '#661F1F',
  primaryMed: '#8B3A3A',
  appBg: '#CDCBC9',
  cardBg: '#F5F0EE',
  taupe: '#E8E2DF',
  textMain: '#222222',
  textSub: '#666666',
  white: '#FFFFFF',
  green: '#1A7A1A',
  amber: '#CC6600',
  red: '#CC0000',
  blue: '#0055CC',
  // Dark mode
  darkAppBg: '#1A1A1A',
  darkCard: '#2A2A2A',
  darkElevated: '#3A3A3A',
  darkText: '#E8E8E8',
  darkSub: '#999999',
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

const isValidUrl = (str) => {
  try { new URL(str); return true; } catch { return false; }
};

function Badge({ children, color = C.primary, bg = '#F5D0D0' }) {
  return (
    <span style={{
      background: bg, color, fontSize: 10, fontWeight: 700,
      padding: '3px 9px', borderRadius: 20, letterSpacing: 0.5,
      fontFamily: 'Inter, sans-serif', textTransform: 'uppercase',
    }}>{children}</span>
  );
}

function Spinner({ size = 18, color = C.primary }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid ${color}33`, borderTop: `2px solid ${color}`,
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  );
}

function ConfirmDialog({ message, onConfirm, onCancel, isDark }) {
  const bg = isDark ? C.darkCard : C.white;
  const text = isDark ? C.darkText : C.textMain;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: bg, borderRadius: 16, padding: '28px 24px',
        maxWidth: 360, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12, textAlign: 'center' }}>⚠️</div>
        <p style={{ color: text, fontSize: 15, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px', borderRadius: 8, border: `1.5px solid ${C.taupe}`,
            background: 'transparent', color: isDark ? C.darkText : C.textMain,
            fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '11px', borderRadius: 8, border: 'none',
            background: C.red, color: C.white,
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Reel Links Editor ────────────────────────────────────────────────────────

function ReelLinksEditor({ links, onChange, isDark }) {
  const sub = isDark ? C.darkSub : C.textSub;
  const inputBg = isDark ? C.darkElevated : C.white;
  const inputBorder = isDark ? '#555' : C.taupe;
  const text = isDark ? C.darkText : C.textMain;

  const addLink = () => onChange([...links, '']);
  const updateLink = (i, val) => {
    const updated = [...links];
    updated[i] = val;
    onChange(updated);
  };
  const removeLink = (i) => onChange(links.filter((_, idx) => idx !== i));

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: sub, display: 'block', marginBottom: 6, letterSpacing: 0.3 }}>
        Instagram Reel Links
      </label>
      {links.map((link, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input
            type="url"
            placeholder={`Reel link ${i + 1} (e.g. https://www.instagram.com/reel/...)`}
            value={link}
            onChange={(e) => updateLink(i, e.target.value)}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 8, fontFamily: 'Inter, sans-serif',
              border: `1.5px solid ${link && !isValidUrl(link) ? C.red : inputBorder}`,
              background: inputBg, color: text, fontSize: 13, outline: 'none',
            }}
          />
          <button
            onClick={() => removeLink(i)}
            title="Remove this reel link"
            style={{
              width: 34, height: 34, borderRadius: 8, border: 'none',
              background: '#FFEBEE', color: C.red, cursor: 'pointer',
              fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >✕</button>
        </div>
      ))}
      <button
        onClick={addLink}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          borderRadius: 8, border: `1.5px dashed ${C.primaryMed}`,
          background: 'transparent', color: C.primaryMed, cursor: 'pointer',
          fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 600,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Reel Link
      </button>
    </div>
  );
}

// ─── Model Form (add / edit) ──────────────────────────────────────────────────

function ModelForm({ initial = {}, onSave, onCancel, isDark, loading }) {
  const [name, setName] = useState(initial.name || '');
  const [driveLink, setDriveLink] = useState(initial.driveLink || '');
  const [reelLinks, setReelLinks] = useState(initial.reelLinks || ['']);
  const [errors, setErrors] = useState({});

  const sub = isDark ? C.darkSub : C.textSub;
  const inputBg = isDark ? C.darkElevated : C.white;
  const inputBorder = isDark ? '#555' : C.taupe;
  const text = isDark ? C.darkText : C.textMain;
  const cardBg = isDark ? C.darkCard : C.white;

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Model name is required';
    if (driveLink && !isValidUrl(driveLink)) e.driveLink = 'Enter a valid URL';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      name: name.trim(),
      driveLink: driveLink.trim(),
      reelLinks: reelLinks.filter(Boolean),
    });
  };

  const field = (label, value, setValue, key, placeholder, type = 'text') => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: sub, display: 'block', marginBottom: 5, letterSpacing: 0.3 }}>
        {label}{key === 'name' ? ' *' : ''}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { setValue(e.target.value); setErrors((err) => ({ ...err, [key]: undefined })); }}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8,
          border: `1.5px solid ${errors[key] ? C.red : inputBorder}`,
          background: inputBg, color: text, fontSize: 13,
          fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
        }}
      />
      {errors[key] && <span style={{ color: C.red, fontSize: 11, marginTop: 3, display: 'block' }}>{errors[key]}</span>}
    </div>
  );

  return (
    <div style={{ background: cardBg, borderRadius: 12, padding: '20px', border: `1.5px solid ${isDark ? '#444' : C.taupe}` }}>
      {field('Model Name', name, setName, 'name', 'e.g. Swift, Nexon, City')}
      {field('Google Drive Images Link', driveLink, setDriveLink, 'driveLink', 'https://drive.google.com/...', 'url')}
      <div style={{ marginBottom: 16 }}>
        <ReelLinksEditor links={reelLinks} onChange={setReelLinks} isDark={isDark} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '10px', borderRadius: 8,
          border: `1.5px solid ${isDark ? '#555' : C.taupe}`,
          background: 'transparent', color: text,
          fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>Cancel</button>
        <button onClick={handleSave} disabled={loading} style={{
          flex: 2, padding: '10px', borderRadius: 8, border: 'none',
          background: C.primary, color: C.white,
          fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: loading ? 0.8 : 1,
        }}>
          {loading ? <Spinner size={14} color={C.white} /> : null}
          {loading ? 'Saving...' : (initial.id ? 'Update Model' : 'Add Model')}
        </button>
      </div>
    </div>
  );
}

// ─── Model Row ────────────────────────────────────────────────────────────────

function ModelRow({ model, companyId, onEdit, onDelete, isDark }) {
  const [expanded, setExpanded] = useState(false);
  const bg = isDark ? '#333' : '#FAF7F5';
  const border = isDark ? '#444' : '#EDE8E5';
  const text = isDark ? C.darkText : C.textMain;
  const sub = isDark ? C.darkSub : C.textSub;

  return (
    <div style={{
      background: bg, borderRadius: 10, border: `1px solid ${border}`,
      marginBottom: 8, overflow: 'hidden', transition: 'box-shadow 0.2s',
    }}>
      {/* Model header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', cursor: 'pointer',
      }} onClick={() => setExpanded((p) => !p)}>
        <span style={{ fontSize: 16 }}>🚗</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: text, fontSize: 14, fontWeight: 600 }}>{model.name}</div>
          <div style={{ color: sub, fontSize: 11, marginTop: 2 }}>
            {model.driveLink ? '📷 Drive link' : '—'} · {model.reelLinks?.length || 0} reel{model.reelLinks?.length !== 1 ? 's' : ''}
          </div>
        </div>
        {/* Action buttons */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(model); }}
          title="Edit model"
          style={{
            padding: '6px 12px', borderRadius: 7, border: `1.5px solid ${C.primaryMed}`,
            background: 'transparent', color: C.primaryMed, fontSize: 12,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >Edit</button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(model); }}
          title="Delete model"
          style={{
            width: 30, height: 30, borderRadius: 7, border: 'none',
            background: '#FFEBEE', color: C.red, fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >🗑</button>
        <span style={{ color: sub, fontSize: 12, transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▾</span>
      </div>

      {/* Expanded: show links */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${border}`, padding: '12px 14px', background: isDark ? C.darkCard : C.white }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: sub, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Google Drive</div>
            {model.driveLink ? (
              <a href={model.driveLink} target="_blank" rel="noreferrer"
                style={{ color: C.blue, fontSize: 13, wordBreak: 'break-all' }}
              >{model.driveLink}</a>
            ) : <span style={{ color: sub, fontSize: 13 }}>No Drive link added</span>}
          </div>
          <div>
            <div style={{ color: sub, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Instagram Reels</div>
            {model.reelLinks?.length > 0 ? model.reelLinks.map((link, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <a href={link} target="_blank" rel="noreferrer"
                  style={{ color: C.blue, fontSize: 13, wordBreak: 'break-all' }}
                >{link}</a>
              </div>
            )) : <span style={{ color: sub, fontSize: 13 }}>No reel links added</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Company Card ─────────────────────────────────────────────────────────────

function CompanyCard({
  company, isDark,
  editCompany, removeCompany,
  createModel, editModel, removeModel,
  actionLoading,
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyName, setCompanyName] = useState(company.name);
  const [companyNameErr, setCompanyNameErr] = useState('');
  const [addingModel, setAddingModel] = useState(false);
  const [editingModel, setEditingModel] = useState(null); // model object
  const [confirm, setConfirm] = useState(null); // { type: 'company'|'model', target }

  const bg = isDark ? C.darkCard : C.cardBg;
  const border = isDark ? '#444' : C.taupe;
  const text = isDark ? C.darkText : C.textMain;
  const sub = isDark ? C.darkSub : C.textSub;

  const handleCompanySave = async () => {
    if (!companyName.trim()) { setCompanyNameErr('Name cannot be empty'); return; }
    await editCompany(company.id, companyName.trim());
    setEditingCompany(false);
    setCompanyNameErr('');
  };

  const handleModelSave = async (data) => {
    await createModel(company.id, data);
    setAddingModel(false);
  };

  const handleModelUpdate = async (data) => {
    await editModel(company.id, editingModel.id, data);
    setEditingModel(null);
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    if (confirm.type === 'company') await removeCompany(company.id);
    if (confirm.type === 'model') await removeModel(company.id, confirm.target.id);
    setConfirm(null);
  };

  return (
    <>
      {confirm && (
        <ConfirmDialog
          message={
            confirm.type === 'company'
              ? `Delete "${company.name}" and all its models? This cannot be undone.`
              : `Delete model "${confirm.target.name}"?`
          }
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          isDark={isDark}
        />
      )}

      <div style={{
        background: bg, borderRadius: 14, border: `1.5px solid ${border}`,
        marginBottom: 14, overflow: 'hidden',
        boxShadow: expanded ? '0 4px 20px rgba(102,31,31,0.1)' : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.3s',
      }}>
        {/* ── Company header ── */}
        <div
          onClick={() => !editingCompany && setExpanded((p) => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 20px', cursor: editingCompany ? 'default' : 'pointer',
          }}
        >
          {/* Company icon */}
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: isDark ? '#3A2020' : '#F5D0D0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>🏭</div>

          {/* Company name / edit inline */}
          {editingCompany ? (
            <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ flex: 1 }}>
                <input
                  autoFocus
                  value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); setCompanyNameErr(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCompanySave(); if (e.key === 'Escape') setEditingCompany(false); }}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: `1.5px solid ${companyNameErr ? C.red : C.primaryMed}`,
                    background: isDark ? C.darkElevated : C.white,
                    color: text, fontSize: 15, fontWeight: 700,
                    fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {companyNameErr && <span style={{ color: C.red, fontSize: 11, marginTop: 2, display: 'block' }}>{companyNameErr}</span>}
              </div>
              <button onClick={handleCompanySave} disabled={actionLoading} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: C.primary, color: C.white, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>Save</button>
              <button onClick={() => { setEditingCompany(false); setCompanyName(company.name); }} style={{
                padding: '8px 12px', borderRadius: 8,
                border: `1.5px solid ${isDark ? '#555' : C.taupe}`,
                background: 'transparent', color: text,
                fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>✕</button>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              <div style={{ color: text, fontSize: 16, fontWeight: 700 }}>{company.name}</div>
              <div style={{ color: sub, fontSize: 12, marginTop: 2 }}>
                {company.models?.length || 0} model{company.models?.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {!editingCompany && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setEditingCompany(true)} style={{
                padding: '6px 14px', borderRadius: 7,
                border: `1.5px solid ${C.primaryMed}`,
                background: 'transparent', color: C.primaryMed,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>Edit</button>
              <button onClick={() => setConfirm({ type: 'company' })} style={{
                width: 32, height: 32, borderRadius: 7, border: 'none',
                background: '#FFEBEE', color: C.red, fontSize: 14,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>🗑</button>
              <span style={{ color: sub, fontSize: 14, transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▾</span>
            </div>
          )}
        </div>

        {/* ── Expanded: models section ── */}
        {expanded && (
          <div style={{ borderTop: `1px solid ${border}`, padding: '16px 20px' }}>
            {/* Model list */}
            {(company.models || []).length === 0 && !addingModel && (
              <div style={{
                textAlign: 'center', padding: '20px',
                color: sub, fontSize: 14, background: isDark ? '#333' : '#FAF7F5',
                borderRadius: 10, border: `1px dashed ${border}`, marginBottom: 12,
              }}>
                No models yet. Add the first one ↓
              </div>
            )}

            {(company.models || []).map((model) =>
              editingModel?.id === model.id ? (
                <div key={model.id} style={{ marginBottom: 10 }}>
                  <ModelForm
                    initial={editingModel}
                    onSave={handleModelUpdate}
                    onCancel={() => setEditingModel(null)}
                    isDark={isDark}
                    loading={actionLoading}
                  />
                </div>
              ) : (
                <ModelRow
                  key={model.id}
                  model={model}
                  companyId={company.id}
                  isDark={isDark}
                  onEdit={(m) => setEditingModel(m)}
                  onDelete={(m) => setConfirm({ type: 'model', target: m })}
                />
              )
            )}

            {/* Add model form */}
            {addingModel ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ color: isDark ? C.darkText : C.textMain, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  Add Model to {company.name}
                </div>
                <ModelForm
                  onSave={handleModelSave}
                  onCancel={() => setAddingModel(false)}
                  isDark={isDark}
                  loading={actionLoading}
                />
              </div>
            ) : (
              <button
                onClick={() => setAddingModel(true)}
                style={{
                  width: '100%', marginTop: 8, padding: '10px',
                  borderRadius: 9, border: `1.5px dashed ${C.primary}`,
                  background: 'transparent', color: C.primary,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 16 }}>+</span> Add Model to {company.name}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────

function NotificationPanel({ isDark }) {
  const { notifications, loading, resolve } = useCarRepoNotifications();

  if (loading || notifications.length === 0) return null;

  const panelBg = isDark ? '#2A1A00' : '#FFF8E7';
  const border = isDark ? '#5A3A00' : '#FFD888';
  const text = isDark ? C.darkText : C.textMain;
  const sub = isDark ? '#CCC' : C.textSub;

  return (
    <div style={{
      background: panelBg, borderRadius: 14,
      border: `1.5px solid ${border}`,
      padding: '16px 20px', marginBottom: 20,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <span style={{ fontSize: 18 }}>🔔</span>
        <div style={{ color: C.amber, fontSize: 13, fontWeight: 700 }}>
          Cars flagged as "Not in Repository" ({notifications.length})
        </div>
      </div>
      {notifications.map((n) => (
        <div key={n.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 9,
          background: isDark ? '#3A2800' : '#FFFBF0',
          border: `1px solid ${border}`, marginBottom: 8,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: text, fontSize: 14, fontWeight: 600 }}>
              {n.companyName} — {n.modelName}
            </div>
            <div style={{ color: sub, fontSize: 11, marginTop: 2 }}>
              Flagged during quotation · Add this car to resolve
            </div>
          </div>
          <button
            onClick={() => resolve(n.id)}
            style={{
              padding: '6px 14px', borderRadius: 7,
              border: `1.5px solid ${C.green}`,
              background: 'transparent', color: C.green,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >Mark Resolved</button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Admin Screen ────────────────────────────────────────────────────────

export default function CarRepositoryAdmin({ isDark }) {
  const {
    companies, loading, error, actionLoading,
    createCompany, editCompany, removeCompany,
    createModel, editModel, removeModel,
  } = useCarRepository();

  const [search, setSearch] = useState('');
  const [addingCompany, setAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyErr, setNewCompanyErr] = useState('');
  const searchRef = useRef(null);

  const appBg = isDark ? C.darkAppBg : C.appBg;
  const text = isDark ? C.darkText : C.textMain;
  const sub = isDark ? C.darkSub : C.textSub;
  const cardBg = isDark ? C.darkCard : C.cardBg;
  const border = isDark ? '#444' : C.taupe;

  // Filter companies by search
  const filtered = search.trim()
    ? companies.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.models || []).some((m) => m.name.toLowerCase().includes(q))
        );
      })
    : companies;

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) { setNewCompanyErr('Company name is required'); return; }
    await createCompany(newCompanyName.trim());
    setNewCompanyName('');
    setAddingCompany(false);
    setNewCompanyErr('');
  };

  return (
    <div style={{
      background: appBg, minHeight: '100vh',
      fontFamily: 'Inter, -apple-system, sans-serif',
      paddingBottom: 60,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Page Header ── */}
      <div style={{
        background: isDark ? '#1F0A0A' : C.primary,
        padding: '20px 20px 18px',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 2px 12px rgba(102,31,31,0.3)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <HomeButton />
              <div>
              <div style={{ color: '#F5D0D0', fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 3 }}>
                SuperAdmin · Car Repository
              </div>
              <h1 style={{ color: C.white, fontSize: 22, fontWeight: 800, margin: 0 }}>
                🚗 Car Repository
              </h1>
              </div>
            </div>
            <button
              onClick={() => setAddingCompany(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', borderRadius: 10,
                border: 'none', background: C.white,
                color: C.primary, fontSize: 13, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <span style={{ fontSize: 16 }}>+</span> Add Company
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', fontSize: 15, color: '#aaa',
            }}>🔍</span>
            <input
              ref={searchRef}
              placeholder="Search companies or models…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 38px',
                borderRadius: 10, border: 'none',
                background: 'rgba(255,255,255,0.15)', color: C.white,
                fontSize: 14, fontFamily: 'Inter, sans-serif',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: 16,
              }}>✕</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>

        {/* Notification panel */}
        <NotificationPanel isDark={isDark} />

        {/* Summary strip */}
        <div style={{
          background: cardBg, borderRadius: 12,
          border: `1px solid ${border}`,
          padding: '12px 16px', marginBottom: 20,
          display: 'flex', gap: 20, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ color: C.primary, fontSize: 22, fontWeight: 800 }}>{companies.length}</div>
            <div style={{ color: sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Companies</div>
          </div>
          <div style={{ width: 1, background: border }} />
          <div>
            <div style={{ color: C.primary, fontSize: 22, fontWeight: 800 }}>
              {companies.reduce((acc, c) => acc + (c.models?.length || 0), 0)}
            </div>
            <div style={{ color: sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Models</div>
          </div>
          <div style={{ width: 1, background: border }} />
          <div>
            <div style={{ color: C.primary, fontSize: 22, fontWeight: 800 }}>
              {companies.reduce((acc, c) => acc + (c.models || []).reduce((a, m) => a + (m.reelLinks?.length || 0), 0), 0)}
            </div>
            <div style={{ color: sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reel Links</div>
          </div>
        </div>

        {/* Add company form */}
        {addingCompany && (
          <div style={{
            background: cardBg, borderRadius: 14,
            border: `1.5px solid ${C.primaryMed}`,
            padding: '18px 20px', marginBottom: 16,
            boxShadow: '0 4px 16px rgba(102,31,31,0.12)',
          }}>
            <div style={{ color: text, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              Add New Car Company
            </div>
            <input
              autoFocus
              placeholder="e.g. Maruti Suzuki, Tata, Hyundai…"
              value={newCompanyName}
              onChange={(e) => { setNewCompanyName(e.target.value); setNewCompanyErr(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCompany(); if (e.key === 'Escape') setAddingCompany(false); }}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: `1.5px solid ${newCompanyErr ? C.red : isDark ? '#555' : C.taupe}`,
                background: isDark ? C.darkElevated : C.white,
                color: text, fontSize: 14, fontFamily: 'Inter, sans-serif',
                outline: 'none', boxSizing: 'border-box', marginBottom: 4,
              }}
            />
            {newCompanyErr && <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{newCompanyErr}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={() => { setAddingCompany(false); setNewCompanyName(''); setNewCompanyErr(''); }} style={{
                flex: 1, padding: '10px', borderRadius: 8,
                border: `1.5px solid ${isDark ? '#555' : C.taupe}`,
                background: 'transparent', color: text,
                fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>Cancel</button>
              <button onClick={handleAddCompany} disabled={actionLoading} style={{
                flex: 2, padding: '10px', borderRadius: 8,
                border: 'none', background: C.primary, color: C.white,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {actionLoading ? <Spinner size={14} color={C.white} /> : null}
                {actionLoading ? 'Saving…' : 'Add Company'}
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: sub }}>
            <Spinner size={32} />
            <div style={{ marginTop: 12, fontSize: 14 }}>Loading car repository…</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#FFEBEE', borderRadius: 12, padding: '16px',
            color: C.red, fontSize: 14, marginBottom: 16,
            border: `1px solid #FFCDD2`,
          }}>⚠ {error}</div>
        )}

        {/* Empty state */}
        {!loading && !error && companies.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: sub, background: cardBg,
            borderRadius: 16, border: `1.5px dashed ${border}`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚗</div>
            <div style={{ color: text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No car companies yet</div>
            <div style={{ fontSize: 13 }}>Click "Add Company" to get started</div>
          </div>
        )}

        {/* Search empty */}
        {!loading && search && filtered.length === 0 && companies.length > 0 && (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            color: sub, background: cardBg,
            borderRadius: 12, border: `1px solid ${border}`,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 14 }}>No results for "<strong>{search}</strong>"</div>
          </div>
        )}

        {/* Company cards */}
        {filtered.map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            isDark={isDark}
            editCompany={editCompany}
            removeCompany={removeCompany}
            createModel={createModel}
            editModel={editModel}
            removeModel={removeModel}
            actionLoading={actionLoading}
          />
        ))}
      </div>
    </div>
  );
}