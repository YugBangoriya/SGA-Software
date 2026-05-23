// ─────────────────────────────────────────────────────────
//  src/pages/DocsRepository/components/UploadModal.jsx
//
//  Full-screen modal for uploading documents.
//  Features:
//    • Drag-and-drop + click-to-browse
//    • File name override input
//    • Category selector (existing + quick-add)
//    • Upload progress bar
//    • Validation (size, type)
// ─────────────────────────────────────────────────────────
import { useState, useRef, useCallback } from "react";
import {
  ACCEPTED_MIME_TYPES,
  validateFile,
  getFileType,
  getFileTypeColors,
  getFileTypeEmoji,
  formatFileSize,
} from "../../lib/fileHelpers";

export default function UploadModal({
  categories = [],
  onUpload,           // async fn(file, categoryId, customName, onProgress)
  onClose,
  darkMode = false,
}) {
  const [dragOver,    setDragOver]    = useState(false);
  const [file,        setFile]        = useState(null);
  const [customName,  setCustomName]  = useState("");
  const [categoryId,  setCategoryId]  = useState("");
  const [progress,    setProgress]    = useState(null); // null | 0-100
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const [showNewCat,  setShowNewCat]  = useState(false);
  const fileInputRef = useRef(null);

  const bg      = darkMode ? "#1A1A1A" : "#FFFFFF";
  const overlay = "rgba(0,0,0,0.55)";
  const text     = darkMode ? "#E8E8E8" : "#222222";
  const subtext  = darkMode ? "#999999" : "#666666";
  const border   = darkMode ? "#3A3A3A" : "#E8E2DF";
  const inputBg  = darkMode ? "#2A2A2A" : "#F5F0EE";

  // ── File selection ────────────────────────────────────
  const handleFile = useCallback((f) => {
    setError("");
    setSuccess(false);
    const { valid, error: err } = validateFile(f);
    if (!valid) { setError(err); return; }
    setFile(f);
    setCustomName(f.name.replace(/\.[^.]+$/, "")); // strip extension
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // ── Upload ────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) { setError("Please select a file first."); return; }
    setError("");
    setProgress(0);

    try {
      await onUpload(file, categoryId, customName, (pct) => setProgress(pct));
      setSuccess(true);
      setProgress(null);
      // Reset form for another upload
      setTimeout(() => {
        setFile(null);
        setCustomName("");
        setCategoryId("");
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
      setProgress(null);
    }
  };

  const fileColors  = file ? getFileTypeColors(getFileType(file.name)) : null;
  const fileLabel   = file ? getFileTypeEmoji(getFileType(file.name)) : null;
  const isUploading = progress !== null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: overlay,
        display: "flex", alignItems: "flex-end",
        justifyContent: "center",
        padding: 0,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isUploading) onClose(); }}
    >
      <div
        style={{
          background: bg,
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 560,
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "28px 24px 40px",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, color: "#661F1F", fontSize: 20, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
              Upload Document
            </h2>
            <p style={{ margin: "4px 0 0", color: subtext, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
              PDF, images, video, Word, Excel — max 50 MB
            </p>
          </div>
          {!isUploading && (
            <button
              onClick={onClose}
              style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 22, color: subtext, lineHeight: 1, padding: 4 }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Drop Zone */}
        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "#661F1F" : border}`,
              borderRadius: 14,
              padding: "36px 24px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver
                ? (darkMode ? "#2A1A1A" : "#FDF5F5")
                : (darkMode ? "#2A2A2A" : "#FAFAF8"),
              transition: "all 0.2s",
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
            <div style={{ color: text, fontSize: 15, fontWeight: 600, fontFamily: "'Inter', sans-serif", marginBottom: 6 }}>
              {dragOver ? "Drop it here" : "Tap to browse or drag & drop"}
            </div>
            <div style={{ color: subtext, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
              PDF · JPG · PNG · MP4 · DOC · XLSX and more
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MIME_TYPES}
              style={{ display: "none" }}
              onChange={onInputChange}
            />
          </div>
        ) : (
          /* File preview strip */
          <div
            style={{
              display: "flex", alignItems: "center", gap: 14,
              background: fileColors?.bg,
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 20,
              border: `1.5px solid ${fileColors?.icon}22`,
            }}
          >
            <div
              style={{
                width: 44, height: 44,
                background: "rgba(255,255,255,0.7)",
                borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 10,
                color: fileColors?.icon,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: 1,
                flexShrink: 0,
              }}
            >
              {fileLabel}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#222", fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </div>
              <div style={{ color: "#666", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
                {formatFileSize(file.size)}
              </div>
            </div>
            {!isUploading && (
              <button
                onClick={() => { setFile(null); setCustomName(""); }}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#999", fontSize: 16, padding: 4 }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Form Fields */}
        {file && (
          <>
            {/* Display Name */}
            <label style={labelStyle(subtext)}>Display Name</label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              disabled={isUploading}
              placeholder="Document display name..."
              style={inputStyle(inputBg, border, text, darkMode)}
            />

            {/* Category */}
            <label style={labelStyle(subtext)}>Category (optional)</label>
            {!showNewCat ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isUploading}
                  style={{ ...inputStyle(inputBg, border, text, darkMode), marginBottom: 0, flex: 1 }}
                >
                  <option value="">— No Category —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowNewCat(true)}
                  disabled={isUploading}
                  style={{
                    background: "transparent",
                    border: `1.5px solid #661F1F`,
                    color: "#661F1F",
                    borderRadius: 8,
                    padding: "0 14px",
                    fontSize: 12, fontWeight: 600,
                    fontFamily: "'Inter', sans-serif",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  + New
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  placeholder="New category name..."
                  autoFocus
                  style={{ ...inputStyle(inputBg, border, text, darkMode), marginBottom: 0, flex: 1 }}
                />
                <button
                  onClick={() => {
                    // The category is created inline via parent in the main page
                    // Here we just pass back the name — parent calls addCategory
                    if (newCatInput.trim()) {
                      // Emit the new category name to parent for creation
                      // For simplicity, we store it as a special "new:xxx" value
                      setCategoryId(`__new__:${newCatInput.trim()}`);
                    }
                    setShowNewCat(false);
                  }}
                  style={{
                    background: "#661F1F", color: "white",
                    border: "none", borderRadius: 8,
                    padding: "0 14px", fontSize: 12, fontWeight: 600,
                    fontFamily: "'Inter', sans-serif", cursor: "pointer",
                  }}
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowNewCat(false); setNewCatInput(""); }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#999", fontSize: 16 }}
                >
                  ✕
                </button>
              </div>
            )}
          </>
        )}

        {/* New cat display */}
        {categoryId.startsWith("__new__:") && (
          <div style={{ marginBottom: 16, fontSize: 12, color: "#1A7A1A", fontFamily: "'Inter', sans-serif" }}>
            ✓ New category "{categoryId.replace("__new__:", "")}" will be created on upload
          </div>
        )}

        {/* Progress */}
        {isUploading && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: text, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>Uploading…</span>
              <span style={{ color: "#661F1F", fontSize: 13, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>{progress}%</span>
            </div>
            <div style={{ background: darkMode ? "#3A3A3A" : "#E8E2DF", borderRadius: 50, height: 8, overflow: "hidden" }}>
              <div
                style={{
                  background: "linear-gradient(90deg, #661F1F, #8B3A3A)",
                  width: `${progress}%`,
                  height: "100%",
                  borderRadius: 50,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{ background: "#E8F5E9", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#1A7A1A", fontSize: 14, fontFamily: "'Inter', sans-serif", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            ✓ Document uploaded successfully!
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "#FFEBEE", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#CC0000", fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
            {error}
          </div>
        )}

        {/* Upload button */}
        {file && !isUploading && !success && (
          <button
            onClick={handleUpload}
            style={{
              width: "100%",
              background: "#661F1F",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "14px 0",
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Inter', sans-serif",
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            Upload Document
          </button>
        )}

        {!file && (
          <button
            onClick={onClose}
            style={{
              width: "100%",
              background: "transparent",
              color: subtext,
              border: `1.5px solid ${border}`,
              borderRadius: 10,
              padding: "12px 0",
              fontSize: 14,
              fontFamily: "'Inter', sans-serif",
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────
function labelStyle(color) {
  return {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color,
    fontFamily: "'Inter', sans-serif",
    marginBottom: 6,
    letterSpacing: 0.3,
  };
}

function inputStyle(bg, border, text, darkMode) {
  return {
    width: "100%",
    boxSizing: "border-box",
    background: bg,
    border: `1.5px solid ${border}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: text,
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    marginBottom: 16,
    appearance: "none",
    WebkitAppearance: "none",
  };
}
