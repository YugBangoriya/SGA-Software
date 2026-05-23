/**
 * CarQuickSend.jsx
 * Shree Ganesh Automobile — Phase 6: Car Repository
 *
 * REUSABLE COMPONENT — imported by Phase 8 (Unified Messaging) inside the chat interface.
 *
 * Two triggers:
 *   1. User types "/(car name)" in the chat input → shows a floating search popup
 *   2. Car selector button in the toolbar → opens a full company → model picker modal
 *
 * On model selection:
 *   - Generates a pre-drafted WhatsApp message:
 *       "Hello! Here are the CNG installation details for your [Company] [Model]..."
 *       + Google Drive link
 *       + All Instagram Reel links (listed individually)
 *   - Calls onMessageGenerated(message) so Phase 8 can inject it into the chat input
 *     or send it directly.
 *
 * Props:
 *   onMessageGenerated: (messageString) => void
 *   inputValue: string            — the current chat input value (for "/" detection)
 *   onInputChange: (val) => void  — updates the parent input (clears "/" command after selection)
 *   isDark: boolean
 *   triggerRef: React.Ref         — optional, ref to the chat input element for positioning
 *   disabled: boolean
 *
 * Usage in Phase 8:
 *   <CarQuickSend
 *     inputValue={chatInput}
 *     onInputChange={setChatInput}
 *     onMessageGenerated={(msg) => sendOrInjectMessage(msg)}
 *     isDark={isDark}
 *   />
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCarSearch } from '../../hooks/useCarRepository';

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
  darkCard: '#2A2A2A',
  darkElevated: '#3A3A3A',
  darkText: '#E8E8E8',
  darkSub: '#999999',
};

// ─── Message Generator ────────────────────────────────────────────────────────

/**
 * Generates the pre-drafted WhatsApp message for a given car model.
 * @param {string} companyName
 * @param {object} model  — { name, driveLink, reelLinks[] }
 * @returns {string}
 */
export function generateCarMessage(companyName, model) {
  const lines = [];
  lines.push(`🚗 *${companyName} ${model.name} — CNG Kit Details*`);
  lines.push('');
  lines.push(`Namaste! Here are the images and videos for the *${companyName} ${model.name}* CNG installation by Shree Ganesh Automobile. 🙏`);
  lines.push('');

  if (model.driveLink) {
    lines.push('📷 *Installation Images (Google Drive):*');
    lines.push(model.driveLink);
    lines.push('');
  }

  if (model.reelLinks && model.reelLinks.length > 0) {
    lines.push('🎬 *Installation Videos (Instagram Reels):*');
    model.reelLinks.forEach((link, i) => {
      lines.push(`${i + 1}. ${link}`);
    });
    lines.push('');
  }

  lines.push('Feel free to contact us for pricing and booking! 😊');
  lines.push('— Shree Ganesh Automobile');

  return lines.join('\n');
}

// ─── Floating Slash-Command Popup ─────────────────────────────────────────────

function SlashCommandPopup({ searchTerm, companies, onSelect, isDark, anchorRef }) {
  const { search } = useCarSearch();
  const results = searchTerm ? search(searchTerm) : [];

  if (results.length === 0) return null;

  const bg = isDark ? C.darkCard : C.white;
  const border = isDark ? '#444' : C.taupe;
  const text = isDark ? C.darkText : C.textMain;
  const sub = isDark ? C.darkSub : C.textSub;
  const hover = isDark ? '#3A2020' : '#F5F0EE';

  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: 0,
      right: 0,
      marginBottom: 8,
      background: bg,
      border: `1.5px solid ${C.primaryMed}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(102,31,31,0.18)',
      zIndex: 200,
      maxHeight: 280,
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px',
        background: isDark ? '#3A2020' : '#F5D0D0',
        borderBottom: `1px solid ${border}`,
      }}>
        <span style={{ color: C.primary, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
          🚗 CAR QUICK-SEND — {results.length} result{results.length !== 1 ? 's' : ''}
        </span>
      </div>

      {results.map(({ company, model }, i) => (
        <div
          key={`${company.id}-${model.id}`}
          onClick={() => onSelect(company, model)}
          style={{
            padding: '10px 14px',
            cursor: 'pointer',
            borderBottom: i < results.length - 1 ? `1px solid ${border}` : 'none',
            display: 'flex', alignItems: 'center', gap: 10,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = hover}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 20 }}>🚗</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: text, fontSize: 14, fontWeight: 600 }}>
              {company.name} <span style={{ color: sub }}>·</span> {model.name}
            </div>
            <div style={{ color: sub, fontSize: 11, marginTop: 2 }}>
              {model.driveLink ? '📷 ' : ''}{model.reelLinks?.length ? `🎬 ${model.reelLinks.length} reel${model.reelLinks.length !== 1 ? 's' : ''}` : ''}
              {!model.driveLink && !model.reelLinks?.length ? 'No media added' : ''}
            </div>
          </div>
          <span style={{ color: sub, fontSize: 12 }}>↵ Select</span>
        </div>
      ))}
    </div>
  );
}

// ─── Full Car Selector Modal ──────────────────────────────────────────────────

function CarSelectorModal({ onSelect, onClose, isDark }) {
  const { companies, loading } = useCarSearch();
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [modelSearch, setModelSearch] = useState('');

  const bg = isDark ? C.darkCard : C.white;
  const appBg = isDark ? '#111' : '#CDCBC9';
  const border = isDark ? '#444' : C.taupe;
  const text = isDark ? C.darkText : C.textMain;
  const sub = isDark ? C.darkSub : C.textSub;
  const rowBg = isDark ? '#333' : '#FAF7F5';
  const rowHover = isDark ? '#3A2020' : '#F5D0D0';

  const filteredModels = selectedCompany
    ? (selectedCompany.models || []).filter((m) =>
        m.name.toLowerCase().includes(modelSearch.toLowerCase())
      )
    : [];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end',
      zIndex: 300, padding: 0,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: bg, width: '100%',
          maxHeight: '85vh', borderRadius: '20px 20px 0 0',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.25s ease',
        }}
      >
        <style>{`
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>

        {/* Handle */}
        <div style={{ textAlign: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 40, height: 4, background: isDark ? '#555' : '#CCC', borderRadius: 2, margin: '0 auto' }} />
        </div>

        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px 12px',
          borderBottom: `1px solid ${border}`,
        }}>
          <div>
            <div style={{ color: text, fontSize: 16, fontWeight: 800 }}>
              {selectedCompany ? `${selectedCompany.name} — Models` : '🚗 Select Car'}
            </div>
            <div style={{ color: sub, fontSize: 12, marginTop: 2 }}>
              {selectedCompany
                ? 'Select the model to generate a WhatsApp message'
                : 'Select a car company first'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {selectedCompany && (
              <button
                onClick={() => { setSelectedCompany(null); setModelSearch(''); }}
                style={{
                  padding: '7px 12px', borderRadius: 8,
                  border: `1.5px solid ${border}`,
                  background: 'transparent', color: text,
                  fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}
              >← Back</button>
            )}
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: isDark ? C.darkElevated : '#F0EBEA',
              color: sub, fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>
        </div>

        {/* Search (model step) */}
        {selectedCompany && (
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${border}` }}>
            <input
              autoFocus
              placeholder="Search models…"
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 9,
                border: `1.5px solid ${border}`,
                background: isDark ? C.darkElevated : '#F5F0EE',
                color: text, fontSize: 13,
                fontFamily: 'Inter, sans-serif', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: sub }}>
              <span style={{
                display: 'inline-block', width: 24, height: 24,
                border: `2px solid ${C.primary}33`, borderTop: `2px solid ${C.primary}`,
                borderRadius: '50%', animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          )}

          {/* Company list */}
          {!loading && !selectedCompany && companies.map((company) => (
            <div
              key={company.id}
              onClick={() => setSelectedCompany(company)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 20px', cursor: 'pointer',
                borderBottom: `1px solid ${border}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = rowHover}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: isDark ? '#3A2020' : '#F5D0D0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>🏭</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: text, fontSize: 14, fontWeight: 700 }}>{company.name}</div>
                <div style={{ color: sub, fontSize: 12 }}>
                  {company.models?.length || 0} model{company.models?.length !== 1 ? 's' : ''}
                </div>
              </div>
              <span style={{ color: sub }}>›</span>
            </div>
          ))}

          {/* Empty companies */}
          {!loading && !selectedCompany && companies.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: sub }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🚗</div>
              <div style={{ fontSize: 14 }}>No cars in repository yet.</div>
            </div>
          )}

          {/* Model list */}
          {!loading && selectedCompany && filteredModels.map((model) => (
            <div
              key={model.id}
              onClick={() => onSelect(selectedCompany, model)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 20px', cursor: 'pointer',
                borderBottom: `1px solid ${border}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = rowHover}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: isDark ? '#333' : rowBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>🚙</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: text, fontSize: 14, fontWeight: 700 }}>{model.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                  {model.driveLink && <span style={{
                    background: isDark ? '#1A3A6A' : '#E3F2FD',
                    color: isDark ? '#8BE0FF' : C.blue,
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                  }}>📷 Drive</span>}
                  {(model.reelLinks?.length > 0) && <span style={{
                    background: isDark ? '#3A1A5A' : '#F3E5F5',
                    color: isDark ? '#D8C8FF' : '#6A1B9A',
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                  }}>🎬 {model.reelLinks.length} Reels</span>}
                </div>
              </div>
              <div style={{
                background: C.primary, color: C.white,
                fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 7,
              }}>Send</div>
            </div>
          ))}

          {/* No models match filter */}
          {!loading && selectedCompany && filteredModels.length === 0 && modelSearch && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: sub, fontSize: 13 }}>
              No models match "<strong>{modelSearch}</strong>"
            </div>
          )}

          {/* No models at all */}
          {!loading && selectedCompany && (selectedCompany.models?.length || 0) === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: sub, fontSize: 13 }}>
              No models added for {selectedCompany.name} yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Preview Sheet ────────────────────────────────────────────────────────────

function MessagePreviewSheet({ message, companyName, modelName, onSend, onEdit, onClose, isDark }) {
  const bg = isDark ? C.darkCard : C.white;
  const border = isDark ? '#444' : C.taupe;
  const text = isDark ? C.darkText : C.textMain;
  const sub = isDark ? C.darkSub : C.textSub;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'flex-end',
      zIndex: 400,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: bg, width: '100%',
          maxHeight: '90vh', borderRadius: '20px 20px 0 0',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
          animation: 'slideUp 0.25s ease',
        }}
      >
        {/* Handle */}
        <div style={{ textAlign: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 40, height: 4, background: isDark ? '#555' : '#CCC', borderRadius: 2, margin: '0 auto' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: `1px solid ${border}`,
        }}>
          <div>
            <div style={{ color: text, fontSize: 15, fontWeight: 800 }}>Message Preview</div>
            <div style={{ color: sub, fontSize: 12, marginTop: 2 }}>
              {companyName} · {modelName}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: isDark ? C.darkElevated : '#F0EBEA',
            color: sub, fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Message preview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{
            background: isDark ? '#1A3A1A' : '#E8F5E9',
            border: `1px solid ${isDark ? '#2A5A2A' : '#C8E6C9'}`,
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{
              color: sub, fontSize: 10, fontWeight: 700,
              letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
            }}>WhatsApp Preview</div>
            <pre style={{
              color: isDark ? '#D0F0D0' : '#1A5A1A',
              fontSize: 13, fontFamily: 'Inter, sans-serif',
              lineHeight: 1.6, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', margin: 0,
            }}>{message}</pre>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{
          padding: '14px 20px 28px',
          borderTop: `1px solid ${border}`,
          display: 'flex', gap: 10,
        }}>
          <button onClick={onEdit} style={{
            flex: 1, padding: '12px', borderRadius: 10,
            border: `1.5px solid ${isDark ? '#555' : C.taupe}`,
            background: 'transparent', color: text,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>✏ Edit First</button>
          <button onClick={onSend} style={{
            flex: 2, padding: '12px', borderRadius: 10, border: 'none',
            background: C.primary, color: C.white,
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span>📤</span> Insert into Chat
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main CarQuickSend Component ──────────────────────────────────────────────

export default function CarQuickSend({
  inputValue = '',
  onInputChange,
  onMessageGenerated,
  isDark = false,
  disabled = false,
}) {
  const { companies } = useCarSearch();
  const [showModal, setShowModal] = useState(false);
  const [previewData, setPreviewData] = useState(null); // { message, companyName, modelName }
  const containerRef = useRef(null);

  // ── Slash command detection ─────────────────────────────────────────────────

  // Detect "/(searchTerm)" in the input value
  const slashMatch = inputValue.match(/\/([^/\s]*)$/);
  const slashSearchTerm = slashMatch ? slashMatch[1] : null;
  const showSlashPopup = slashSearchTerm !== null && slashSearchTerm.length > 0;

  // ── Selection handler (shared by slash popup and modal) ─────────────────────

  const handleSelect = useCallback((company, model) => {
    setShowModal(false);
    const message = generateCarMessage(company.name, model);
    setPreviewData({ message, companyName: company.name, modelName: model.name });
  }, []);

  // ── Preview actions ────────────────────────────────────────────────────────

  const handleSendFromPreview = () => {
    if (previewData) {
      // Clear any slash command from the input first
      if (onInputChange && slashMatch) {
        const clearedInput = inputValue.replace(/\/[^/\s]*$/, '');
        onInputChange(clearedInput);
      }
      onMessageGenerated(previewData.message);
      setPreviewData(null);
    }
  };

  const handleEditFirst = () => {
    if (previewData && onInputChange) {
      const clearedInput = inputValue.replace(/\/[^/\s]*$/, '');
      onInputChange(clearedInput + previewData.message);
      setPreviewData(null);
    }
  };

  return (
    <>
      {/* Slash command popup — renders relative to parent container */}
      {showSlashPopup && (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
          <SlashCommandPopup
            searchTerm={slashSearchTerm}
            companies={companies}
            isDark={isDark}
            onSelect={(company, model) => {
              // Remove the slash command from input
              if (onInputChange) onInputChange(inputValue.replace(/\/[^/\s]*$/, ''));
              handleSelect(company, model);
            }}
          />
        </div>
      )}

      {/* Car selector button (toolbar icon) */}
      <button
        onClick={() => !disabled && setShowModal(true)}
        disabled={disabled}
        title="Send car media (Quick-Send)"
        style={{
          width: 38, height: 38, borderRadius: 9,
          border: `1.5px solid ${isDark ? '#444' : C.taupe}`,
          background: isDark ? C.darkElevated : C.cardBg,
          color: disabled ? (isDark ? '#555' : '#BBB') : C.primary,
          fontSize: 18, cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = isDark ? '#3A2020' : '#F5D0D0')}
        onMouseLeave={(e) => e.currentTarget.style.background = isDark ? C.darkElevated : C.cardBg}
      >🚗</button>

      {/* Full selector modal */}
      {showModal && (
        <CarSelectorModal
          onSelect={handleSelect}
          onClose={() => setShowModal(false)}
          isDark={isDark}
        />
      )}

      {/* Message preview sheet */}
      {previewData && (
        <MessagePreviewSheet
          message={previewData.message}
          companyName={previewData.companyName}
          modelName={previewData.modelName}
          onSend={handleSendFromPreview}
          onEdit={handleEditFirst}
          onClose={() => setPreviewData(null)}
          isDark={isDark}
        />
      )}
    </>
  );
}

