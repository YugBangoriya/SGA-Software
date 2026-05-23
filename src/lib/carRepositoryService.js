/**
 * carRepositoryService.js
 * Shree Ganesh Automobile — Phase 6: Car Repository
 * All Firestore operations for /carRepository collection and related notifications.
 *
 * Firestore structure (per Tech Stack doc):
 *   /carRepository/{companyId}
 *     - name: string
 *     - models: [{ id, name, driveLink, reelLinks[], createdAt, updatedAt }]
 *     - createdAt: Timestamp
 *     - updatedAt: Timestamp
 *
 *   /notifications/{notifId}
 *     - type: 'car_not_in_repo'
 *     - companyName: string
 *     - modelName: string
 *     - quotationId: string | null
 *     - flaggedBy: string (userId)
 *     - resolved: boolean
 *     - createdAt: Timestamp
 */

import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';

const CAR_REPO = 'carRepository';
const NOTIFICATIONS = 'notifications';

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Generate a stable unique ID for model entries stored inside an array.
 * We avoid Firestore doc IDs here because models live inside the company array.
 */
const generateModelId = () =>
  `mdl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// ─── Real-time Subscription ──────────────────────────────────────────────────

/**
 * Subscribe to all car companies, ordered alphabetically.
 * Returns unsubscribe function.
 * @param {Function} callback - called with companies[] on every change
 */
export const subscribeToCarRepository = (callback) => {
  const q = query(collection(db, CAR_REPO), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const companies = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(companies, null);
    },
    (error) => {
      console.error('[CarRepo] Subscription error:', error);
      callback([], error);
    }
  );
};

// ─── Car Company CRUD ────────────────────────────────────────────────────────

/**
 * Add a new car company.
 * @param {string} name - Company name (e.g. "Maruti Suzuki")
 * @returns {Promise<string>} New document ID
 */
export const addCarCompany = async (name) => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Company name cannot be empty.');

  const docRef = await addDoc(collection(db, CAR_REPO), {
    name: trimmed,
    models: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Update a car company's name.
 * @param {string} companyId
 * @param {string} name - New name
 */
export const updateCarCompany = async (companyId, name) => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Company name cannot be empty.');
  await updateDoc(doc(db, CAR_REPO, companyId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Delete a car company and ALL its models.
 * @param {string} companyId
 */
export const deleteCarCompany = async (companyId) => {
  await deleteDoc(doc(db, CAR_REPO, companyId));
};

// ─── Car Model CRUD (models live inside company document as array) ───────────

/**
 * Add a model to a company's models array.
 * @param {string} companyId
 * @param {{ name, driveLink, reelLinks[] }} model
 * @returns {Promise<string>} New model ID
 */
export const addCarModel = async (companyId, model) => {
  const { name, driveLink = '', reelLinks = [] } = model;
  if (!name?.trim()) throw new Error('Model name cannot be empty.');

  const newModel = {
    id: generateModelId(),
    name: name.trim(),
    driveLink: driveLink.trim(),
    reelLinks: reelLinks.map((l) => l.trim()).filter(Boolean),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const companyRef = doc(db, CAR_REPO, companyId);
  const snap = await getDoc(companyRef);
  if (!snap.exists()) throw new Error('Car company not found.');

  const existing = snap.data().models || [];
  await updateDoc(companyRef, {
    models: [...existing, newModel],
    updatedAt: serverTimestamp(),
  });

  return newModel.id;
};

/**
 * Update an existing model inside a company's models array.
 * @param {string} companyId
 * @param {string} modelId
 * @param {{ name, driveLink, reelLinks[] }} updates
 */
export const updateCarModel = async (companyId, modelId, updates) => {
  const { name, driveLink = '', reelLinks = [] } = updates;
  if (!name?.trim()) throw new Error('Model name cannot be empty.');

  const companyRef = doc(db, CAR_REPO, companyId);
  const snap = await getDoc(companyRef);
  if (!snap.exists()) throw new Error('Car company not found.');

  const updatedModels = (snap.data().models || []).map((m) =>
    m.id === modelId
      ? {
          ...m,
          name: name.trim(),
          driveLink: driveLink.trim(),
          reelLinks: reelLinks.map((l) => l.trim()).filter(Boolean),
          updatedAt: new Date().toISOString(),
        }
      : m
  );

  await updateDoc(companyRef, {
    models: updatedModels,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Delete a model from a company's models array.
 * @param {string} companyId
 * @param {string} modelId
 */
export const deleteCarModel = async (companyId, modelId) => {
  const companyRef = doc(db, CAR_REPO, companyId);
  const snap = await getDoc(companyRef);
  if (!snap.exists()) throw new Error('Car company not found.');

  const filtered = (snap.data().models || []).filter((m) => m.id !== modelId);
  await updateDoc(companyRef, {
    models: filtered,
    updatedAt: serverTimestamp(),
  });
};

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Search across all companies and models.
 * Returns flat list of { company, model } matches.
 * Note: This is a client-side search over Firestore data (suitable for
 * small/medium repository sizes).
 * @param {string} term - Search term
 * @param {Array} companies - Pre-fetched companies array (from subscription)
 * @returns {Array<{ company, model }>}
 */
export const searchCarRepository = (term, companies) => {
  if (!term?.trim()) return [];
  const lower = term.toLowerCase().trim();
  const results = [];

  companies.forEach((company) => {
    const companyMatch = company.name.toLowerCase().includes(lower);
    (company.models || []).forEach((model) => {
      if (companyMatch || model.name.toLowerCase().includes(lower)) {
        results.push({ company, model });
      }
    });
  });

  return results;
};

// ─── "Not In List" Notification System ───────────────────────────────────────

/**
 * Called by Phase 5 (Quotation) when a car model is not found in the repository.
 * Creates a notification document for the SuperAdmin.
 * @param {{ companyName, modelName, quotationId, flaggedBy }} params
 */
export const flagCarNotInRepository = async ({
  companyName,
  modelName,
  quotationId = null,
  flaggedBy,
}) => {
  await addDoc(collection(db, NOTIFICATIONS), {
    type: 'car_not_in_repo',
    companyName: companyName?.trim() || 'Unknown',
    modelName: modelName?.trim() || 'Unknown',
    quotationId,
    flaggedBy,
    resolved: false,
    createdAt: serverTimestamp(),
  });
};

/**
 * Subscribe to unresolved "car not in repo" notifications for SuperAdmin.
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export const subscribeToCarRepoNotifications = (callback) => {
  const q = query(
    collection(db, NOTIFICATIONS),
    where('type', '==', 'car_not_in_repo'),
    where('resolved', '==', false),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

/**
 * Mark a "not in repo" notification as resolved after SuperAdmin adds the car.
 * @param {string} notificationId
 */
export const resolveCarRepoNotification = async (notificationId) => {
  await updateDoc(doc(db, NOTIFICATIONS, notificationId), {
    resolved: true,
    resolvedAt: serverTimestamp(),
  });
};
