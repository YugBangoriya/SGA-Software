// SGA — Last updated: Updated to use nested folder system (folderId instead of categoryId).
// Now uses useDocsRepository internally — no props needed for categories/upload function.
// Shows folder selector for choosing upload destination within the tree.
// src/pages/docsRepository/UploadModal.jsx
// Phase 7 — Docs Repository Module

import { useState, useRef, useCallback } from "react";
import {
  X, Upload, Folder, FolderOpen, Check, AlertTriangle,
  Loader2, ChevronDown, Home, FolderPlus,
} from "lucide-react";
import { useDocsRepository } from "../../hooks/useDocsRepository";
import {
  ACCEPTED_MIME_TYPES,
  validateFile,
  getFileType,
  getFileTypeColors,
  getFileTypeEmoji,
  formatFileSize,
} from "../../lib/fileHelpers";

// ─── Folder Selector dropdown ─────────────────────────────────────────────────
function FolderSelector({ folders, selectedFolderId, onSelect }) {
  const [open, setOpen] = useState(false);
  const selectedFolder  = folders.find((f) => f.id === selectedFolderId);

  // Build indented tree entries for the dropdown
  function buildTree(parentId, depth) {
    return folders
      .filter((f) => (f.parentId ?? null) === (parentId ?? null))
      .flatMap((f) => [{ folder: f, depth }, ...buildTree(f.id, depth + 1)]);
  }
  const treeEntries = buildTree(null, 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-11 px-3 rounded-xl border border-[#E8E2DF] bg-[#F5F0EE] text-sm
          font-sans flex items-center justify-between gap-2 outline-none
          hover:border-[#661F1F] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedFolderId
            ? <FolderOpen size={14} className="text-[#CC6600] flex-shrink-0" />
            : <Home       size={14} className="text-[#888] flex-shrink-0" />}
          <span className="truncate text-[#222]">
            {selectedFolder?.name ?? "Home (root folder)"}
          </span>
        </div>
        <ChevronDown size={14} className={`text-[#888] flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl
            shadow-2xl border border-[#E8E2DF] overflow-hidden max-h-56 overflow-y-auto">
            {/* Root option */}
            <button
              onClick={() => { onSelect(null); setOpen(false); }}
              className={`w-full px-4 py-3 text-left text-sm font-sans flex items-center gap-2
                transition-colors border-b border-[#F0EBE8]
                ${selectedFolderId === null ? "bg-[#FDF0F0] text-[#661F1F] font-semibold" : "hover:bg-[#F5F0EE] text-[#333]"}`}
            >
              <Home size={13} /> Home (root)
              {selectedFolderId === null && <Check size={13} className="ml-auto text-[#661F1F]" />}
            </button>
            {/* Folder tree entries */}
            {treeEntries.map(({ folder, depth }) => (
              <button
                key={folder.id}
                onClick={() => { onSelect(folder.id); setOpen(false); }}
                className={`w-full px-4 py-2.5 text-left text-sm font-sans flex items-center gap-2
                  transition-colors
                  ${selectedFolderId === folder.id ? "bg-[#FDF0F0] text-[#661F1F] font-semibold" : "hover:bg-[#F5F0EE] text-[#333]"}`}
                style={{ paddingLeft: `${16 + depth * 16}px` }}
              >
                <Folder size={13} className="text-[#CC6600] flex-shrink-0" />
                <span className="truncate">{folder.name}</span>
                {selectedFolderId === folder.id && (
                  <Check size={13} className="ml-auto text-[#661F1F] flex-shrink-0" />
                )}
              </button>
            ))}
            {folders.length === 0 && (
              <p className="px-4 py-3 text-xs text-[#AAA] font-sans italic">No folders created yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function UploadModal({ folderId: initialFolderId = null, onClose, onSuccess }) {
  const { folders, uploadDocument } = useDocsRepository();

  const [dragOver,       setDragOver]       = useState(false);
  const [file,           setFile]           = useState(null);
  const [customName,     setCustomName]     = useState("");
  const [selectedFolder, setSelectedFolder] = useState(initialFolderId ?? null);
  const [progress,       setProgress]       = useState(null); // null | 0–100
  const [error,          setError]          = useState("");
  const [success,        setSuccess]        = useState(false);
  const fileInputRef = useRef(null);

  const isUploading = progress !== null;

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFile = useCallback((f) => {
    setError("");
    setSuccess(false);
    const { valid, error: err } = validateFile(f);
    if (!valid) { setError(err); return; }
    setFile(f);
    setCustomName(f.name.replace(/\.[^.]+$/, ""));
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

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) { setError("Please select a file first."); return; }
    setError("");
    setProgress(0);
    try {
      await uploadDocument(file, selectedFolder || "", customName, (pct) => setProgress(pct));
      setSuccess(true);
      setProgress(null);
      // Auto-reset for another upload
      setTimeout(() => {
        setFile(null);
        setCustomName("");
        setSuccess(false);
        onSuccess?.();
      }, 1800);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
      setProgress(null);
    }
  };

  const fileColors = file ? getFileTypeColors(getFileType(file.name)) : null;
  const fileEmoji  = file ? getFileTypeEmoji(getFileType(file.name)) : null;

  const selectedFolderName = folders.find((f) => f.id === selectedFolder)?.name;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !isUploading) onClose(); }}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[92vh]
        overflow-y-auto shadow-2xl">
        <div className="p-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#661F1F]">Upload Document</h2>
              <p className="text-xs text-[#888] font-sans mt-1">
                PDF · Images · Word · Excel · Video — max 50 MB
              </p>
            </div>
            {!isUploading && (
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#F5F0EE] flex items-center justify-center
                  text-[#888] hover:bg-[#E8E2DF] transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Drop zone — only when no file selected */}
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
                transition-all mb-5
                ${dragOver
                  ? "border-[#661F1F] bg-[#FDF5F5]"
                  : "border-[#E8E2DF] bg-[#FAFAF8] hover:border-[#8B3A3A] hover:bg-[#FDF8F8]"}`}
            >
              <Upload size={36} className={`mx-auto mb-3 ${dragOver ? "text-[#661F1F]" : "text-[#CCC]"}`} />
              <p className="text-sm font-bold text-[#333] font-sans mb-1">
                {dragOver ? "Drop to upload" : "Tap to browse or drag & drop"}
              </p>
              <p className="text-xs text-[#AAA] font-sans">
                PDF · JPG · PNG · MP4 · DOC · XLSX and more
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIME_TYPES}
                className="hidden"
                onChange={onInputChange}
              />
            </div>
          ) : (
            /* Selected file preview */
            <div
              className="flex items-center gap-3 rounded-2xl p-4 mb-5 border"
              style={{
                background:   fileColors?.bg   ?? "#F5F0EE",
                borderColor: (fileColors?.icon ?? "#888") + "33",
              }}
            >
              <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center
                flex-shrink-0 text-xs font-mono font-bold"
                style={{ color: fileColors?.icon }}>
                {fileEmoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#222] font-sans truncate">{file.name}</p>
                <p className="text-xs text-[#666] font-sans mt-0.5">{formatFileSize(file.size)}</p>
              </div>
              {!isUploading && (
                <button onClick={() => { setFile(null); setCustomName(""); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#888]
                    hover:bg-white/80 transition-colors flex-shrink-0">
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Form fields — only when file selected */}
          {file && (
            <div className="flex flex-col gap-4">
              {/* Display name */}
              <div>
                <label className="block text-xs font-semibold text-[#444] font-sans mb-1.5">
                  Display Name
                </label>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  disabled={isUploading}
                  placeholder="Document display name…"
                  className="w-full h-11 px-3 rounded-xl border border-[#E8E2DF] bg-[#F5F0EE]
                    text-sm font-sans text-[#222] outline-none
                    focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10
                    disabled:opacity-50 transition-all"
                />
              </div>

              {/* Folder selector */}
              <div>
                <label className="block text-xs font-semibold text-[#444] font-sans mb-1.5 flex items-center gap-1.5">
                  <FolderOpen size={12} className="text-[#CC6600]" />
                  Upload to Folder
                </label>
                <FolderSelector
                  folders={folders}
                  selectedFolderId={selectedFolder}
                  onSelect={setSelectedFolder}
                />
                {selectedFolderName && (
                  <p className="text-xs text-[#888] font-sans mt-1.5">
                    → Will be saved in: <strong className="text-[#661F1F]">{selectedFolderName}</strong>
                  </p>
                )}
                {!selectedFolder && (
                  <p className="text-xs text-[#888] font-sans mt-1.5">
                    → Will be saved in the <strong>root (Home)</strong> folder
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#333] font-sans">Uploading…</span>
                <span className="text-sm font-bold text-[#661F1F] font-mono">{progress}%</span>
              </div>
              <div className="h-2 bg-[#E8E2DF] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#661F1F] to-[#8B3A3A] rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div className="mt-4 flex items-center gap-2 bg-[#E8F5E9] border border-[#A5D6A7]
              rounded-xl px-4 py-3">
              <Check size={16} className="text-[#1A7A1A] flex-shrink-0" />
              <p className="text-sm text-[#1A7A1A] font-semibold font-sans">
                Document uploaded successfully!
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-center gap-2 bg-[#FFEBEE] border border-[#F0B8B8]
              rounded-xl px-4 py-3">
              <AlertTriangle size={14} className="text-[#CC0000] flex-shrink-0" />
              <p className="text-sm text-[#CC0000] font-sans">{error}</p>
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex flex-col gap-3 mt-6">
            {file && !isUploading && !success && (
              <button
                onClick={handleUpload}
                className="w-full h-12 rounded-xl bg-[#661F1F] text-white font-bold font-sans
                  text-sm hover:bg-[#8B3A3A] active:bg-[#5A1515] transition-colors
                  shadow-lg shadow-[#661F1F]/25 flex items-center justify-center gap-2"
              >
                <Upload size={16} /> Upload Document
              </button>
            )}

            {!file && !isUploading && (
              <button
                onClick={onClose}
                className="w-full h-11 rounded-xl border border-[#E8E2DF] text-sm font-semibold
                  font-sans text-[#666] hover:bg-[#F5F0EE] transition-colors"
              >
                Cancel
              </button>
            )}

            {isUploading && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 size={16} className="text-[#661F1F] animate-spin" />
                <span className="text-sm text-[#888] font-sans">Please wait…</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}