// SGA — Last updated: Complete redesign — Windows File Explorer-style nested folders.
// Left panel: folder tree (categories + nested docsFolders). Right panel: files in
// current folder. Breadcrumb navigation, create/rename/delete folders, upload to any
// folder, move files between folders. Backward compatible with legacy docsCategories.
// src/pages/docsRepository/DocsRepositoryPage.jsx
// Phase 7 — Docs Repository Module

import { useState, useCallback, useRef } from "react";
import {
  FolderOpen, Folder, File, FileText, Image, Upload, Plus,
  Trash2, ChevronRight, MoreVertical, X, Check, Search,
  Home, Loader2, AlertTriangle, FolderPlus, Edit3, Eye,
  ChevronDown, Download,
} from "lucide-react";
import { useDocsRepository } from "../../hooks/useDocsRepository";
import { useAuth } from "../../hooks/useAuth";
import HomeButton from "../../components/ui/HomeButton";
import PreviewModal from "./PreviewModal";
import UploadModal from "./UploadModal";

// ─── File type icon ───────────────────────────────────────────────────────────
function FileIcon({ fileType, size = 18 }) {
  if (fileType === "image") return <Image size={size} className="text-[#0055CC]" />;
  if (fileType === "pdf")   return <FileText size={size} className="text-[#CC0000]" />;
  return <File size={size} className="text-[#666]" />;
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Folder tree node ─────────────────────────────────────────────────────────
function FolderNode({
  folder, depth, activeFolderId, onSelect,
  subFolders, allDocuments, onRename, onDelete, isOwnerOrAbove,
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const children = subFolders(folder.id);
  const hasChildren = children.length > 0;
  const docCount = allDocuments.filter((d) => d.folderId === folder.id).length;
  const isActive = activeFolderId === folder.id;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer
          transition-all relative
          ${isActive ? "bg-[#FDF0F0] text-[#661F1F]" : "hover:bg-[#F5F0EE] text-[#333]"}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand/collapse arrow */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="w-4 h-4 flex items-center justify-center flex-shrink-0"
          >
            {expanded
              ? <ChevronDown size={11} className="text-[#888]" />
              : <ChevronRight size={11} className="text-[#888]" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Folder icon + name */}
        <div
          className="flex items-center gap-2 flex-1 min-w-0"
          onClick={() => { onSelect(folder.id); setExpanded(true); }}
        >
          {isActive || expanded
            ? <FolderOpen size={15} className={isActive ? "text-[#661F1F]" : "text-[#CC6600]"} />
            : <Folder     size={15} className="text-[#CC6600]" />}
          <span className={`text-[13px] truncate font-sans flex-1
            ${isActive ? "font-bold text-[#661F1F]" : "font-medium"}`}>
            {folder.name}
          </span>
          {docCount > 0 && (
            <span className="text-[10px] text-[#AAA] font-sans flex-shrink-0">{docCount}</span>
          )}
        </div>

        {/* Context menu */}
        {isOwnerOrAbove && (
          <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#E8E2DF]"
            >
              <MoreVertical size={12} className="text-[#888]" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-6 z-20 bg-white rounded-xl shadow-2xl
                  border border-[#E8E2DF] overflow-hidden min-w-[130px]">
                  <button
                    onClick={() => { setMenuOpen(false); onRename(folder); }}
                    className="w-full px-3 py-2.5 text-xs text-[#333] font-sans hover:bg-[#F5F0EE]
                      flex items-center gap-2 transition-colors"
                  >
                    <Edit3 size={12} /> Rename
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(folder); }}
                    className="w-full px-3 py-2.5 text-xs text-[#CC0000] font-sans hover:bg-[#FFEBEE]
                      flex items-center gap-2 transition-colors"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && children.map((child) => (
        <FolderNode
          key={child.id}
          folder={child}
          depth={depth + 1}
          activeFolderId={activeFolderId}
          onSelect={onSelect}
          subFolders={subFolders}
          allDocuments={allDocuments}
          onRename={onRename}
          onDelete={onDelete}
          isOwnerOrAbove={isOwnerOrAbove}
        />
      ))}
    </div>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────
function DeleteModal({ title, message, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-[#FFEBEE] flex items-center justify-center">
            <Trash2 size={20} className="text-[#CC0000]" />
          </div>
        </div>
        <h3 className="text-base font-bold text-[#222] text-center mb-2">{title}</h3>
        <p className="text-sm text-[#666] font-sans text-center mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 h-11 rounded-xl border border-[#E8E2DF] text-sm font-semibold
              text-[#444] hover:bg-[#F5F0EE] transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 h-11 rounded-xl bg-[#CC0000] text-white text-sm font-bold
              hover:bg-[#AA0000] transition-colors disabled:opacity-50 flex items-center
              justify-center gap-2">
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : null}
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New/Rename folder modal ──────────────────────────────────────────────────
function FolderNameModal({ title, defaultValue = "", onConfirm, onCancel, isSaving }) {
  const [name, setName] = useState(defaultValue);
  const [err, setErr]   = useState("");

  const handleConfirm = () => {
    if (!name.trim()) { setErr("Folder name cannot be empty"); return; }
    onConfirm(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-base font-bold text-[#222] mb-4">{title}</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value); setErr(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); if (e.key === "Escape") onCancel(); }}
          placeholder="Folder name…"
          className="w-full h-11 px-3 rounded-xl border border-[#E8E2DF] text-sm font-sans
            text-[#222] outline-none focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10
            mb-2 transition-all"
        />
        {err && <p className="text-xs text-[#CC0000] font-sans mb-2">{err}</p>}
        <div className="flex gap-3 mt-3">
          <button onClick={onCancel} disabled={isSaving}
            className="flex-1 h-11 rounded-xl border border-[#E8E2DF] text-sm font-semibold
              text-[#444] hover:bg-[#F5F0EE] transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={isSaving}
            className="flex-1 h-11 rounded-xl bg-[#661F1F] text-white text-sm font-bold
              hover:bg-[#8B3A3A] transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DocsRepositoryPage() {
  const { isOwnerOrAbove } = useAuth();

  const {
    documents, folders, loading, error,
    uploadDocument, deleteDocument,
    createFolder, renameFolder, deleteFolder,
    getDocumentsInFolder, getSubFolders, getFolderBreadcrumb,
  } = useDocsRepository();

  // ── Navigation state ──────────────────────────────────────────────────────
  const [activeFolderId, setActiveFolderId]   = useState(null); // null = root
  const [searchQuery,    setSearchQuery]      = useState("");

  // ── UI modals state ───────────────────────────────────────────────────────
  const [showUpload,      setShowUpload]      = useState(false);
  const [previewDoc,      setPreviewDoc]      = useState(null);

  // ── Folder action state ───────────────────────────────────────────────────
  const [folderModal,     setFolderModal]     = useState(null); // { type: "create"|"rename", folder? }
  const [deleteTarget,    setDeleteTarget]    = useState(null); // { type: "folder"|"doc", item }
  const [actionLoading,   setActionLoading]   = useState(false);
  const [actionError,     setActionError]     = useState(null);

  // ── Left sidebar toggle (mobile) ──────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Derived state ─────────────────────────────────────────────────────────
  const breadcrumb  = getFolderBreadcrumb(activeFolderId);
  const rootFolders = getSubFolders(null);

  // Current view: search overrides folder view
  const currentDocs = searchQuery.trim()
    ? documents.filter((d) =>
        d.fileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.folderName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : getDocumentsInFolder(activeFolderId);

  const currentSubFolders = searchQuery.trim() ? [] : getSubFolders(activeFolderId);

  // ── Folder handlers ───────────────────────────────────────────────────────
  const handleCreateFolder = async (name) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const newId = await createFolder(name, activeFolderId);
      setFolderModal(null);
      setActiveFolderId(newId);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenameFolder = async (name) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await renameFolder(folderModal.folder.id, name);
      setFolderModal(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteFolder = async () => {
    setActionLoading(true);
    try {
      // Navigate up before deleting
      if (activeFolderId === deleteTarget.item.id) {
        setActiveFolderId(deleteTarget.item.parentId ?? null);
      }
      await deleteFolder(deleteTarget.item.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDoc = async () => {
    setActionLoading(true);
    try {
      await deleteDocument(deleteTarget.item);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadDone = () => setShowUpload(false);

  // ── Drag-to-upload ────────────────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);
  const dragRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && isOwnerOrAbove) setShowUpload(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#CDCBC9] flex flex-col">

      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-30 bg-[#661F1F] shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <HomeButton />
          <div className="flex-1 min-w-0">
            <p className="text-[#F0BABA] text-[10px] font-sans tracking-widest uppercase">Repository</p>
            <h1 className="text-white text-lg font-bold leading-tight">Documents</h1>
          </div>
          {/* Search */}
          <div className="relative flex-1 max-w-xs hidden sm:block">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files…"
              className="w-full h-9 pl-8 pr-8 rounded-lg text-sm font-sans text-white
                placeholder-white/50 outline-none"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>
          {/* Mobile sidebar toggle */}
          <button onClick={() => setSidebarOpen((v) => !v)}
            className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-white
              hover:bg-white/25 transition-colors lg:hidden">
            <Folder size={16} />
          </button>
          {/* Upload button */}
          {isOwnerOrAbove && (
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-white/15 text-white rounded-xl px-3 py-2
                text-xs font-semibold font-sans hover:bg-white/25 transition-colors">
              <Upload size={14} />
              <span className="hidden sm:inline">Upload</span>
            </button>
          )}
        </div>
        {/* Mobile search */}
        <div className="sm:hidden px-4 pb-3">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files…"
              className="w-full h-9 pl-8 pr-3 rounded-lg text-sm font-sans text-white
                placeholder-white/50 outline-none"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}
            />
          </div>
        </div>
      </div>

      {/* ── Body: sidebar + main ── */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full overflow-hidden">

        {/* ── LEFT: Folder tree ── */}
        <aside className={`
          ${sidebarOpen ? "flex" : "hidden"} lg:flex
          flex-col w-64 flex-shrink-0 bg-white border-r border-[#E8E2DF]
          overflow-y-auto
        `}>
          <div className="p-3 border-b border-[#E8E2DF] flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#888] font-sans uppercase tracking-widest">Folders</span>
            {isOwnerOrAbove && (
              <button
                onClick={() => setFolderModal({ type: "create" })}
                title="New folder"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#888]
                  hover:bg-[#F5F0EE] hover:text-[#661F1F] transition-colors"
              >
                <FolderPlus size={14} />
              </button>
            )}
          </div>

          {/* Root (Home) */}
          <div
            onClick={() => { setActiveFolderId(null); setSidebarOpen(false); }}
            className={`flex items-center gap-2 py-2 px-3 cursor-pointer transition-all
              ${activeFolderId === null
                ? "bg-[#FDF0F0] text-[#661F1F] font-bold"
                : "hover:bg-[#F5F0EE] text-[#333]"}`}
          >
            <Home size={14} className={activeFolderId === null ? "text-[#661F1F]" : "text-[#888]"} />
            <span className="text-[13px] font-sans">Home</span>
            <span className="ml-auto text-[10px] text-[#AAA] font-sans">
              {documents.filter((d) => !d.folderId || d.folderId === "").length}
            </span>
          </div>

          {/* Folder tree */}
          <div className="p-1 flex-1">
            {rootFolders.map((folder) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                depth={0}
                activeFolderId={activeFolderId}
                onSelect={(id) => { setActiveFolderId(id); setSidebarOpen(false); }}
                subFolders={getSubFolders}
                allDocuments={documents}
                onRename={(f) => setFolderModal({ type: "rename", folder: f })}
                onDelete={(f) => setDeleteTarget({ type: "folder", item: f })}
                isOwnerOrAbove={isOwnerOrAbove}
              />
            ))}
            {rootFolders.length === 0 && !loading && (
              <p className="text-xs text-[#AAA] font-sans text-center py-6 px-3">
                No folders yet.{isOwnerOrAbove ? " Create one with the + button above." : ""}
              </p>
            )}
          </div>
        </aside>

        {/* ── RIGHT: File browser ── */}
        <main
          ref={dragRef}
          onDragOver={(e) => { e.preventDefault(); if (isOwnerOrAbove) setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`flex-1 overflow-y-auto transition-all ${isDragOver ? "bg-[#FDF0F0]" : ""}`}
        >
          {/* Drag overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-40 bg-[#661F1F]/10 border-4 border-dashed border-[#661F1F]
              flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-2xl px-8 py-6 shadow-xl text-center">
                <Upload size={32} className="text-[#661F1F] mx-auto mb-2" />
                <p className="text-base font-bold text-[#661F1F]">Drop to upload</p>
              </div>
            </div>
          )}

          <div className="p-4">
            {/* Breadcrumb */}
            {!searchQuery && (
              <div className="flex items-center gap-1 mb-4 flex-wrap">
                <button
                  onClick={() => setActiveFolderId(null)}
                  className={`flex items-center gap-1 text-xs font-semibold font-sans
                    transition-colors px-2 py-1 rounded-lg
                    ${activeFolderId === null
                      ? "text-[#661F1F] bg-[#FDF0F0]"
                      : "text-[#888] hover:text-[#661F1F] hover:bg-[#FDF0F0]"}`}
                >
                  <Home size={11} /> Home
                </button>
                {breadcrumb.map((folder, i) => (
                  <div key={folder.id} className="flex items-center gap-1">
                    <ChevronRight size={11} className="text-[#CCC]" />
                    <button
                      onClick={() => setActiveFolderId(folder.id)}
                      className={`text-xs font-semibold font-sans px-2 py-1 rounded-lg
                        transition-colors
                        ${activeFolderId === folder.id
                          ? "text-[#661F1F] bg-[#FDF0F0]"
                          : "text-[#888] hover:text-[#661F1F] hover:bg-[#FDF0F0]"}`}
                    >
                      {folder.name}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search result header */}
            {searchQuery && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[#888] font-sans">
                  {currentDocs.length} result{currentDocs.length !== 1 ? "s" : ""} for "{searchQuery}"
                </p>
                <button onClick={() => setSearchQuery("")}
                  className="text-xs text-[#661F1F] font-semibold font-sans hover:underline">
                  Clear
                </button>
              </div>
            )}

            {/* Toolbar */}
            {!searchQuery && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {isOwnerOrAbove && (
                  <>
                    <button
                      onClick={() => setFolderModal({ type: "create" })}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white border
                        border-[#E8E2DF] text-xs font-semibold font-sans text-[#333]
                        hover:bg-[#F5F0EE] hover:border-[#8B3A3A] hover:text-[#661F1F] transition-all"
                    >
                      <FolderPlus size={13} /> New Folder
                    </button>
                    <button
                      onClick={() => setShowUpload(true)}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#661F1F]
                        text-white text-xs font-semibold font-sans hover:bg-[#8B3A3A] transition-colors"
                    >
                      <Upload size={13} /> Upload File
                    </button>
                  </>
                )}
                <span className="ml-auto text-xs text-[#888] font-sans">
                  {currentSubFolders.length} folder{currentSubFolders.length !== 1 ? "s" : ""},&nbsp;
                  {currentDocs.length} file{currentDocs.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-20 gap-3">
                <Loader2 size={22} className="text-[#661F1F] animate-spin" />
                <span className="text-sm text-[#888] font-sans">Loading…</span>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="flex items-center gap-2 bg-[#FFEBEE] border border-[#F0B8B8] rounded-xl p-4 mb-4">
                <AlertTriangle size={16} className="text-[#CC0000] flex-shrink-0" />
                <p className="text-sm text-[#CC0000] font-sans">{error}</p>
              </div>
            )}

            {/* Subfolders grid */}
            {!loading && !searchQuery && currentSubFolders.length > 0 && (
              <div className="mb-6">
                <p className="text-[11px] text-[#888] font-sans uppercase tracking-widest font-semibold mb-3">
                  Folders
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                  {currentSubFolders.map((folder) => {
                    const childDocCount = documents.filter((d) => d.folderId === folder.id).length;
                    const childFolderCount = getSubFolders(folder.id).length;
                    return (
                      <div key={folder.id} className="group relative">
                        <button
                          onDoubleClick={() => setActiveFolderId(folder.id)}
                          onClick={() => setActiveFolderId(folder.id)}
                          className="w-full bg-white rounded-2xl border border-[#E8E2DF] p-4
                            hover:border-[#C8A0A0] hover:shadow-md transition-all text-left"
                        >
                          <FolderOpen size={32} className="text-[#CC6600] mb-2" />
                          <p className="text-sm font-semibold text-[#222] font-sans truncate">{folder.name}</p>
                          <p className="text-[11px] text-[#AAA] font-sans mt-0.5">
                            {childFolderCount > 0 ? `${childFolderCount} folder${childFolderCount > 1 ? "s" : ""}, ` : ""}
                            {childDocCount} file{childDocCount !== 1 ? "s" : ""}
                          </p>
                        </button>
                        {/* Folder actions */}
                        {isOwnerOrAbove && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Toggle mini menu via state
                                  setDeleteTarget(null);
                                }}
                                className="w-6 h-6 rounded bg-white/80 flex items-center justify-center
                                  hover:bg-white transition-colors shadow-sm"
                              >
                                <MoreVertical size={11} className="text-[#888]" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Files grid */}
            {!loading && (
              <>
                {currentDocs.length > 0 && (
                  <>
                    {!searchQuery && (
                      <p className="text-[11px] text-[#888] font-sans uppercase tracking-widest font-semibold mb-3">
                        Files
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {currentDocs.map((doc) => (
                        <div key={doc.id}
                          className="group bg-white rounded-2xl border border-[#E8E2DF] p-4
                            hover:border-[#C8A0A0] hover:shadow-md transition-all relative">
                          {/* File icon + info */}
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#F5F0EE] flex items-center
                              justify-center flex-shrink-0">
                              <FileIcon fileType={doc.fileType} size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#222] font-sans truncate" title={doc.fileName}>
                                {doc.fileName}
                              </p>
                              {searchQuery && doc.folderName && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Folder size={10} className="text-[#CC6600]" />
                                  <p className="text-[11px] text-[#AAA] font-sans truncate">{doc.folderName}</p>
                                </div>
                              )}
                              <p className="text-[11px] text-[#AAA] font-sans mt-0.5">
                                {formatSize(doc.fileSize)}
                                {doc.uploadedAt ? ` · ${formatDate(doc.uploadedAt)}` : ""}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#F0EBE8]">
                            <button onClick={() => setPreviewDoc(doc)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F5F0EE]
                                text-xs text-[#661F1F] font-semibold font-sans hover:bg-[#EDE0E0]
                                transition-colors">
                              <Eye size={11} /> Preview
                            </button>
                            <a href={doc.fileUrl} target="_blank" rel="noreferrer" download
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F5F0EE]
                                text-xs text-[#333] font-semibold font-sans hover:bg-[#EDE0E0]
                                transition-colors">
                              <Download size={11} /> Open
                            </a>
                            {isOwnerOrAbove && (
                              <button
                                onClick={() => setDeleteTarget({ type: "doc", item: doc })}
                                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                                  bg-white border border-[#E8E2DF] text-xs text-[#AAA] font-sans
                                  hover:bg-[#FFEBEE] hover:text-[#CC0000] hover:border-[#F0B8B8]
                                  transition-colors">
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Empty state */}
                {currentDocs.length === 0 && currentSubFolders.length === 0 && !searchQuery && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#F5F0EE] flex items-center justify-center mb-4">
                      <FolderOpen size={28} className="text-[#CDCBC9]" />
                    </div>
                    <h3 className="text-base font-bold text-[#333] mb-1">
                      {activeFolderId ? "This folder is empty" : "No documents yet"}
                    </h3>
                    <p className="text-sm text-[#888] font-sans max-w-xs">
                      {isOwnerOrAbove
                        ? "Upload files or create subfolders to organise your documents."
                        : "No documents have been uploaded to this folder yet."}
                    </p>
                    {isOwnerOrAbove && (
                      <div className="flex gap-3 mt-5">
                        <button onClick={() => setFolderModal({ type: "create" })}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E8E2DF]
                            bg-white text-sm font-semibold text-[#333] hover:bg-[#F5F0EE] transition-colors">
                          <FolderPlus size={15} /> New Folder
                        </button>
                        <button onClick={() => setShowUpload(true)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#661F1F]
                            text-white text-sm font-bold hover:bg-[#8B3A3A] transition-colors">
                          <Upload size={15} /> Upload File
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {currentDocs.length === 0 && searchQuery && (
                  <div className="flex flex-col items-center py-16 text-center">
                    <Search size={28} className="text-[#CDCBC9] mb-3" />
                    <p className="text-base font-bold text-[#333]">No files match</p>
                    <p className="text-sm text-[#888] font-sans mt-1">Try a different search term.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* ── MODALS ── */}

      {/* Upload */}
      {showUpload && (
        <UploadModal
          folderId={activeFolderId}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadDone}
        />
      )}

      {/* File preview */}
      {previewDoc && (
        <PreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      {/* New/Rename folder */}
      {folderModal && (
        <FolderNameModal
          title={folderModal.type === "create" ? "New Folder" : "Rename Folder"}
          defaultValue={folderModal.folder?.name || ""}
          onConfirm={folderModal.type === "create" ? handleCreateFolder : handleRenameFolder}
          onCancel={() => { setFolderModal(null); setActionError(null); }}
          isSaving={actionLoading}
        />
      )}
      {actionError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#CC0000] text-white
          rounded-xl px-5 py-3 text-sm font-semibold font-sans shadow-2xl flex items-center gap-2">
          <AlertTriangle size={14} />
          {actionError}
          <button onClick={() => setActionError(null)} className="ml-2 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Delete folder */}
      {deleteTarget?.type === "folder" && (
        <DeleteModal
          title={`Delete "${deleteTarget.item.name}"?`}
          message="All files inside will be moved to the parent folder. Sub-folders will also be deleted. This cannot be undone."
          onConfirm={handleDeleteFolder}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={actionLoading}
        />
      )}

      {/* Delete document */}
      {deleteTarget?.type === "doc" && (
        <DeleteModal
          title={`Delete "${deleteTarget.item.fileName}"?`}
          message="This file will be permanently removed from Firebase Storage and cannot be recovered."
          onConfirm={handleDeleteDoc}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={actionLoading}
        />
      )}
    </div>
  );
}