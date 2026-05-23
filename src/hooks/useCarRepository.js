/**
 * useCarRepository.js
 * Shree Ganesh Automobile — Phase 6: Car Repository
 * Custom React hooks for real-time car repository state.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToCarRepository,
  subscribeToCarRepoNotifications,
  searchCarRepository,
  addCarCompany,
  updateCarCompany,
  deleteCarCompany,
  addCarModel,
  updateCarModel,
  deleteCarModel,
  resolveCarRepoNotification,
} from '../lib/carRepositoryService';

// ─── useCarRepository ─────────────────────────────────────────────────────────
/**
 * Provides real-time car repository data with CRUD helpers.
 * Used by admin, browser, and selector components.
 */
export const useCarRepository = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCarRepository((data, err) => {
      if (err) setError(err.message);
      else {
        setCompanies(data);
        setError(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ── Company Actions ────────────────────────────────────────────────────────

  const createCompany = useCallback(async (name) => {
    setActionLoading(true);
    try {
      await addCarCompany(name);
    } finally {
      setActionLoading(false);
    }
  }, []);

  const editCompany = useCallback(async (companyId, name) => {
    setActionLoading(true);
    try {
      await updateCarCompany(companyId, name);
    } finally {
      setActionLoading(false);
    }
  }, []);

  const removeCompany = useCallback(async (companyId) => {
    setActionLoading(true);
    try {
      await deleteCarCompany(companyId);
    } finally {
      setActionLoading(false);
    }
  }, []);

  // ── Model Actions ──────────────────────────────────────────────────────────

  const createModel = useCallback(async (companyId, model) => {
    setActionLoading(true);
    try {
      return await addCarModel(companyId, model);
    } finally {
      setActionLoading(false);
    }
  }, []);

  const editModel = useCallback(async (companyId, modelId, updates) => {
    setActionLoading(true);
    try {
      await updateCarModel(companyId, modelId, updates);
    } finally {
      setActionLoading(false);
    }
  }, []);

  const removeModel = useCallback(async (companyId, modelId) => {
    setActionLoading(true);
    try {
      await deleteCarModel(companyId, modelId);
    } finally {
      setActionLoading(false);
    }
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────────

  const search = useCallback(
    (term) => searchCarRepository(term, companies),
    [companies]
  );

  return {
    companies,
    loading,
    error,
    actionLoading,
    createCompany,
    editCompany,
    removeCompany,
    createModel,
    editModel,
    removeModel,
    search,
  };
};

// ─── useCarRepoNotifications ──────────────────────────────────────────────────
/**
 * Provides real-time "car not in repo" notifications for SuperAdmin.
 */
export const useCarRepoNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCarRepoNotifications((data) => {
      setNotifications(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const resolve = useCallback(async (notificationId) => {
    await resolveCarRepoNotification(notificationId);
  }, []);

  return { notifications, loading, resolve };
};

// ─── useCarSearch ─────────────────────────────────────────────────────────────
/**
 * Lightweight hook for search-only use (CarSelectorComponent, QuickSend).
 * Does NOT set up CRUD. Reuses a static snapshot for search.
 */
export const useCarSearch = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCarRepository((data) => {
      setCompanies(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const search = useCallback(
    (term) => searchCarRepository(term, companies),
    [companies]
  );

  return { companies, loading, search };
};
