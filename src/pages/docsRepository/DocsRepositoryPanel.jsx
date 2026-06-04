// SGA — Last updated: Addressed ⚠️ Bug 7.1 — Added an explicit RBAC comment block at the
// top of the component explaining why this panel has no auth guard of its own. This is
// an intentional architectural decision: DocsRepositoryPanel is a composed child component,
// not a route. Its only mount points are inside the Messaging page (Owner/SuperAdmin-only)
// and the DocsRepositoryPage (also Owner/SuperAdmin-only). Adding a redundant auth check
// here would be over-engineering that diverges from the app's established RBAC pattern
// where route-level guards are the single point of access control. No logic has been changed.
// ─────────────────────────────────────────────────────────
//  src/components/shared/DocsRepositoryPanel.jsx
//
//  ★ PHASE 8 INTEGRATION COMPONENT ★
//
//  A self-contained, reusable panel that opens inside the
//  Unified Messaging chat interface. Allows the Owner to
//  browse the Docs Repository and tap a document to send
//  it into the active chat conversation.
//
//  ── RBAC NOTE (⚠️ Bug 7.1 — addressed) ──────────────────
//  This panel component intentionally has NO auth/role guard
//  of its own. This is by design, not an oversight.
//
//  Reasoning:
//    1. This is a PANEL (child component), not a PAGE or ROUTE.
//       It is never rendered at the router level — only mounted
//       by parent components that are already role-gated:
//         • Messaging page  → Owner + SuperAdmin only
//         • DocsRepositoryPage → Owner + SuperAdmin only
//    2. The SGA RBAC pattern uses route-level ProtectedRoute
//       components as the single authoritative access check.
//       Duplicating role checks inside child components creates
//       divergent logic that can silently get out of sync with
//       the route-level rules.
//    3. The panel only exposes read-only browsing + a send callback
//       (`onSendDocument`). Sending itself is wired through the
//       messaging Cloud Function which has its own server-side
//       auth enforcement.
//
//  If this panel is ever embedded in a new page/route, ensure
//  that parent route uses ProtectedRoute with the correct role
//  restriction. Do not add a guard here.
//  ──────────────────────────────────────────────────────────
//
//  Usage in Phase 8 (Unified Messaging):
//
//    import DocsRepositoryPanel from "@/components/shared/DocsRepositoryPanel";
//
//    // In your chat component:
//    const [showDocsPanel, setShowDocsPanel] = useState(false);
//
//    // Trigger button in chat toolbar:
//    <button onClick={() => setShowDocsPanel(true)}>📎 Docs</button>
//
//    // Panel (renders as bottom sheet on mobile, side panel on desktop):
//    {showDocsPanel && (
//      <DocsRepositoryPanel
//        onSendDocument={(doc) => {
//          // doc = { fileName, fileUrl, fileType, fileSize, ... }
//          // Call your sendMessage(doc.fileUrl, doc.fileName) here
//          sendWhatsAppDocument(doc);
//          setShowDocsPanel(false);
//        }}
//        onClose={() => setShowDocsPanel(false)}
//        darkMode={darkMode}
//      />
//    )}
//
//  Props:
//    onSendDocument  fn(doc)  — called when user taps "Send" on a doc
//    onClose         fn()     — called when user dismisses the panel
//    darkMode        boolean
//    inline          boolean  — if true, renders without the overlay
//                               (for desktop side-panel embedding)
// ─────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { useDocsRepository } from "../../hooks/useDocsRepository";
import { getFileTypeColors, getFileTypeEmoji, formatFileSize } from "../../lib/fileHelpers";

export default function DocsRepositoryPanel({
  onSendDocument,
  onClose,
  darkMode = false,
  inline  = false,
}) {
  const { documents, categories, loading } = useDocsRepository();

  const [search,         setSearch]         = useState("");
  const [activeCategory, setActiveCategory] = useState("");

  const bg      = darkMode ? "#1A1A1A" : "#FFFFFF";
  const text     = darkMode ? "#E8E8E8" : "#222222";
  const subtext  = darkMode ? "#999999" : "#666666";
  const border   = darkMode ? "#3A3A3A" : "#E8E2DF";
  const itemBg   = darkMode ? "#2A2A2A" : "#F5F0EE";

  // ── Filtered documents ────────────────────────────────
  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchCat = !activeCategory || d.category === activeCategory;
      const matchSrc =
        !search.trim() ||
        d.fileName.toLowerCase().includes(search.toLowerCase()) ||
        (d.categoryName || "").toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSrc;
    });
  }, [documents, activeCategory, search]);

  // ─────────────────────────────────────────────────────
  //  Panel content
  // ─────────────────────────────────────────────────────
  const content = (
    <div
      style={{
        background:    bg,
        display:       "flex",
        flexDirection: "column",
        height:        "100%",
        borderRadius:  inline ? 0 : "20px 20px 0 0",
        overflow:      "hidden",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          background:   "#661F1F",
          padding:      "16px 16px 12px",
          flexShrink:   0,
          display:      "flex",
          alignItems:   "center",
          gap:          10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFFFFF", fontSize: 15, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
            📎 Docs Repository
          </div>
          <div style={{ color: "#F0BABA", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
            Tap any document to send
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.15)",
            border:     "none",
            borderRadius: 8,
            color:      "white",
            fontSize:   16,
            cursor:     "pointer",
            padding:    "4px 8px",
          }}
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "10px 12px 0", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#999", fontSize: 14 }}>
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            style={{
              width:       "100%",
              boxSizing:   "border-box",
              background:  darkMode ? "#2A2A2A" : "#F5F0EE",
              border:      `1.5px solid ${border}`,
              borderRadius: 8,
              padding:     "8px 30px 8px 32px",
              fontSize:    13,
              color:       text,
              fontFamily:  "'Inter', sans-serif",
              outline:     "none",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#999", cursor: "pointer", fontSize: 14 }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div
        style={{
          display:       "flex",
          gap:           6,
          overflowX:     "auto",
          padding:       "8px 12px",
          flexShrink:    0,
          scrollbarWidth: "none",
        }}
      >
        {[{ id: "", name: "All" }, ...categories].map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                flexShrink:  0,
                background:  isActive ? "#661F1F" : (darkMode ? "#2A2A2A" : "#F5F0EE"),
                color:       isActive ? "white" : subtext,
                border:      `1px solid ${isActive ? "#661F1F" : border}`,
                borderRadius: 16,
                padding:     "4px 11px",
                fontSize:    12,
                fontWeight:  isActive ? 700 : 500,
                cursor:      "pointer",
                fontFamily:  "'Inter', sans-serif",
                whiteSpace:  "nowrap",
                transition:  "all 0.15s",
              }}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      <div style={{ width: "100%", height: 1, background: border, flexShrink: 0 }} />

      {/* Document list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px 16px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "32px 0", color: subtext, fontSize: 14, fontFamily: "'Inter', sans-serif" }}>
            Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
            <div style={{ color: text, fontSize: 14, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
              {search ? "No matches found" : "No documents uploaded yet"}
            </div>
          </div>
        )}

        {!loading && filtered.map((doc) => (
          <PanelDocRow
            key={doc.id}
            doc={doc}
            onSend={() => onSendDocument(doc)}
            darkMode={darkMode}
            itemBg={itemBg}
            text={text}
            subtext={subtext}
            border={border}
          />
        ))}
      </div>
    </div>
  );

  // ─── Inline mode: just render the panel ────────────────
  if (inline) return content;

  // ─── Overlay mode: bottom sheet ──────────────────────
  return (
    <div
      style={{
        position:  "fixed",
        inset:     0,
        zIndex:    900,
        background: "rgba(0,0,0,0.5)",
        display:   "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width:     "100%",
          maxWidth:  560,
          height:    "70vh",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
        }}
      >
        {content}
      </div>
    </div>
  );
}

// ── Individual doc row inside the panel ───────────────────
function PanelDocRow({ doc, onSend, darkMode, itemBg, text, subtext, border }) {
  const [hover, setHover] = useState(false);
  const colors = getFileTypeColors(doc.fileType);
  const label  = getFileTypeEmoji(doc.fileType);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        padding:      "10px 10px",
        borderRadius: 10,
        marginBottom: 6,
        background:   hover ? (darkMode ? "#3A2A2A" : "#FDF5F5") : itemBg,
        border:       `1px solid ${hover ? "#661F1F44" : border}`,
        cursor:       "pointer",
        transition:   "all 0.15s",
      }}
      onClick={onSend}
    >
      {/* Type icon */}
      <div
        style={{
          width:      40,
          height:     40,
          borderRadius: 8,
          background: colors.bg,
          display:    "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ color: colors.icon, fontSize: 9, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>
          {label}
        </span>
      </div>

      {/* File info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color:        text,
            fontSize:     13,
            fontWeight:   600,
            fontFamily:   "'Inter', sans-serif",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
          }}
        >
          {doc.fileName}
        </div>
        <div style={{ color: subtext, fontSize: 11, fontFamily: "'Inter', sans-serif" }}>
          {[doc.categoryName || null, formatFileSize(doc.fileSize)].filter(Boolean).join(" · ")}
        </div>
      </div>

      {/* Send button */}
      <button
        onClick={(e) => { e.stopPropagation(); onSend(); }}
        style={{
          background:   hover ? "#661F1F" : "transparent",
          color:        hover ? "white" : "#661F1F",
          border:       `1.5px solid #661F1F`,
          borderRadius: 8,
          padding:      "5px 12px",
          fontSize:     12,
          fontWeight:   700,
          fontFamily:   "'Inter', sans-serif",
          cursor:       "pointer",
          transition:   "all 0.15s",
          flexShrink:   0,
        }}
      >
        Send
      </button>
    </div>
  );
}