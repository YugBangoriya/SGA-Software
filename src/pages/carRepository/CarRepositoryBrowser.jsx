/**
 * CarRepositoryBrowser.jsx
 * Shree Ganesh Automobile — Phase 6: Car Repository
 * Owner read-only view: Browse companies and models, view media links.
 * No edit capabilities — clean, browsable display.
 */

import { useState } from 'react';
import { useCarRepository } from '../../hooks/useCarRepository';

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
  darkAppBg: '#1A1A1A',
  darkCard: '#2A2A2A',
  darkElevated: '#3A3A3A',
  darkText: '#E8E8E8',
  darkSub: '#999999',
};

function Spinner({ size = 24, color = C.primary }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid ${color}33`, borderTop: `2px solid ${color}`,
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  );
}

// ─── Model Card (read-only) ───────────────────────────────────────────────────

function ModelCard({ model, companyName, isDark }) {
  const [expanded, setExpanded] = useState(false);
  const bg = isDark ? '#333' : '#FAF7F5';
  const border = isDark ? '#444' : '#EDE8E5';
  const text = isDark ? C.darkText : C.textMain;
  const sub = isDark ? C.darkSub : C.textSub;

  const hasMedia = model.driveLink || (model.reelLinks?.length > 0);

  return (
    <div style={{
      background: bg, borderRadius: 10,
      border: `1px solid ${border}`,
      marginBottom: 8, overflow: 'hidden',
    }}>
      <div
        onClick={() => hasMedia && setExpanded((p) => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          cursor: hasMedia ? 'pointer' : 'default',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: isDark ? '#3A2020' : '#F5D0D0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>🚙</div>

        <div style={{ flex: 1 }}>
          <div style={{ color: text, fontSize: 14, fontWeight: 700 }}>{model.name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
            {model.driveLink && (
              <span style={{
                background: isDark ? '#1A3A6A' : '#E3F2FD',
                color: isDark ? '#8BE0FF' : C.blue,
                fontSize: 10, fontWeight: 700, padding: '2px 7px',
                borderRadius: 20, letterSpacing: 0.3,
              }}>📷 Drive</span>
            )}
            {(model.reelLinks?.length > 0) && (
              <span style={{
                background: isDark ? '#3A1A5A' : '#F3E5F5',
                color: isDark ? '#D8C8FF' : '#6A1B9A',
                fontSize: 10, fontWeight: 700, padding: '2px 7px',
                borderRadius: 20, letterSpacing: 0.3,
              }}>🎬 {model.reelLinks.length} Reel{model.reelLinks.length !== 1 ? 's' : ''}</span>
            )}
            {!hasMedia && (
              <span style={{ color: sub, fontSize: 11 }}>No media added yet</span>
            )}
          </div>
        </div>

        {hasMedia && (
          <span style={{
            color: sub, fontSize: 14,
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: '0.2s',
          }}>▾</span>
        )}
      </div>

      {expanded && hasMedia && (
        <div style={{
          borderTop: `1px solid ${border}`,
          padding: '14px',
          background: isDark ? C.darkCard : C.white,
        }}>
          {/* Drive link */}
          {model.driveLink && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                color: sub, fontSize: 10, fontWeight: 700,
                letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6,
              }}>📷 Google Drive — Images</div>
              <a
                href={model.driveLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 8,
                  background: isDark ? '#1A3A6A' : '#E3F2FD',
                  color: isDark ? '#8BE0FF' : C.blue,
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  wordBreak: 'break-all', maxWidth: '100%',
                }}
              >
                <span>🔗</span> View {companyName} {model.name} Images
              </a>
            </div>
          )}

          {/* Reel links */}
          {(model.reelLinks?.length > 0) && (
            <div>
              <div style={{
                color: sub, fontSize: 10, fontWeight: 700,
                letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
              }}>🎬 Instagram Reels — Installation Videos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {model.reelLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 12px', borderRadius: 8,
                      background: isDark ? '#3A1A5A' : '#F3E5F5',
                      color: isDark ? '#D8C8FF' : '#6A1B9A',
                      fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    <span>▶</span>
                    <span>Reel {i + 1}</span>
                    <span style={{ color: sub, fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      — {link}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Company Accordion (read-only) ────────────────────────────────────────────

function CompanyAccordion({ company, isDark }) {
  const [open, setOpen] = useState(false);
  const bg = isDark ? C.darkCard : C.cardBg;
  const border = isDark ? '#444' : C.taupe;
  const text = isDark ? C.darkText : C.textMain;
  const sub = isDark ? C.darkSub : C.textSub;
  const modelCount = company.models?.length || 0;

  return (
    <div style={{
      background: bg, borderRadius: 14, border: `1.5px solid ${border}`,
      marginBottom: 12, overflow: 'hidden',
      boxShadow: open ? '0 4px 20px rgba(102,31,31,0.1)' : '0 2px 8px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.3s',
    }}>
      <div
        onClick={() => setOpen((p) => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', cursor: 'pointer',
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: isDark ? '#3A2020' : '#F5D0D0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>🏭</div>

        <div style={{ flex: 1 }}>
          <div style={{ color: text, fontSize: 16, fontWeight: 700 }}>{company.name}</div>
          <div style={{ color: sub, fontSize: 12, marginTop: 2 }}>
            {modelCount} model{modelCount !== 1 ? 's' : ''} available
          </div>
        </div>

        <div style={{
          background: isDark ? '#3A2020' : '#F5D0D0',
          color: C.primary, padding: '4px 10px',
          borderRadius: 20, fontSize: 12, fontWeight: 700,
        }}>{modelCount}</div>

        <span style={{
          color: sub, fontSize: 16,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: '0.25s',
        }}>▾</span>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${border}`, padding: '14px 20px' }}>
          {modelCount === 0 ? (
            <div style={{
              textAlign: 'center', padding: '20px',
              color: sub, fontSize: 14,
              background: isDark ? '#333' : '#FAF7F5',
              borderRadius: 10, border: `1px dashed ${border}`,
            }}>
              No models in this company yet.
            </div>
          ) : (
            company.models.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                companyName={company.name}
                isDark={isDark}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Browser Screen ──────────────────────────────────────────────────────

export default function CarRepositoryBrowser({ isDark }) {
  const { companies, loading, error, search } = useCarRepository();
  const [searchTerm, setSearchTerm] = useState('');

  const appBg = isDark ? C.darkAppBg : C.appBg;
  const text = isDark ? C.darkText : C.textMain;
  const sub = isDark ? C.darkSub : C.textSub;
  const cardBg = isDark ? C.darkCard : C.cardBg;
  const border = isDark ? '#444' : C.taupe;

  // Build filtered list
  let displayCompanies = companies;
  if (searchTerm.trim()) {
    const results = search(searchTerm);
    // Group results back into companies
    const companyMap = {};
    results.forEach(({ company, model }) => {
      if (!companyMap[company.id]) companyMap[company.id] = { ...company, models: [] };
      companyMap[company.id].models.push(model);
    });
    displayCompanies = Object.values(companyMap);
  }

  return (
    <div style={{
      background: appBg, minHeight: '100vh',
      fontFamily: 'Inter, -apple-system, sans-serif',
      paddingBottom: 80,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        background: isDark ? '#1F0A0A' : C.primary,
        padding: '20px 20px 18px',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 2px 12px rgba(102,31,31,0.3)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: '#F5D0D0', fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 3 }}>
              Car Repository
            </div>
            <h1 style={{ color: C.white, fontSize: 22, fontWeight: 800, margin: 0 }}>
              🚗 Browse Cars
            </h1>
            <div style={{ color: '#F0BABA', fontSize: 12, marginTop: 4 }}>
              View car media links · Contact SuperAdmin to add cars
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', fontSize: 15, color: '#aaa',
            }}>🔍</span>
            <input
              placeholder="Search by company or model name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 38px',
                borderRadius: 10, border: 'none',
                background: 'rgba(255,255,255,0.15)', color: C.white,
                fontSize: 14, fontFamily: 'Inter, sans-serif',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: 16,
              }}>✕</button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>

        {/* Stats strip */}
        {!loading && companies.length > 0 && (
          <div style={{
            background: cardBg, borderRadius: 12,
            border: `1px solid ${border}`,
            padding: '12px 16px', marginBottom: 20,
            display: 'flex', gap: 20, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ color: C.primary, fontSize: 20, fontWeight: 800 }}>{companies.length}</div>
              <div style={{ color: sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Brands</div>
            </div>
            <div style={{ width: 1, background: border }} />
            <div>
              <div style={{ color: C.primary, fontSize: 20, fontWeight: 800 }}>
                {companies.reduce((acc, c) => acc + (c.models?.length || 0), 0)}
              </div>
              <div style={{ color: sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Models</div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: sub }}>
            <Spinner size={32} />
            <div style={{ marginTop: 12, fontSize: 14 }}>Loading cars…</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#FFEBEE', borderRadius: 12,
            padding: '14px 16px', color: C.red, fontSize: 14,
            border: `1px solid #FFCDD2`, marginBottom: 16,
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
            <div style={{ color: text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No cars in repository yet</div>
            <div style={{ fontSize: 13 }}>Ask the SuperAdmin to add car companies and models</div>
          </div>
        )}

        {/* No search results */}
        {!loading && searchTerm && displayCompanies.length === 0 && companies.length > 0 && (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            color: sub, background: cardBg,
            borderRadius: 12, border: `1px solid ${border}`,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 14 }}>No results for "<strong>{searchTerm}</strong>"</div>
          </div>
        )}

        {/* Company list */}
        {displayCompanies.map((company) => (
          <CompanyAccordion key={company.id} company={company} isDark={isDark} />
        ))}

        {/* Footer note */}
        {!loading && companies.length > 0 && (
          <div style={{
            textAlign: 'center', marginTop: 24,
            color: sub, fontSize: 12,
          }}>
            To add a new car or update links, contact the SuperAdmin.
          </div>
        )}
      </div>
    </div>
  );
}
