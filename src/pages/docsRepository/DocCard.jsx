// ─────────────────────────────────────────────────────────
//  src/pages/DocsRepository/components/DocCard.jsx
//
//  A single document card. Supports two layouts:
//    view="grid"  — square-ish card with icon, name, meta
//    view="list"  — full-width row with icon left, meta right
//
//  Props:
//    doc         { id, fileName, fileType, fileSize, categoryName,
//                  uploadedByName, uploadedAt, fileUrl }
//    view        "grid" | "list"
//    onPreview   fn(doc)  — open preview modal
//    onDelete    fn(doc)  — open delete confirmation
//    onSelect    fn(doc)  — used by DocsRepositoryPanel (send to chat)
//    selectMode  boolean  — shows "Send" button instead of preview
//    darkMode    boolean
// ─────────────────────────────────────────────────────────
import { useState } from "react";
import { formatFileSize, getFileTypeColors, getFileTypeEmoji } from "../../lib/fileHelpers";

const fmt = (date) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date instanceof Date ? date : new Date(date));
};

export default function DocCard({
  doc,
  view = "grid",
  onPreview,
  onDelete,
  onSelect,
  selectMode = false,
  darkMode = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const colors = getFileTypeColors(doc.fileType);
  const label  = getFileTypeEmoji(doc.fileType);

  const card = {
    background:   darkMode ? "#2A2A2A" : "#FFFFFF",
    border:       `1.5px solid ${darkMode ? "#3A3A3A" : "#E8E2DF"}`,
    borderRadius: 12,
    boxShadow:    darkMode
      ? "0 2px 10px rgba(0,0,0,0.3)"
      : "0 2px 8px rgba(0,0,0,0.07)",
    transition:   "box-shadow 0.2s, transform 0.15s",
    cursor:       "pointer",
    position:     "relative",
    overflow:     "visible",
  };

  const textPrimary   = darkMode ? "#E8E8E8" : "#222222";
  const textSecondary = darkMode ? "#999999" : "#666666";
  const divider       = darkMode ? "#3A3A3A" : "#E8E2DF";

  function handleCardClick(e) {
    if (menuOpen) { setMenuOpen(false); return; }
    if (selectMode && onSelect) { onSelect(doc); return; }
    if (onPreview) onPreview(doc);
  }

  // ── Grid layout ───────────────────────────────────────
  if (view === "grid") {
    return (
      <div
        style={card}
        onClick={handleCardClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 6px 20px rgba(102,31,31,0.15)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = darkMode
            ? "0 2px 10px rgba(0,0,0,0.3)"
            : "0 2px 8px rgba(0,0,0,0.07)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {/* File type icon area */}
        <div
          style={{
            background:   colors.bg,
            borderRadius: "10px 10px 0 0",
            padding:      "20px 16px 16px",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            minHeight:    80,
          }}
        >
          <span
            style={{
              color:      colors.icon,
              fontSize:   13,
              fontWeight: 800,
              fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace",
              letterSpacing: 1.5,
              padding:    "6px 10px",
              background: "rgba(255,255,255,0.6)",
              borderRadius: 6,
              border:     `1.5px solid ${colors.icon}22`,
            }}
          >
            {label}
          </span>
        </div>

        {/* Card body */}
        <div style={{ padding: "12px 14px 14px" }}>
          {/* File name */}
          <div
            style={{
              color:      textPrimary,
              fontSize:   13,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              lineHeight: 1.35,
              marginBottom: 4,
              wordBreak:  "break-word",
              display:    "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow:   "hidden",
            }}
          >
            {doc.fileName}
          </div>

          {/* Category badge */}
          {doc.categoryName && (
            <span
              style={{
                display:     "inline-block",
                fontSize:    10,
                fontWeight:  600,
                color:       "#8B3A3A",
                background:  "#F5E6E6",
                borderRadius: 20,
                padding:     "2px 7px",
                marginBottom: 8,
                fontFamily:  "'Inter', sans-serif",
              }}
            >
              {doc.categoryName}
            </span>
          )}

          {/* Meta row */}
          <div
            style={{
              borderTop:   `1px solid ${divider}`,
              marginTop:   8,
              paddingTop:  8,
              fontSize:    11,
              color:       textSecondary,
              fontFamily:  "'Inter', sans-serif",
            }}
          >
            <div style={{ marginBottom: 2 }}>{formatFileSize(doc.fileSize)}</div>
            <div>{fmt(doc.uploadedAt)}</div>
          </div>
        </div>

        {/* Actions overlay (top-right) — shown on hover or always for menu */}
        {!selectMode && (
          <ActionMenu
            onDelete={() => onDelete?.(doc)}
            onPreview={() => onPreview?.(doc)}
            open={menuOpen}
            setOpen={setMenuOpen}
            darkMode={darkMode}
            position="topRight"
          />
        )}

        {/* Select mode: show a send button overlay */}
        {selectMode && (
          <div
            style={{
              position:   "absolute",
              inset:      0,
              borderRadius: 12,
              background: "rgba(102,31,31,0)",
              display:    "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity:    0,
              transition: "opacity 0.15s",
            }}
            className="send-overlay"
          >
            <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>Send</span>
          </div>
        )}
      </div>
    );
  }

  // ── List layout ───────────────────────────────────────
  return (
    <div
      style={{
        ...card,
        display:    "flex",
        alignItems: "center",
        gap:        14,
        padding:    "12px 16px",
      }}
      onClick={handleCardClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(102,31,31,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = darkMode
          ? "0 2px 10px rgba(0,0,0,0.3)"
          : "0 2px 8px rgba(0,0,0,0.07)";
      }}
    >
      {/* Icon pill */}
      <div
        style={{
          width:       48,
          height:      48,
          borderRadius: 10,
          background:  colors.bg,
          display:     "flex",
          alignItems:  "center",
          justifyContent: "center",
          flexShrink:  0,
        }}
      >
        <span
          style={{
            color:      colors.icon,
            fontSize:   9,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace",
            letterSpacing: 1,
          }}
        >
          {label}
        </span>
      </div>

      {/* Main text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color:     textPrimary,
            fontSize:  14,
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            overflow:  "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {doc.fileName}
        </div>
        <div
          style={{
            color:     textSecondary,
            fontSize:  12,
            fontFamily: "'Inter', sans-serif",
            marginTop: 2,
          }}
        >
          {[
            doc.categoryName || null,
            formatFileSize(doc.fileSize),
            fmt(doc.uploadedAt),
            doc.uploadedByName ? `by ${doc.uploadedByName}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>

      {/* Right-side actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {selectMode ? (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect?.(doc); }}
            style={{
              background:   "#661F1F",
              color:        "white",
              border:       "none",
              borderRadius: 8,
              padding:      "6px 14px",
              fontSize:     12,
              fontWeight:   600,
              fontFamily:   "'Inter', sans-serif",
              cursor:       "pointer",
            }}
          >
            Send
          </button>
        ) : (
          <ActionMenu
            onDelete={() => onDelete?.(doc)}
            onPreview={() => onPreview?.(doc)}
            open={menuOpen}
            setOpen={setMenuOpen}
            darkMode={darkMode}
            position="inline"
          />
        )}
      </div>
    </div>
  );
}

// ── Internal action menu ─────────────────────────────────
function ActionMenu({ onDelete, onPreview, open, setOpen, darkMode, position }) {
  const menuBg   = darkMode ? "#2A2A2A" : "#FFFFFF";
  const menuText = darkMode ? "#E8E8E8" : "#222222";
  const menuBorder = darkMode ? "#3A3A3A" : "#E8E2DF";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          background:   "transparent",
          border:       "none",
          cursor:       "pointer",
          padding:      "4px 8px",
          borderRadius: 6,
          color:        darkMode ? "#999" : "#666",
          fontSize:     18,
          lineHeight:   1,
          display:      "flex",
          alignItems:   "center",
        }}
        title="Options"
      >
        ⋮
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 10 }}
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          />
          <div
            style={{
              position:    "absolute",
              right:       0,
              top:         "100%",
              marginTop:   4,
              background:  menuBg,
              border:      `1px solid ${menuBorder}`,
              borderRadius: 10,
              boxShadow:   "0 8px 24px rgba(0,0,0,0.15)",
              zIndex:      20,
              minWidth:    140,
              overflow:    "hidden",
            }}
          >
            <MenuItem
              label="Preview"
              icon="👁"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onPreview?.(); }}
              color={menuText}
            />
            <div style={{ height: 1, background: menuBorder }} />
            <MenuItem
              label="Delete"
              icon="🗑"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete?.(); }}
              color="#CC0000"
            />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ label, icon, onClick, color }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display:     "flex",
        alignItems:  "center",
        gap:         8,
        width:       "100%",
        padding:     "10px 14px",
        background:  hover ? "#F5F0EE" : "transparent",
        border:      "none",
        cursor:      "pointer",
        color,
        fontSize:    13,
        fontFamily:  "'Inter', sans-serif",
        fontWeight:  500,
        textAlign:   "left",
        transition:  "background 0.15s",
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}
