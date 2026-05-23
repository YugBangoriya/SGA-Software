// ─────────────────────────────────────────────────────────
//  src/lib/fileHelpers.js
//  Utilities for file type detection, icon mapping,
//  size formatting, and accepted MIME types.
// ─────────────────────────────────────────────────────────

/** Canonical file-type categories used throughout the repository */
export const FILE_TYPES = {
  PDF:   "pdf",
  IMAGE: "image",
  VIDEO: "video",
  WORD:  "word",
  EXCEL: "excel",
  OTHER: "other",
};

/** Map a file extension → FILE_TYPES constant */
export function getFileType(filename = "") {
  const ext = filename.split(".").pop().toLowerCase();
  if (["pdf"].includes(ext))                         return FILE_TYPES.PDF;
  if (["jpg","jpeg","png","webp","gif","svg"].includes(ext)) return FILE_TYPES.IMAGE;
  if (["mp4","mov","avi","webm","mkv"].includes(ext)) return FILE_TYPES.VIDEO;
  if (["doc","docx"].includes(ext))                  return FILE_TYPES.WORD;
  if (["xls","xlsx","csv"].includes(ext))            return FILE_TYPES.EXCEL;
  return FILE_TYPES.OTHER;
}

/** Human-readable file size */
export function formatFileSize(bytes = 0) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B","KB","MB","GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** MIME types accepted in the upload file picker */
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
].join(",");

/** Max file size — 50 MB */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Returns a colour set for a given file type.
 * Used in DocCard icons and badges.
 */
export function getFileTypeColors(fileType) {
  const map = {
    [FILE_TYPES.PDF]:   { bg: "#FFEBEE", icon: "#CC0000", label: "PDF" },
    [FILE_TYPES.IMAGE]: { bg: "#E8F5E9", icon: "#1A7A1A", label: "Image" },
    [FILE_TYPES.VIDEO]: { bg: "#F3E5F5", icon: "#6A1B9A", label: "Video" },
    [FILE_TYPES.WORD]:  { bg: "#E3F2FD", icon: "#0055CC", label: "Word" },
    [FILE_TYPES.EXCEL]: { bg: "#E8F5E9", icon: "#1A5C1A", label: "Excel" },
    [FILE_TYPES.OTHER]: { bg: "#F5F0EE", icon: "#666666", label: "File" },
  };
  return map[fileType] || map[FILE_TYPES.OTHER];
}

/**
 * Returns a single large emoji/character to represent the file type.
 * Used in the card icon area.
 */
export function getFileTypeEmoji(fileType) {
  const map = {
    [FILE_TYPES.PDF]:   "PDF",
    [FILE_TYPES.IMAGE]: "IMG",
    [FILE_TYPES.VIDEO]: "VID",
    [FILE_TYPES.WORD]:  "DOC",
    [FILE_TYPES.EXCEL]: "XLS",
    [FILE_TYPES.OTHER]: "FILE",
  };
  return map[fileType] || "FILE";
}

/**
 * Given a Firebase Storage storagePath, check whether the file
 * is previewable inline (PDF, image, video).
 */
export function isPreviewable(fileType) {
  return [FILE_TYPES.PDF, FILE_TYPES.IMAGE, FILE_TYPES.VIDEO].includes(fileType);
}

/**
 * Validate a file before upload.
 * Returns { valid: boolean, error?: string }
 */
export function validateFile(file) {
  if (!file) return { valid: false, error: "No file selected." };
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File is too large. Maximum size is 50 MB.` };
  }
  const type = getFileType(file.name);
  if (type === FILE_TYPES.OTHER) {
    // Still allow it, just warn that preview won't be available
  }
  return { valid: true };
}
