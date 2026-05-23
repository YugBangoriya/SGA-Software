// ─────────────────────────────────────────────────────────
//  src/pages/DocsRepository/components/PreviewModal.jsx
//
//  Inline document preview modal.
//  • PDF  → <iframe> with Google Docs viewer fallback
//  • Image → <img> with zoom support
//  • Video → <video> tag
//  • Other → download prompt
// ─────────────────────────────────────────────────────────
import { useState } from "react";
import { FILE_TYPES, getFileType, formatFileSize } from "../../lib/fileHelpers";

export default function PreviewModal({ doc, onClose, onDelete, darkMode = false }) {
  const [imgZoom,    setImgZoom]    = useState(false);
  const [iframeErr,  setIframeErr]  = useState(false);

  const fileType = getFileType(doc.fileName);
  const bg       = darkMode ? "#1A1A1A" : "#FFFFFF";
  const text     = darkMode ? "#E8E8E8" : "#222222";
  const subtext  = darkMode ? "#999999" : "#666666";
  const headerBg = darkMode ? "#2A2A2A" : "#F5F0EE";
  const border   = darkMode ? "#3A3A3A" : "#E8E2DF";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.75)",
        display: "flex", flexDirection: "column",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: bg,
          width: "100%",
          maxWidth: 800,
          margin: "auto",
          borderRadius: 16,
          overflow: "hidden",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: headerBg,
            borderBottom: `1px solid ${border}`,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: text,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "'Inter', sans-serif",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {doc.fileName}
            </div>
            <div style={{ color: subtext, fontSize: 12, fontFamily: "'Inter', sans-serif", marginTop: 2 }}>
              {[
                doc.categoryName || null,
                formatFileSize(doc.fileSize),
                doc.uploadedByName ? `Uploaded by ${doc.uploadedByName}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {/* Download */}
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={doc.fileName}
              style={{
                background: darkMode ? "#3A3A3A" : "#F0EAE8",
                border: "none",
                borderRadius: 8,
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                color: "#661F1F",
                cursor: "pointer",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              ↓ Download
            </a>

            {/* Delete */}
            {onDelete && (
              <button
                onClick={() => { onClose(); onDelete(doc); }}
                style={{
                  background: "#FFEBEE",
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif",
                  color: "#CC0000",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: `1px solid ${border}`,
                borderRadius: 8,
                padding: "7px 12px",
                fontSize: 14,
                color: subtext,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Preview body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            background: darkMode ? "#111111" : "#F5F0EE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 300,
          }}
        >
          {fileType === FILE_TYPES.PDF && !iframeErr && (
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(doc.fileUrl)}&embedded=true`}
              style={{ width: "100%", height: "70vh", border: "none" }}
              title={doc.fileName}
              onError={() => setIframeErr(true)}
            />
          )}

          {fileType === FILE_TYPES.PDF && iframeErr && (
            <FallbackPrompt doc={doc} text={text} subtext={subtext} />
          )}

          {fileType === FILE_TYPES.IMAGE && (
            <div
              style={{ padding: 20, cursor: imgZoom ? "zoom-out" : "zoom-in" }}
              onClick={() => setImgZoom(!imgZoom)}
              title={imgZoom ? "Click to zoom out" : "Click to zoom in"}
            >
              <img
                src={doc.fileUrl}
                alt={doc.fileName}
                style={{
                  maxWidth:  imgZoom ? "none" : "100%",
                  maxHeight: imgZoom ? "none" : "68vh",
                  width:     imgZoom ? "auto" : undefined,
                  borderRadius: 8,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                  transition: "max-width 0.3s, max-height 0.3s",
                }}
              />
              <div style={{ textAlign: "center", marginTop: 8, color: subtext, fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
                {imgZoom ? "Click to zoom out" : "Click to zoom in"}
              </div>
            </div>
          )}

          {fileType === FILE_TYPES.VIDEO && (
            <video
              src={doc.fileUrl}
              controls
              style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8 }}
            />
          )}

          {![FILE_TYPES.PDF, FILE_TYPES.IMAGE, FILE_TYPES.VIDEO].includes(fileType) && (
            <FallbackPrompt doc={doc} text={text} subtext={subtext} />
          )}
        </div>
      </div>
    </div>
  );
}

function FallbackPrompt({ doc, text, subtext }) {
  return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
      <div style={{ color: text, fontSize: 16, fontWeight: 600, fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>
        Preview not available
      </div>
      <div style={{ color: subtext, fontSize: 14, fontFamily: "'Inter', sans-serif", marginBottom: 24 }}>
        This file type cannot be previewed inline.
      </div>
      <a
        href={doc.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: "#661F1F",
          color: "white",
          textDecoration: "none",
          borderRadius: 10,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        Open / Download File
      </a>
    </div>
  );
}
