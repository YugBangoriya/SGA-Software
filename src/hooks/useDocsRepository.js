// SGA — Last updated: Added nested folder support via docsFolders collection.
// New functions: createFolder, renameFolder, deleteFolder, moveDocumentToFolder.
// Documents now support folderId field for hierarchical navigation.
// Legacy docsCategories kept for backward compatibility.
// uploadDocument updated to accept folderId instead of categoryId.
// src/hooks/useDocsRepository.js

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage, auth } from "../lib/firebase";
import { getFileType } from "../lib/fileHelpers";

// ─── Firestore collection names ───────────────────────────────────────────────
export const DOCS_COLLECTION       = "docsRepository";
export const CATEGORIES_COLLECTION = "docsCategories";   // legacy
export const FOLDERS_COLLECTION    = "docsFolders";      // new nested folders

// ─────────────────────────────────────────────────────────────────────────────
//  useDocsRepository
//  Handles documents + nested folder hierarchy.
//  Folders: /docsFolders/{folderId} → { name, parentId (null = root), createdAt }
//  Documents: /docsRepository/{docId} → { ..., folderId (new), category (legacy) }
// ─────────────────────────────────────────────────────────────────────────────
export function useDocsRepository() {
  const [documents,   setDocuments]   = useState([]);
  const [categories,  setCategories]  = useState([]);   // legacy
  const [folders,     setFolders]     = useState([]);   // new nested folders
  const [docsLoading, setDocsLoading] = useState(true);
  const [catsLoading, setCatsLoading] = useState(true);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [error,       setError]       = useState(null);

  // ── Real-time listener: documents ────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, DOCS_COLLECTION),
      orderBy("uploadedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDocuments(snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          uploadedAt: d.data().uploadedAt?.toDate?.() ?? null,
        })));
        setDocsLoading(false);
      },
      (err) => {
        console.error("Docs listener error:", err);
        setError(err.message);
        setDocsLoading(false);
      }
    );
    return unsub;
  }, []);

  // ── Real-time listener: legacy categories ────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, CATEGORIES_COLLECTION), orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCatsLoading(false);
      },
      (err) => {
        console.error("Categories listener error:", err);
        setCatsLoading(false);
      }
    );
    return unsub;
  }, []);

  // ── Real-time listener: folders ──────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, FOLDERS_COLLECTION), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFolders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setFoldersLoading(false);
      },
      (err) => {
        console.error("Folders listener error:", err);
        setFoldersLoading(false);
      }
    );
    return unsub;
  }, []);

  // ─── uploadDocument ────────────────────────────────────────────────────────
  // Accepts folderId (new) — falls back to empty string for root.
  // Still writes categoryId/categoryName for backward compat.
  const uploadDocument = useCallback(
    async (file, folderId = "", customName = "", onProgress = null) => {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated. Please log in again.");

      const displayName = (customName || file.name).trim() || file.name;
      const safeName    = displayName.replace(/[^a-zA-Z0-9._\-\s]/g, "_");
      const storagePath = `docsRepository/${folderId || "root"}/${Date.now()}_${safeName}`;

      const storageRef  = ref(storage, storagePath);
      const uploadTask  = uploadBytesResumable(storageRef, file);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress?.(Math.round(pct));
          },
          (err) => { console.error("Upload failed:", err); reject(err); },
          async () => {
            try {
              const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);

              // Resolve folder name for denormalised display
              const folderData  = folders.find((f) => f.id === folderId);
              const folderName  = folderData?.name ?? "";

              // Legacy category compat
              const catSnap     = categories.find((c) => c.id === folderId);
              const categoryName = catSnap?.name ?? folderName;

              const docRef = await addDoc(collection(db, DOCS_COLLECTION), {
                fileName:       displayName,
                fileUrl,
                storagePath,
                // New folder fields
                folderId:       folderId || "",
                folderName:     folderName,
                // Legacy category fields (kept for backward compat)
                category:       folderId || "",
                categoryName:   categoryName,
                fileType:       getFileType(file.name),
                fileSize:       file.size,
                uploadedBy:     user.uid,
                uploadedByName: user.displayName || "Unknown",
                uploadedAt:     serverTimestamp(),
              });

              resolve({ id: docRef.id, fileUrl });
            } catch (err) { reject(err); }
          }
        );
      });
    },
    [categories, folders]
  );

  // ─── deleteDocument ────────────────────────────────────────────────────────
  const deleteDocument = useCallback(async (docData) => {
    if (docData.storagePath) {
      try {
        await deleteObject(ref(storage, docData.storagePath));
      } catch (err) {
        if (err.code !== "storage/object-not-found") {
          console.warn("Storage delete warning:", err.code);
        }
      }
    }
    await deleteDoc(doc(db, DOCS_COLLECTION, docData.id));
  }, []);

  // ─── moveDocumentToFolder ─────────────────────────────────────────────────
  const moveDocumentToFolder = useCallback(async (docId, newFolderId) => {
    const folderData = folders.find((f) => f.id === newFolderId);
    await updateDoc(doc(db, DOCS_COLLECTION, docId), {
      folderId:   newFolderId || "",
      folderName: folderData?.name || "",
      category:   newFolderId || "",
      categoryName: folderData?.name || "",
    });
  }, [folders]);

  // ─── Folder CRUD ──────────────────────────────────────────────────────────

  // createFolder — creates a folder at the given parentId (null = root)
  const createFolder = useCallback(async (name, parentId = null) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Folder name cannot be empty.");

    const exists = folders.some(
      (f) => f.name.toLowerCase() === trimmed.toLowerCase()
           && (f.parentId ?? null) === (parentId ?? null)
    );
    if (exists) throw new Error("A folder with that name already exists here.");

    const docRef = await addDoc(collection(db, FOLDERS_COLLECTION), {
      name:      trimmed,
      parentId:  parentId ?? null,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid ?? "",
    });
    return docRef.id;
  }, [folders]);

  // renameFolder
  const renameFolder = useCallback(async (id, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("Folder name cannot be empty.");
    await updateDoc(doc(db, FOLDERS_COLLECTION, id), { name: trimmed });

    // Update folderName on all documents in this folder
    const affectedDocs = documents.filter((d) => d.folderId === id);
    if (affectedDocs.length > 0) {
      const batch = writeBatch(db);
      affectedDocs.forEach((d) => {
        batch.update(doc(db, DOCS_COLLECTION, d.id), {
          folderName: trimmed, categoryName: trimmed,
        });
      });
      await batch.commit();
    }
  }, [documents]);

  // deleteFolder — moves its documents to parent folder, then deletes subfolders recursively
  const deleteFolder = useCallback(async (id) => {
    const folderData = folders.find((f) => f.id === id);
    const parentId   = folderData?.parentId ?? null;
    const parentFolder = parentId ? folders.find((f) => f.id === parentId) : null;

    // 1. Move documents in this folder to the parent folder
    const affectedDocs = documents.filter((d) => d.folderId === id);
    if (affectedDocs.length > 0) {
      const batch = writeBatch(db);
      affectedDocs.forEach((d) => {
        batch.update(doc(db, DOCS_COLLECTION, d.id), {
          folderId:   parentId ?? "",
          folderName: parentFolder?.name ?? "",
          category:   parentId ?? "",
          categoryName: parentFolder?.name ?? "",
        });
      });
      await batch.commit();
    }

    // 2. Recursively delete child folders
    const children = folders.filter((f) => f.parentId === id);
    for (const child of children) {
      await deleteFolder(child.id);
    }

    // 3. Delete the folder itself
    await deleteDoc(doc(db, FOLDERS_COLLECTION, id));
  }, [folders, documents]);

  // ─── Legacy category management (kept for backward compat) ───────────────

  const addCategory = useCallback(async (name) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Category name cannot be empty.");
    const existing = categories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) throw new Error("A category with that name already exists.");
    await addDoc(collection(db, CATEGORIES_COLLECTION), {
      name: trimmed, createdAt: serverTimestamp(), order: Date.now(),
    });
  }, [categories]);

  const renameCategory = useCallback(async (id, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("Category name cannot be empty.");
    await updateDoc(doc(db, CATEGORIES_COLLECTION, id), { name: trimmed });
    const affectedDocs = documents.filter((d) => d.category === id);
    if (affectedDocs.length > 0) {
      const batch = writeBatch(db);
      affectedDocs.forEach((d) => {
        batch.update(doc(db, DOCS_COLLECTION, d.id), { categoryName: trimmed });
      });
      await batch.commit();
    }
  }, [documents]);

  const deleteCategory = useCallback(async (id) => {
    const affectedDocs = documents.filter((d) => d.category === id);
    if (affectedDocs.length > 0) {
      const batch = writeBatch(db);
      affectedDocs.forEach((d) => {
        batch.update(doc(db, DOCS_COLLECTION, d.id), { category: "", categoryName: "" });
      });
      await batch.commit();
    }
    await deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
  }, [documents]);

  // ─── Derived helpers ─────────────────────────────────────────────────────

  // Get documents in a given folderId (null or "" = root, only docs with no folderId)
  const getDocumentsInFolder = useCallback((folderId) => {
    if (!folderId) {
      return documents.filter((d) => !d.folderId || d.folderId === "");
    }
    return documents.filter((d) => d.folderId === folderId);
  }, [documents]);

  // Get direct child folders of a given parentId
  const getSubFolders = useCallback((parentId) => {
    return folders.filter((f) => (f.parentId ?? null) === (parentId ?? null));
  }, [folders]);

  // Build breadcrumb trail for a folderId
  const getFolderBreadcrumb = useCallback((folderId) => {
    const trail = [];
    let current = folderId;
    let safety = 0;
    while (current && safety < 20) {
      const folder = folders.find((f) => f.id === current);
      if (!folder) break;
      trail.unshift(folder);
      current = folder.parentId ?? null;
      safety++;
    }
    return trail;
  }, [folders]);

  return {
    // Data
    documents,
    categories,
    folders,
    loading:        docsLoading || catsLoading || foldersLoading,
    docsLoading,
    catsLoading,
    foldersLoading,
    error,

    // Document actions
    uploadDocument,
    deleteDocument,
    moveDocumentToFolder,

    // Folder actions (new)
    createFolder,
    renameFolder,
    deleteFolder,

    // Legacy category actions
    addCategory,
    renameCategory,
    deleteCategory,

    // Derived helpers
    getDocumentsInFolder,
    getSubFolders,
    getFolderBreadcrumb,
  };
}