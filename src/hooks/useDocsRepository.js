// ─────────────────────────────────────────────────────────
//  src/hooks/useDocsRepository.js
//
//  Central hook for the entire Docs Repository module.
//  Handles:
//    • Real-time Firestore subscriptions (documents + categories)
//    • File upload to Firebase Storage with progress tracking
//    • Document deletion (Storage + Firestore)
//    • Category CRUD (Firestore)
// ─────────────────────────────────────────────────────────
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

// ─── Firestore collection names ───────────────────────────
export const DOCS_COLLECTION       = "docsRepository";
export const CATEGORIES_COLLECTION = "docsCategories";

// ─────────────────────────────────────────────────────────
//  useDocsRepository
// ─────────────────────────────────────────────────────────
export function useDocsRepository() {
  const [documents,   setDocuments]   = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [catsLoading, setCatsLoading] = useState(true);
  const [error,       setError]       = useState(null);

  // ── Real-time listener: documents ─────────────────────
  useEffect(() => {
    const q = query(
      collection(db, DOCS_COLLECTION),
      orderBy("uploadedAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          // Normalise Firestore Timestamp → JS Date for display
          uploadedAt: d.data().uploadedAt?.toDate?.() ?? null,
        }));
        setDocuments(docs);
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

  // ── Real-time listener: categories ───────────────────
  useEffect(() => {
    const q = query(
      collection(db, CATEGORIES_COLLECTION),
      orderBy("order", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setCategories(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
        setCatsLoading(false);
      },
      (err) => {
        console.error("Categories listener error:", err);
        setCatsLoading(false);
      }
    );

    return unsub;
  }, []);

  // ─────────────────────────────────────────────────────
  //  uploadDocument
  //  file       — File object from input
  //  categoryId — Firestore category doc ID (or "" for none)
  //  customName — override the original filename (optional)
  //  onProgress — callback(percentComplete: 0-100)
  //  Returns Promise<{ id, fileUrl }>
  // ─────────────────────────────────────────────────────
  const uploadDocument = useCallback(
    async (file, categoryId = "", customName = "", onProgress = null) => {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated. Please log in again.");

      const displayName =
        (customName || file.name).trim() || file.name;

      const ext = file.name.split(".").pop().toLowerCase();
      const timestamp = Date.now();
      // Sanitise filename for Storage path (remove special chars except . - _)
      const safeName = displayName.replace(/[^a-zA-Z0-9._\-\s]/g, "_");
      const storagePath = `docsRepository/${categoryId || "uncategorized"}/${timestamp}_${safeName}`;

      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const pct =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress?.(Math.round(pct));
          },
          (err) => {
            console.error("Upload failed:", err);
            reject(err);
          },
          async () => {
            try {
              const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);

              // Find category name for denormalised display
              const catSnap = categories.find((c) => c.id === categoryId);
              const categoryName = catSnap?.name ?? "";

              const docRef = await addDoc(collection(db, DOCS_COLLECTION), {
                fileName:       displayName,
                fileUrl,
                storagePath,
                category:       categoryId,
                categoryName,
                fileType:       getFileType(file.name),
                fileSize:       file.size,
                uploadedBy:     user.uid,
                uploadedByName: user.displayName || "Unknown",
                uploadedAt:     serverTimestamp(),
              });

              resolve({ id: docRef.id, fileUrl });
            } catch (err) {
              reject(err);
            }
          }
        );
      });
    },
    [categories]
  );

  // ─────────────────────────────────────────────────────
  //  deleteDocument
  //  Removes file from Firebase Storage AND the Firestore doc.
  // ─────────────────────────────────────────────────────
  const deleteDocument = useCallback(async (docData) => {
    // 1. Delete from Storage (best-effort — file might already be gone)
    if (docData.storagePath) {
      try {
        await deleteObject(ref(storage, docData.storagePath));
      } catch (err) {
        // Ignore "object-not-found" — Firestore cleanup still proceeds
        if (err.code !== "storage/object-not-found") {
          console.warn("Storage delete warning:", err.code);
        }
      }
    }

    // 2. Delete Firestore document
    await deleteDoc(doc(db, DOCS_COLLECTION, docData.id));
  }, []);

  // ─────────────────────────────────────────────────────
  //  Category management
  // ─────────────────────────────────────────────────────
  const addCategory = useCallback(async (name) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Category name cannot be empty.");

    const existing = categories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) throw new Error("A category with that name already exists.");

    await addDoc(collection(db, CATEGORIES_COLLECTION), {
      name:      trimmed,
      createdAt: serverTimestamp(),
      order:     Date.now(), // simple ordering by creation time
    });
  }, [categories]);

  const renameCategory = useCallback(async (id, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("Category name cannot be empty.");

    // Update category document
    await updateDoc(doc(db, CATEGORIES_COLLECTION, id), { name: trimmed });

    // Also update categoryName on all docs in this category (batch)
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
    // Move all docs in this category to "Uncategorised" before deleting
    const affectedDocs = documents.filter((d) => d.category === id);
    if (affectedDocs.length > 0) {
      const batch = writeBatch(db);
      affectedDocs.forEach((d) => {
        batch.update(doc(db, DOCS_COLLECTION, d.id), {
          category:     "",
          categoryName: "",
        });
      });
      await batch.commit();
    }

    await deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
  }, [documents]);

  return {
    // Data
    documents,
    categories,
    loading: docsLoading || catsLoading,
    docsLoading,
    catsLoading,
    error,

    // Actions
    uploadDocument,
    deleteDocument,
    addCategory,
    renameCategory,
    deleteCategory,
  };
}
